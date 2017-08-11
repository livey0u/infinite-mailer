const EventEmitter = require('events');

const _ = require('lodash');
const async = require('async');
const debug = require('debug')('InfiniteMailer:ProviderBase');


class ProviderBase extends EventEmitter {

  constructor(config) {

    debug('#constructor', _.omit(config, 'redisClient'));

    super();

    if (!config.provider || typeof config.provider !== 'object') {
      throw new Error('Invalid provider config');
    }

    if (!config.provider.apiKey) {
      throw new Error('Invalid provider API Key');
    }

    if (!Array.isArray(config.provider.successCodes) || !config.provider.successCodes.length) {
      throw new Error('Invalid provider success codes');
    }

    if (!Array.isArray(config.provider.failureCodes) || !config.provider.failureCodes.length) {
      throw new Error('Invalid provider failure codes');
    }

    if (config.provider.batchLimit && isNaN(+config.provider.batchLimit)) {
      throw new Error('Batch limit must be a number');
    } else if (!config.provider.batchLimit) {
      config.provider.batchLimit = -1;
    }

    let batchLimit = +config.provider.batchLimit;

    this.name = config.provider.name;
    this.redisClient = config.redisClient;
    this.redisKeyPrefix = config.redisKeyPrefix;
    this.providerQueueName = (this.redisKeyPrefix) + ':PROVIDER_QUEUE';
    this.onReady = config.onReady;
    this.onError = config.onError;
    this.active = false;
    this.sandbox = !!config.provider.sandbox;
    this.successCodes = config.provider.successCodes;
    this.providerUnavailableCodes = config.provider.failureCodes;
    this.batchLimit = batchLimit > 1000 ? 1000 : batchLimit;
    this.apiKey = config.provider.apiKey;

    debug('#constructor initialized');

  }

  process() {

    debug('#process', this.active);

    if (this.active) {
      return;
    }

    this.active = true;

    async.waterfall([(done) => this.readFromQueue(done),
    (email, done) => {
      if (email) {
        return done(null, email);
      }
      this.onReady(this.providerQueueName, done);
    }, 
    (email, done) => {
      if (!email) {
        return setTimeout(() => done(null, null, null), 1000);
      }
      this.send(email, done);
    }, this.postSendActions.bind(this)], (error) => {
    	
    	debug(`#process:${this.name} done`, error);
    	
    	this.active = false;

    	if(error) {
      	return this.tryRestoreEmail(error, (error) => this.onError(error));
      }

      this.process();

    });

  }

  readFromQueue(callback) {
    this.redisClient.lrange(this.providerQueueName, 0, -1, (error, list) => {
      if(error) {
        this.emit('error', { type: 'critical', message: 'Error while reading list element from redis', data: error });
      }
      if(!list || !list.length) {
        return callback(null, null);
      }
      if(list.length > 1) {
        this.emit('error', { type: 'critical', message: 'More than one element in provider queue', data: list }); 
      }
      callback(null, JSON.parse(list[0]));
    });
  }

  takeFromQueue(callback) {
    this.doTakeFromQueue(this.providerQueueName, callback);
  }

  doTakeFromQueue(queueName, callback) {
    debug('#doTakeFromQueue', queueName);
    this.redisClient.rpop(queueName, (error, data) => {
      debug('#doTakeFromQueue done', error, data);
      if (error) {
        return callback(error);
      }
      callback(null, JSON.parse(data));
    });
  }

  doPushToQueue(queueName, list, callback) {
    debug('#doPushToQueue', queueName, list);
    this.redisClient.lpush(queueName, list, (error, data) => {
      debug('#doPushToQueue done', error, data);
      if (error) {
        return callback(error);
      }
      callback(null, JSON.parse(data));
    });
  }

  send(email, callback) {

    debug('#send', email);

    async.waterfall([
      this.formatContent.bind(this, email),
      this.buildEmailRequestBody.bind(this),
      this.doSend.bind(this)
    ], (error, response) => {

      debug('#send done', error, response);

      callback(error, response, email);

    });

  }

  doSend(email, callback) {
    throw Error(`#doSend is not implemented by ${this.name}.
    	Implement & return following structured data in the callback
				{
					"code": code,     // One of either successCodes or failureCodes
					"error": error,   // in case of error, return error
				}
    	`);
  }

  formatContent(email, callback) {
    callback(null, email);
  }

  buildEmailRequestBody(email, callback) {
    throw Error(`#buildEmailRequestBody is not implemented by ${this.name}`);
  }

  tryRestoreEmail(error, callback) {
  	callback(error);
  }

  postSendActions(response, email, callback) {

  	debug('#postSendActions', response, email);

  	if(!response) {
  		return callback();
  	}

    if (this.successCodes.indexOf(response.code) !== -1) {
    	this.emit('sent', email);
      return this.removeLastElementFromQueue(this.providerQueueName, callback);
    }

    if (this.providerUnavailableCodes.indexOf(response.code) !== -1) {
      return callback(response);
    }

    this.emit('error', { type: 'critical', message: 'Unknown response code', data: response });

    callback();

  }

  removeLastElementFromQueue(queueName, callback) {

  	this.redisClient.rpop(queueName, (error) => {
  		if(error) {
  			this.emit('error', { type: 'critical', message: 'Error while removing list element from redis', data: error });
  		}
  		callback();
  	});

  }

}

module.exports = ProviderBase;