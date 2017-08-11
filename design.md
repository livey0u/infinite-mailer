* Service initialized with set of email providers.
* First provider is activated by default.
* Email requests are pushed to service level queue.
* Service provider will ask for email job.
* A job from service level queue will be moved to provider queue.
* Provider attempts to send the email from its queue.
* If succeeds, asks for next job.
* If fails & if the error is due to 3rd party server related issue, 
	returns the email object with remaining receivers in it(ie: receivers in returned email object wont have the sent receivers)
* Service will activate another provider.
* No logger instance taken.
* Service class & Provider classes emits events(error, sent, etc)
* User of the module can listen to the events to log them.

Reasons:
* All providers has batch limit, except AWS SES.
* AWS SES does not support batching.