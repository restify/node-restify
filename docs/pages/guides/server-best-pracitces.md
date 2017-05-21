# Server Best Practices

This guide contains a collection of best practices to follow when using
restify. We recommend that you only deviate from these practices with good
reason and much thought. This advice is given from the perspective of running
restify in production at scale.

## Error Handling

It is important to differentiate between two classes of errors:

* Expected errors
* Exceptions

Expected errors are the code paths you identify upfront as possibly failing,
and your server should contain logic that gracefully handles those errors. A
great example of this is when your server makes an REST request to another
server. Network calls are not always successful, and a failed network call
doesn't necessarily mean there is a problem. This guide wont focus in one how
to gracefully handle this class of error, since every case will be different.
That being said, the rule of thumb should be to have your server self correct
if possible, and only expose errors to the client when absolutely necessary.

The second class of error, exceptions, are problems that arise due to logic
errors. For problems that the process can not recover from, an error will be
thrown. By default, restify will gracefully handle an `uncaughtException` error
for you by returning a `500` error to the client, however _this is not enough_.
When your service throws, it is in an unstable state. While the exception
itself was scoped to the specific request that caused it, the global state
shared across all of your incoming requests (both your own application logic
and your dependencies') are no longer in a trustworthy state. Letting your
server continue to chug along in the face of `uncaughtException`s is a bad
practice that can lead to memory leaks, security exploits, and degraded service
from your server. When your server emits an `uncaughtException`, it is best to
have the Node.js process stop accepting incoming connections, allowing existing
connections to complete before fully shutting down. Your server's upstream
load-balancer should be configured to route new incoming connections to another
service when this happens, and your process manager should be configured to
automatically restart the restify process once all existing connections are
drained.

> Note: if you specify your own `uncaughtException` handler to do this,
> remember to include `res.setHeader('Connection', 'close');` or your client
> will attempt to reuse the borked TCP connection. Not closing the connection
> manifests itself in a connection stalling.

For more information on handling exceptions at runtime, refer to the strong
words in the [Node.js documentation](https://nodejs.org/dist/latest-v7.x/docs/api/domain.html#domain_warning_don_t_ignore_errors)
