Best case:

1. MainModule asked to send an email.
2. MainModule splits the email into batches, put them in MainQueue & asks provider to send it.
3. If provider is not active, provider asks MainModule for an email to send.
	1. MainModule moves one email from MainQueue to ProviderQueue & provides with a EmailCopy.
	2. If provider cannot handle personalization,
		1. Provider puts the email copy into another queue(PrivateQueue)
		2. Sends all the images in the PrivateQueue.
		3. Returns to ProviderQueue
	3. If provider can handle personalization,
		1. Sends the EmailCopy
		2. Returns to ProviderQueue
	4. Removes OriginalEmail from the ProviderQueue
	5. Asks MainModule for another email.
4. If Provider is active, nothing happens till provider becomes inactive.
5. Once Provider becomes inactive, Step 3 is repeated.


Service Unavailable Scenario: 

1. User sends a 10000 receivers email, MainModule is initialized with all 4 providers with AWS-SES being 2.
2. MainModule splits the email into batches(10), put them in MainQueue & asks provider1 to send it.
3. Provider1 sends first batch, becomes unavailable while attempting to send the 2nd batch.
4. MainModule gets notified about it, with give 1000 receivers email object from Provider1.
5. MainModule puts that back into its queue, activates next one AWS SES, moves next batch to SESProviderQueue & provides SES Provider with a EmailCopy.
6. AWS SES create separate email for each receiver in that 1000 receivers list.
7. Put them in to a PrivateQueue.
8. Starts sending them one by one.
9. Around 500 email remaining in PrivateQueue, AWS SES becomes unavaiable.
10. The remaining 500 receivers are grouped into an Email Object & sent back to MainModule.
11. MainModule puts that back into the queue & activates the next one.
12. Other providers are same as Provider1.

Crash Scenarios:

* While sending email, OriginalEmail object is always kept in the ProviderQueue.
* OriginalEmail is removed only after the EmailCopy is processed successfully.
* Restarting from crash would initate the process from the inner most queue(ie: PrivateQueue)