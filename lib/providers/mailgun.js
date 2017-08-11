const _ = require('lodash');
const debug = require('debug')('InfiniteMailer:Mailgun');

const ProviderBase = require('./base');
const util = require('../util');

class Mailgun extends ProviderBase {

  constructor(userConfig) {

    debug('#constructor', _.omit(userConfig, 'redisClient'));

    let defaultConfig = {
      provider: {
        successCodes: [200],
        failureCodes: [400, 401, 402, 404, 500, 502, 503, 504],
        sandbox: false,
        batchLimit: 1000
      }
    };
    let config = _.assign({}, defaultConfig, userConfig)

    super(config);

    if(!util.isValidDomain(config.provider.domain)) {
      throw new Error(`Invalid doman name`);
    }

    this.client = require('mailgun-js')({ apiKey: this.apiKey, domain: config.provider.domain });

    debug('#constructor initialized');

  }

  doSend(emailBody, callback) {

    debug('#doSend', emailBody);

    this.client.messages().send(emailBody, function (error, body) {
      debug('#doSend done', error, body);
      if (error) {
        return callback(null, {code: error.statusCode, error: error});
      }
      callback(null, { code: 200 });
    });

  }

  formatContent(email, callback) {

    debug('#formatContent', email);

    if (email.content.message.html) {
      email.content.message.html = email.content.message.html.replace(/{{/g, '%recipient.').replace(/}}/g, '%');
    }

    if (email.content.message.text) {
      email.content.message.text = email.content.message.text.replace(/{{/g, '%recipient.').replace(/}}/g, '%');
    }

    debug('#formatContent done', email);

    return callback(null, email);

  }

  buildEmailRequestBody(email, callback) {

    debug('#buildEmailRequestBody', email);

    let personalizations = {};
    let receivers = email.content.receivers;
    let bcc = email.content.bcc;
    let cc = email.content.cc;
    let subject = email.content.subject;
    let from = null;

    let body = {
      from: util.emailObjectToString(email.content.sender),
      to: receivers.map((receiver) => util.emailObjectToString(receiver)).join(','),
      subject: subject,
      html: email.content.message.html,
      text: email.content.message.text,
      'recipient-variables': personalizations,
      'o:testmode': this.sandbox
    };

    if (bcc) {
      body.bcc = util.emailObjectToString(bcc);
    }

    if (cc) {
      body.cc = util.emailObjectToString(cc);
    }

    for (let receiver of receivers) {

      let variables = receiver.variables;
      personalizations[receiver.email] = variables;

    }

    debug('#buildEmailRequestBody', body);

    callback(null, body);

  }

}

module.exports = Mailgun;