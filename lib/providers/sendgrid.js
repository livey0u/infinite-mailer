const _ = require('lodash');

const ProviderBase = require('./base');
const debug = require('debug')('InfiniteMailer:Sendgrid');

class Sendgrid extends ProviderBase {

  constructor(userConfig) {

    debug('#constructor', _.omit(userConfig, 'redisClient'));

    let defaultConfig = {
      provider: {
        successCodes: [200, 202],
        failureCodes: [500],
        sandbox: false,
        batchLimit: 1000
      }
    };

    let config = _.assign({}, defaultConfig, userConfig);
    
    super(config);
    this.client = require('sendgrid')(this.apiKey);
    
    debug('#constructor initialized');

  }

  doSend(emailBody, callback) {

    debug('#doSend', emailBody);
    
    let request = this.client.emptyRequest({
      method: 'POST',
      path: '/v3/mail/send',
      body: emailBody,
    });

    this.client.API(request, (error, response) => {
      debug('#doSend done', error, response);
      if(error) {
        return callback(null, error);
      }
      let formattedResponse = {code: response.statusCode, error: response.body};
      callback(null, formattedResponse);
    });

  }

  formatContent(email, callback) {

    debug('#formatContent', email);

    if (email.content.message.html) {
      email.content.message.html = email.content.message.html.replace(/{{/g, '-').replace(/}}/g, '-');
    }

    if (email.content.message.text) {
      email.content.message.text = email.content.message.text.replace(/{{/g, '-').replace(/}}/g, '-');
    }

    debug('#formatContent done', email);

    return callback(null, email);

  }

  buildEmailRequestBody(email, callback) {

    debug('#buildEmailRequestBody', email);

    let body = {
      content: [{
          type: 'text/html',
          value: email.content.message.html
        }
      ],
      from: email.content.sender,
      mail_settings: {
        bypass_list_management: {
          enable: true
        },
        sandbox_mode: {
          enable: this.sandbox
        }
      },
      reply_to: email.content.replyTo,
      subject: email.content.subject
    };

    let personalizations = [];
    let receivers = email.content.receivers;
    let bcc = email.content.bcc;
    let cc = email.content.cc;
    let subject = email.content.subject;

    for (let receiver of receivers) {

      let variables = receiver.variables;
      let personalization = {
        to: [{
          email: receiver.email,
          name: receiver.name
        }],
        bcc: [bcc],
        cc: [cc],
        subject: subject
      };

      for (let key in variables) {
        if (variables.hasOwnProperty(key)) {
          let value = variables[key];
          delete variables[key];
          variables[`-${key}-`] = value
        }
      }

      variables[`-name-`] = receiver.name;
      variables[`-email-`] = receiver.email;

      personalization.substitutions = variables;

      personalizations.push(personalization);

    }

    body.personalizations = personalizations;

    debug('#buildEmailRequestBody', body);

    callback(null, body);

  }

}

module.exports = Sendgrid;