const redis = require('redis');
const should = require('should');

const ProviderBase = require('../../lib/providers/base');

describe('ProviderBase Tests', () => {

	describe('#constructor', () => {

		describe('Positive tests', () => {

			it('Should create provider base instance', () => {

				let config = {
					redisClient: redis.createClient(),
					redisKeyPrefix: 'TESTING',
					onReady: (queueName, cb) => {cb();},
					onError: (error, email) => {},
					provider: {
						name: 'Test',
						apiKey: 'sampleApiKey',
						successCodes: [200],
						failureCodes: [404],
						batchLimit: 1000
					}
				};

				let provider = new ProviderBase(config);
				should.exist(provider);
				should.exist(provider.name);
				should.equal(provider.name, config.provider.name);
				should.exist(provider.redisClient);
				should.exist(provider.redisKeyPrefix);
				should.exist(provider.providerQueueName);
				should.exist(provider.onReady);
				should.exist(provider.onError);
				should.exist(provider.active);
				should.exist(provider.sandbox);
				should.exist(provider.successCodes);
				should.exist(provider.providerUnavailableCodes);
				should.exist(provider.batchLimit);
				should.equal(provider.batchLimit, config.provider.batchLimit);
				
			});

			it('Batch limit should be -1 if "batchLimit" parameter is not set', () => {

				let config = {
					redisClient: redis.createClient(),
					redisKeyPrefix: 'TESTING',
					onReady: (queueName, cb) => {cb();},
					onError: (error, email) => {},
					provider: {
						name: 'Test',
						apiKey: 'sampleApiKey',
						successCodes: [200],
						failureCodes: [404]
					}
				};

				let provider = new ProviderBase(config);
				should.exist(provider);
				should.exist(provider.name);
				should.equal(provider.name, config.provider.name);
				should.exist(provider.redisClient);
				should.exist(provider.redisKeyPrefix);
				should.exist(provider.providerQueueName);
				should.exist(provider.onReady);
				should.exist(provider.onError);
				should.exist(provider.active);
				should.exist(provider.sandbox);
				should.exist(provider.successCodes);
				should.exist(provider.providerUnavailableCodes);
				should.exist(provider.batchLimit);
				should.equal(provider.batchLimit, -1);
				
			});

		});

		describe('Negative tests', () => {

			it('Should throw "Invalid provider config" if provider config is invalid', () => {

				let config = {};

				should(() => new ProviderBase(config)).throw('Invalid provider config');
				
			});

			it('Should throw "Invalid provider API Key" if provider api key is invalid', () => {

				let config = {
					provider: {}
				};

				should(() => new ProviderBase(config)).throw('Invalid provider API Key');
				
			});

			it('Should throw "Invalid provider success codes" for invalid "successCodes" parameter', () => {

				let config = {
					provider: {
						apiKey: 'sampleApiKey'
					}
				};

				should(() => new ProviderBase(config)).throw('Invalid provider success codes');
				
			});

			it('Should throw "Invalid provider failure codes" for invalid "failureCodes" parameter', () => {

				let config = {
					provider: {
						apiKey: 'sampleApiKey',
						successCodes: [200]
					}
				};

				should(() => new ProviderBase(config)).throw('Invalid provider failure codes');
				
			});

			it('Should throw "Batch limit must be a number" if "batchLimit" parameter is given but not a number', () => {

				let config = {
					provider: {
						apiKey: 'sampleApiKey',
						successCodes: [200],
						failureCodes: [404],
						batchLimit: 'notANumber'
					}
				};

				should(() => new ProviderBase(config)).throw('Batch limit must be a number');
				
			});

		});

	});

});