
const should = require('should');
const async = require('async');
const sinon = require('sinon');
const eventDebug = require('event-debug');

const InfiniteMailer = require('../../lib');
const config = require('../config');
const sampleEmail = require('../../email');

describe('InfiniteMailer Functional Tests', () => {

	describe('Sendgrid#send', () => {

		describe('Send email test', () => {

			let infiniteMailer;
			// let apiMock;

			before((done) => {
				infiniteMailer = new InfiniteMailer(config);
				eventDebug(infiniteMailer);
				// apiMock = sinon.stub(infiniteMailer.providers[0].sg, 'API').yields(null, {statusCode: 202});
				done();
			});

			after((done) => {
				// apiMock.restore();
				done();
			});

			it('Should send email using default provider', (done) => {
				
				infiniteMailer.send(sampleEmail, (error) => {
					should.not.exist(error);
				});

				infiniteMailer.on('sent', (data) => {
					should.exist(data);
					done();
				});

				infiniteMailer.on('error', (data) => {
					should.not.exist(data);
					done();
				});

			});

		});

	});

	describe('Mandrill#send', () => {

		describe('Send email test', () => {

			let infiniteMailer;
			// let apiMock;

			before((done) => {
				let conf = JSON.parse(JSON.stringify(config));
				conf.providers = [conf.providers[1]];
				infiniteMailer = new InfiniteMailer(conf);
				eventDebug(infiniteMailer);
				// apiMock = sinon.stub(infiniteMailer.providers[0].sg, 'API').yields(null, {statusCode: 202});
				done();
			});

			after((done) => {
				// apiMock.restore();
				done();
			});

			it('Should send email using default provider', (done) => {
				
				infiniteMailer.send(sampleEmail, (error) => {
					should.not.exist(error);
				});

				infiniteMailer.on('sent', (data) => {
					should.exist(data);
					done();
				});

				infiniteMailer.on('error', (data) => {
					should.not.exist(data);
					done();
				});

			});

		});

	});

	describe('Mailgun#send', () => {

		describe('Send email test', () => {

			let infiniteMailer;
			// let apiMock;

			before((done) => {
				let conf = JSON.parse(JSON.stringify(config));
				conf.providers = [conf.providers[2]];
				infiniteMailer = new InfiniteMailer(conf);
				eventDebug(infiniteMailer);
				// apiMock = sinon.stub(infiniteMailer.providers[0].sg, 'API').yields(null, {statusCode: 202});
				done();
			});

			after((done) => {
				// apiMock.restore();
				done();
			});

			it('Should send email using default provider', (done) => {
				
				infiniteMailer.send(sampleEmail, (error) => {
					should.not.exist(error);
				});

				infiniteMailer.on('sent', (data) => {
					should.exist(data);
					done();
				});

				infiniteMailer.on('error', (data) => {
					should.not.exist(data);
					done();
				});

			});

		});

	});

	describe('AWSSES#send', () => {

		describe('Send email test', () => {

			let infiniteMailer;
			// let apiMock;

			before((done) => {
				let conf = JSON.parse(JSON.stringify(config));
				conf.providers = [conf.providers[3]];
				infiniteMailer = new InfiniteMailer(conf);
				eventDebug(infiniteMailer);
				// apiMock = sinon.stub(infiniteMailer.providers[0].sg, 'API').yields(null, {statusCode: 202});
				done();
			});

			after((done) => {
				// apiMock.restore();
				done();
			});

			it('Should send email using default provider', (done) => {
				
				infiniteMailer.send(sampleEmail, (error) => {
					should.not.exist(error);
				});

				infiniteMailer.on('sent', (data) => {
					should.exist(data);
					done();
				});

				infiniteMailer.on('error', (data) => {
					should.not.exist(data);
					done();
				});

			});

		});

	});

	describe.only('Automatic Failover test', () => {

		describe('SES is the last provider. Other providers are set to fail. Should switch providers till SES, finally expand the emails & send using SES', () => {

			let infiniteMailer;
			let sengGridMock;
			let mailgunMock;
			let mandrillMock;
			let sesMock;

			before((done) => {
				let conf = JSON.parse(JSON.stringify(config));
				infiniteMailer = new InfiniteMailer(conf);
				sengGridMock = sinon.stub(infiniteMailer.providers[0], 'doSend').yields(null, {code: 500});
				mandrillMock = sinon.stub(infiniteMailer.providers[1], 'doSend').yields(null, {code: 'Invalid_Key'});
				mailgunMock = sinon.stub(infiniteMailer.providers[2], 'doSend').yields(null, {code: 400});
				sesMock = sinon.stub(infiniteMailer.providers[3], 'sendToSingleReceiver').yields(null, {code: 200});
				done();
			});

			after((done) => {
				sengGridMock.restore();
				mandrillMock.restore();
				mailgunMock.restore();
				sesMock.restore();
				done();
			});

			it('Should send email using default provider', (done) => {

				let infoCallback = sinon.spy((info) => {});
				let errorCallback = sinon.spy((error) => {});
				let sentCallback = sinon.spy((data) => {
					should.equal(errorCallback.callCount, 0);
					// should.equal(infoCallback.callCount, 3);
					done();
				});

				infiniteMailer.on('sent', sentCallback);
				infiniteMailer.on('info', infoCallback);
				infiniteMailer.on('error', errorCallback);
				
				setTimeout(() => {
					infiniteMailer.send(sampleEmail, (error) => {
						should.not.exist(error);
					});
				}, 1000);

			});

		});

		describe('SES is first provider. For given batch email, emails should be splitted into single emails for SES. Once, SES returns error, all the emails should be grouped back & sent by next working provider.', () => {

			let infiniteMailer;
			let sengGridMock;
			let mailgunMock;
			let mandrillMock;
			let sesMock;

			before((done) => {
				let conf = JSON.parse(JSON.stringify(config));
				conf.providers = conf.providers.reverse();
				infiniteMailer = new InfiniteMailer(conf);
				sengGridMock = sinon.stub(infiniteMailer.providers[3], 'doSend').yields(null, {code: 200});
				mandrillMock = sinon.stub(infiniteMailer.providers[2], 'doSend').yields(null, {code: 'Invalid_Key'});
				mailgunMock = sinon.stub(infiniteMailer.providers[1], 'doSend').yields(null, {code: 400});
				sesMock = sinon.stub(infiniteMailer.providers[0], 'sendToSingleReceiver').yields(null, {code: 500});
				done();
			});

			after((done) => {
				sengGridMock.restore();
				mandrillMock.restore();
				mailgunMock.restore();
				sesMock.restore();
				done();
			});

			it('Should send email using default provider', (done) => {
				
				infiniteMailer.send(sampleEmail, (error) => {
					should.not.exist(error);
				});

				let infoCallback = sinon.spy((info) => {});
				let errorCallback = sinon.spy((error) => {});
				let sentCallback = sinon.spy((data) => {
					should.exist(data.content);
					should.exist(data.content.receivers);
					should.equal(data.content.receivers.length, 2);
					should.equal(errorCallback.callCount, 0);
					should.equal(infoCallback.callCount, 3);
					done();
				});

				infiniteMailer.on('sent', sentCallback);
				infiniteMailer.on('info', infoCallback);
				infiniteMailer.on('error', errorCallback);

			});

		});

	});

});