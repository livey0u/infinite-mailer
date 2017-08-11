const _ = require('lodash');
const nodemailer = require('nodemailer');
const aws = require('aws-sdk');
const handlebars = require('handlebars');
const async = require('async');
const debug = require('debug')('InfiniteMailer:AWSSES');

const ProviderBase = require('./base');
const util = require('../util');

class AWSSES extends ProviderBase {

  constructor(userConfig) {

    debug('#constructor', _.omit(userConfig, 'redisClient'));

    let defaultConfig = {
      provider: {
        successCodes: [200],
        failureCodes: [500],
        sandbox: false,
        sendRate: 1
      }
    };
    let config = _.assign({}, defaultConfig, userConfig);
    delete config.provider.batchLimit;

    super(config);

    if(typeof config.provider.secret !== 'string') {
      throw new Error('AWS Config Secret must be a string');
    }

    if(typeof config.provider.region !== 'string') {
      throw new Error('AWS Config region must be a string');
    }

    let sendRate = Math.floor(+config.provider.sendRate);

    if(!sendRate || isNaN(sendRate)) {
      throw new Error('Send rate must be a number greater than one');
    }

    let credentials = new aws.Credentials({
      accessKeyId: this.apiKey,
      secretAccessKey: config.provider.secret
    });
    this.client = nodemailer.createTransport({SES: new aws.SES({credentials: credentials, region: config.provider.region}), sendingRate: sendRate});
    this.privateQueueName = this.providerQueueName + ':PRIVATE';

    debug('#constructor initialized');

  }

  personalizeEmail(content, receiver) {
    
    debug('#personalizeEmail', content, receiver);
    
    let result = {
      text: '',
      html: '',
      subject: ''
    };
    let personalizations = receiver.variables;
    personalizations.name = personalizations.name || receiver.name; // in case, if the name is already in variables & not in receiver object
    personalizations.email = receiver.email;

    result.subject = handlebars.compile(content.subject)(personalizations);

    if (content.message.text) {
      result.text = handlebars.compile(content.message.text)(personalizations);
    }
    if (content.message.html) {
      result.html = handlebars.compile(content.message.html)(personalizations);
    }
    
    debug('#personalizeEmail done', result);

    return result;

  }

  sendToSingleReceiver(email, callback) {

    debug('#sendToSingleReceiver', email);

    let content = this.personalizeEmail(email.content, email.content.receivers[0]);
    let emailBody = {
      from: util.emailObjectToString(email.content.sender),
      to: util.emailObjectToString(email.content.receivers[0]),
      subject: content.subject,
      text: content.text,
      html: content.html,
      replyTo: util.emailObjectToString(email.content.replyTo)
    };

    this.client.sendMail(emailBody, (error, info) => {
      debug('#sendToSingleReceiver done', error, info);
      let code = error ? error.code : 200;
      callback(null, {code: code, error: error});
    });

  }

  sendToMultipleReceivers(emailBody, callback) {
    debug('#sendToMultipleReceivers', emailBody);
    let receivers = emailBody.content.receivers;
    emailBody.content.receivers = [];
    let emails = receivers.map((receiver) => {
      emailBody.content.receivers = [receiver];
      return JSON.stringify(emailBody);
    });
    
    async.series([(done) => {
      this.doPushToQueue(this.privateQueueName, emails, done);
    }, this.processPrivateQueue.bind(this)], (error) => {
      debug('#sendToMultipleReceivers done', error);
      callback(error);
    });

  }

  isPrivateQueueHasEmails(callback) {
    debug('#isPrivateQueueHasEmails');
    this.redisClient.llen(this.privateQueueName, (error, length) => {
      debug('#isPrivateQueueHasEmails done', error, length);
      if(error) {
        return callback(error);
      }
      return callback(null, length > 0);
    });
  }

  trySendEmailFromPrivateQueue(callback) {
    debug('#trySendEmailFromPrivateQueue');
    async.waterfall([
      (done) => this.redisClient.rpop(this.privateQueueName, (error, email) => done(error, email)),
      (email, done) => {
        if(!email) {
          return done(null, null, email);
        }
        this.sendToSingleReceiver(JSON.parse(email), (error, response) => done(error, response, email));
      },
      (response, email, done) => {
        if(!response) {
          return done();
        }
        if(response.code !== 200) {
          return this.doPushToQueue(this.privateQueueName, email, (error) => done(error || response));
        }
        done();
      }
    ], (error) => {
      debug('#trySendEmailFromPrivateQueue done', error);
      callback(error);
    });
  }

  processPrivateQueue(callback) {
    debug('#processPrivateQueue');
    async.during(this.isPrivateQueueHasEmails.bind(this), this.trySendEmailFromPrivateQueue.bind(this), (error) => {
      debug('#processPrivateQueue done', error);
      callback(error);
    });

  }

  doSend(emailBody, callback) {

    debug('#doSend', emailBody);

    let cb = (error, response) => {
      debug('#doSend done', error, response);
      callback(error, response);
    };

    if(emailBody.content.receivers.length === 1) {
      return this.sendToSingleReceiver(emailBody, (error, response) => cb(null, response));
    }

    this.sendToMultipleReceivers(emailBody, (error) => cb(null, error || {code: 200}));

  }

  formatContent(email, callback) {

    return callback(null, email);

  }

  buildEmailRequestBody(email, callback) {

    callback(null, email);

  }

  processResponse(error, response, callback) {

    debug('#processResponse', error, response);

    if (error) {
      return callback(null, error);
    }

    let formattedResponse = { code: response.statusCode, error: response.body };
    debug('#processResponse done', formattedResponse);

    callback(null, formattedResponse);

  }

  tryRestoreEmail(error, callback) {

    this.redisClient
    .multi()
    .lrange(this.privateQueueName, 0, -1)
    .del(this.privateQueueName)
    .exec((redisError, replies) => {

      if(redisError) {
        this.emit('error', { type: 'critical', message: 'Error while reading pending emails from private queue', data: redisError });
        return callback(error);
      }

      let pendingEmails = replies[0];

      if(!pendingEmails.length) {
        return callback(error);
      }

      let emailObject = pendingEmails.reduce((previous, current) => {

        if(!previous) {
          previous = JSON.parse(current);
        }
        else {
          previous.content.receivers.push(JSON.parse(current).content.receivers[0]);
        }
        return previous;
      }, null);

      this.redisClient
      .lset(this.providerQueueName, 0, JSON.stringify(emailObject), (redisError) => {

        if(redisError) {
          this.emit('error', { type: 'critical', message: 'Error while updating pending emails in provider queue', data: redisError, pending: emailObject });
        }

        return callback(error);

      });

    });

  }

}

module.exports = AWSSES;