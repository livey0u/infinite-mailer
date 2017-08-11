# Infinite Emailer

A redis based email service module with 4 cloud email transport support. 
1. SendGrid
2. Mailgun
3. Mandrill
4. Amazon SES
If one of the cloud email provider goes down, the next one is activated. 

## Installation

```
npm install livey0u/infinite-mailer
```

## Initialization

```
const InfiniteMailer = require('infinite-mailer');
// default values
const config = {
	providers: [{
		name: 'sendgrid', // required
		apiKey: 'SG.**',  // required
		successCodes: [200, 202],
		failureCodes: [500],
		sandbox: true,
		batchLimit: 1000  // max 1000
	}, {
		name: 'mandrill',  // required
		apiKey: '**',      // required
		successCodes: ['sent'],
		failureCodes: ['Invalid_Key', 'PaymentRequired', 'GeneralError'],
		batchLimit: 1000  // max 1000
	}, {
		name: 'mailgun',   // required
		apiKey: 'key-**',  // required
		domain: 'your.example.domain',  // required
		successCodes: [200],
		failureCodes: [400, 401, 402, 404, 500, 502, 503, 504],
		sandbox: true,
		batchLimit: 1000  // max 1000
	}, {
		name: 'aws-ses',  // required
		apiKey: '*',      // required
		secret: '*+*',    // required
		region: 'us-east-1',  // required
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
```

Providers array cannot be empty. Providers are activated in the same order in the array.

```
let infiniteMailer = new InfiniteMailer(config);
infiniteMailer.on('sent', (email) => console.log(email));
infiniteMailer.on('error', (email) => console.log(email));

```
Since, by default emails are queued & sent asynchronously, details of sending process is emitted through events.
Importantly `error` events must be listened & `error.type` "critical" events needs to be monotired.
These type error events can be validation error while sending emails, connectivity errors or redis errors.

## API

```
let email = {
  "content": {
    "subject": "First Email",      // Required, templatable
    "sender": {                    // Required, all email address fields are having same properties, name(optional) & email
      "email": "user@domain.com",
      "name": "User"
    },
    "receivers": [{                // Required. "receiver" objects has one extra property, "variables", key value pairs to be embedded in email
      "email": "user2@domain.com",
      "name": "User",
      "variables": {
      	"properties": "to be",
      	"embedded": "in email"
      }
    }],
    "cc": {
      "email": "tamilvendhank@gmail.com",
      "name": "Tamil Vendhan"
    },
    "bcc": {
      "email": "tamilvendhan.k@gmail.com",
      "name": "Tamil Vendhan"
    },
    "message": {											  // Required. 
      "html": "<h1>Hi, {{name}}</h1>",  // Required. Handlebars template
    },
    "replyTo": {
      "email": "tamilvendhan.k@yahoo.com",
      "name": "Tamil Vendhan"
    }
  }
};
infiniteMailer.send(email, (error) => {
	if(error) {
	  return console.log(error);
  }
  console.log('queued');
});
```

#### Notes
* Domain name verification on initialized providers must be done separately.
* Except AWS SES, other providers supports batching by default. For them, we can send batch emails(max 1000) at once. 
* With AWS SES, batch emails are accecpted & kept on a queue as separate emails & they are sent one at a time.
* In case of failure scenarios with SES, pending emails in the queue are grouped as batch email & given to next provider to send in single call.
