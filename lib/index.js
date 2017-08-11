const EventEmitter = require('events');

const redis = require('redis');
const async = require('async');
const debug = require('debug')('InfiniteMailer:Main');

const util = require('./util');
const errors = require('./errors');

class InfiniteMailer extends EventEmitter {

	constructor(config) {

		debug('#constructor', config);

		super();

		if(!Array.isArray(config.providers)) {
			throw new Error(`"providers" parameter must be an array`);
		}

		if(!config.providers.length) {
			throw new Error(`"providers" parameter is empty`);
		}

		if(!config.redis || typeof config.redis !== 'object') {
			throw new Error(`"redis" configuration is required`);
		}

		this.activeProvider = 0;
		this.availableProviders = ['aws-ses', 'sendgrid', 'mandrill', 'mailgun'];
		this.redisClient = redis.createClient(config.redis);
		this.redisKeyPrefix = (config.redis.prefix || '') + 'EMAIL_SERVICE';
		this.mainQueueName = (config.redis.prefix || '') + 'EMAIL_SERVICE:' + 'MAIN_QUEUE';
		this.providers = this.initProviders(config.providers);

		this.startActiveProvider();

		debug('#constructor initialized');

	}

	initProviders(providersConfig) {

		debug('#initProviders', providersConfig);

		let providers = [];
		let initialized = [];

		for(let providerConfig of providersConfig) {
			let providerName = providerConfig.name;
			if(this.availableProviders.indexOf(providerName) !== -1 && initialized.indexOf(providerName) === -1) {
				let Provider = require(`./providers/${providerName}`);
				let providerOptions = {
					provider: providerConfig,
					onReady: this.onProviderReady.bind(this), 
					onError: this.onProviderError.bind(this),
					redisClient: this.redisClient,
					redisKeyPrefix: this.redisKeyPrefix
				};
				let provider = new Provider(providerOptions);

				provider.on('sent', (data) => {
					this.emit('sent', data);
				});
				provider.on('error', (data) => this.emit('error', data));

				providers.push(provider);
				initialized.push(providerName);
			}
		}

		if(!providers.length) {
			throw new Error('No providers initialized.');
		}

		debug('#initProviders done');

		return providers;

	}

	send(email, callback) {

		debug('#send', email);

		if(!email || typeof email !== 'object') {
			return callback(errors.INVALID_EMAIL_OBJECT);
		}

		if(!email.content || typeof email.content !== 'object') {
			return callback(errors.INVALID_EMAIL_CONTENT);
		}

		if(typeof email.content.subject !== 'string' || !email.content.subject.trim()) {
			return callback(errors.INVALID_EMAIL_SUBJECT);
		}

		if(!util.isValidEmailAddressesList([email.content.sender])) {
			return callback(errors.INVALID_EMAIL_SENDER_OBJECT);
		}

		if(!util.isValidReceiversList(email.content.receivers)) {
			return callback(errors.INVALID_EMAIL_RECEIVERS_LIST);
		}

		if(email.content.cc && !util.isValidEmailAddressesList([email.content.cc])) {
			return callback(errors.INVALID_EMAIL_CC_OBJECT);
		}

		if(email.content.bcc && !util.isValidEmailAddressesList([email.content.bcc])) {
			return callback(errors.INVALID_EMAIL_BCC_OBJECT);
		}

		if(email.content.replyTo && !util.isValidEmailAddressesList([email.content.replyTo])) {
			return callback(errors.INVALID_EMAIL_REPLYTO_OBJECT);
		}

		if(email.content.attachments && !util.isValidAttachmentsList(email.content.attachments)) {
			return callback(errors.INVALID_EMAIL_ATTACHMENTS_LIST);
		}

		if(typeof email.content.subject !== 'string' || !email.content.subject.trim()) {
			return callback(errors.INVALID_EMAIL_SUBJECT);
		}

		if(!util.isValidEmailMessage(email.content.message)) {
			return callback(errors.INVALID_EMAIL_MESSAGE_OBJECT);
		}

		if(!email.content.replyTo) {
			email.content.replyTo = email.content.sender;
		}

		email.content.receivers = email.content.receivers.map((receiver) => {
			receiver.variables = receiver.variables || {};
			return receiver;
		});

		let batches = util.emailPayloadToBatches(email, this.providers[this.activeProvider].batchLimit).map(JSON.stringify);

		this.redisClient.lpush(this.mainQueueName, batches, (error) => {
			debug('#send done', error);
			if(error) {
				return callback(error);
			}

			this.notifyActiveProvider();

			callback();

		});

	}

	onProviderReady(providerQueueName, callback) {

		debug('#onProviderReady', this.mainQueueName, providerQueueName);

		this.redisClient.rpoplpush(this.mainQueueName, providerQueueName, (error, data) => {

			debug('#onProviderReady done', error, data);

			if(error) {

				this.emit('error', {level: 'critical', error: error, message: 'Moving email from main queue to provider queue failed'});
				
				return callback(error);

			}

			if(!data) {
				return callback(null, data);
			}

			callback(null, JSON.parse(data));

		});

	}

	onProviderError(error) {

		debug('#onProviderError', error);

		if(!error) {
			return;
		}

		this.activateNextProvider();

	}

	activateNextProvider() {

		debug('#activateNextProvider');

		let currentProvider = this.activeProvider;
		this.activeProvider = (currentProvider + 1) % this.providers.length;

		this.startActiveProvider();

		this.emit('info', {message: `Provider changed to ${this.providers[this.activeProvider].name}`});

	}

	startActiveProvider() {

		debug('#startActiveProvider');

		this.notifyActiveProvider();

	}

	notifyActiveProvider() {

		debug('#notifyActiveProvider');

		this.providers[this.activeProvider].process();

	}

}

module.exports = InfiniteMailer;