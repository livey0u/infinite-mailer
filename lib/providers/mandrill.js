const _ = require('lodash');
const mandrill = require('mandrill-api/mandrill');
const debug = require('debug')('InfiniteMailer:Mandrill');

const ProviderBase = require('./base');

class Mandrill extends ProviderBase {

  constructor(userConfig) {

    debug('#constructor', _.omit(userConfig, 'redisClient'));
    let defaultConfig = {
      provider: {
        successCodes: ['sent'],
        failureCodes: ['Invalid_Key', 'PaymentRequired', 'GeneralError'],
        batchLimit: 1000
      }
    };
    let config = _.assign({}, defaultConfig, userConfig);
    super(config);
    this.client = new mandrill.Mandrill(this.apiKey);

    debug('#constructor initialized');

  }

  doSend(message, callback) {

    debug('#doSend', message);

    this.client.messages.send({ message: message}, (result) => {
      debug('#doSend done', null, result);
      let successStatuses = ['sent', 'queued', 'scheduled'];
      let notSent = result.filter((email) => successStatuses.indexOf(email.status) === -1);
      this.emit('error', {type: 'info', message: 'Some messages are not sent', data: notSent});
      callback(null, { code: 'sent' });
    }, (error) => {
      debug('#doSend done', error, null);
      callback(null, { code: error.name, error: error.message });
    });

  }

  formatContent(email, callback) {

    return callback(null, email);

  }

  buildEmailRequestBody(email, callback) {

    debug('#buildEmailRequestBody', email);

    let receivers = email.content.receivers;
    let bcc = email.content.bcc ? email.content.bcc.email : null;
    let cc = email.content.cc ? email.content.cc.email : null;
    let subject = email.content.subject;
    let mergeVars = [];

    for (let receiver of receivers) {

      let variables = receiver.variables;
      let vars = [];
      let personalization = {
        rcpt: receiver.email,
        vars: vars
      };

      for (let key in variables) {
        if (variables.hasOwnProperty(key)) {
          vars.push({
            name: key,
            content: variables[key]
          });
        }
      }

      mergeVars.push(personalization);

    }

    var message = {
      html: email.content.message.html,
      subject: email.content.subject,
      from_email: email.content.sender.email,
      from_name: email.content.sender.name,
      to: email.content.receivers.map((receiver) => {
        receiver.type = 'to';
        return receiver;
      }),
      headers: {
        'Reply-To': email.content.replyTo.email
      },
      merge: true,
      merge_language: 'handlebars',
      merge_vars: mergeVars,
    };

    if(cc) {
      message.cc_address = cc;
    }

    if(bcc) {
      message.bcc_address = bcc;
    }

    callback(null, message);

  }

}

module.exports = Mandrill;