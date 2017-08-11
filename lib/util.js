const fs = require('fs');

const EMAIL_REGEX = /^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;
const DOMAIN_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/i;

exports.isValidEmail = (email) => {

	if(typeof email !== 'string' || !email.trim()) {
		return false;
	}

	return EMAIL_REGEX.test(email);

};

exports.isValidEmailAddressesList = (emailAddresses) => {

	if(!Array.isArray(emailAddresses)) {
		return false;
	}

	for(let emailAddress of emailAddresses) {

		if(!emailAddress || typeof emailAddress !== 'object') {
			return false;
		}

		if(!exports.isValidEmail(emailAddress.email)) {
			return false;
		}

		if(emailAddress.name && typeof emailAddress.name !== 'string') {
			return false;
		}

	}

	return true;

};

exports.isValidReceiversList = (receivers) => {

	if(!exports.isValidEmailAddressesList(receivers)) {
		return false;
	}

	for(let receiver of receivers) {

		if(receiver.variables && typeof receiver.variables !== 'object') {
			return false;
		}

	}

	return true;

};

exports.isValidAttachmentsList = (attachments) => {

	if(!Array.isArray(attachments)) {
		return false;
	}

	for(let attachment of attachments) {
		
		if(!attachment || typeof attachment !== 'object') {
			return false;
		}

		if(attachment.filename && typeof attachment.filename !== 'string' || !attachment.filename.trim()) {
			return false;
		}

		if(typeof attachment.filepath !== 'string' || !attachment.filepath.trim()) {
			return false;
		}

		if(!fs.existsSync(attachment.filepath)) {
			return false;
		}

		if(attachment.disposition && ['attachment', 'inline'].indexOf(attachment.disposition) === -1) {
			return false;
		}

	}

	return true;

};

exports.isValidEmailMessage = (message) => {

	if(!message || typeof message !== 'object') {
		return false;
	}

	if(!message.text && !message.html) {
		return false;
	}

	if(message.text && (typeof message.text !== 'string' || !message.text.trim())) {
		return false;
	}

	if(message.html && (typeof message.html !== 'string' || !message.html.trim())) {
		return false;
	}

	return true;

};

exports.emailObjectToString = (emailObject) => {

	if(!emailObject) {
		return '';
	}

	if(emailObject.name && emailObject.email) {
		return `${emailObject.name} <${emailObject.email}>`;
	}

	return emailObject.email;

};

exports.emailPayloadToBatches = (emailPayload, batchSize) => {

	if(batchSize === -1) {
		return [emailPayload];
	}

	let batches = [];
	let receivers = emailPayload.content.receivers;

	while(receivers.length) {
		let batchedReceivers = receivers.splice(0, batchSize);
		emailPayload.content.receivers = batchedReceivers;
		batches.push(emailPayload);
	}

	return batches;

};

exports.isValidDomain = (domain) => {

	if(typeof domain !== 'string' || !domain.trim()) {
		return false;
	}

	return DOMAIN_REGEX.test(domain);

};