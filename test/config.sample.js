module.exports = {
	providers: [{
		name: 'sendgrid',
		apiKey: 'SG.*',
		successCodes: [200, 202],
		failureCodes: [500],
		sandbox: true,
		batchLimit: 1000
	}, {
		name: 'mandrill',
		apiKey: '*',
		successCodes: ['sent'],
		failureCodes: ['Invalid_Key', 'PaymentRequired', 'GeneralError'],
		batchLimit: 1000
	}, {
		name: 'mailgun',
		apiKey: 'key-*',
		domain: 'sample.mailgun.org',
		successCodes: [200],
		failureCodes: [400, 401, 402, 404, 500, 502, 503, 504],
		sandbox: true,
		batchLimit: 1000
	}, {
		name: 'aws-ses',
		apiKey: '*',
		secret: '*',
		region: 'us-east-1',
		successCodes: [200],
		failureCodes: [500],
		sandbox: true,
		sendRate: 1
	}],
	redis: {
		prefix: 'Test',
		host: 'localhost'
	}
};