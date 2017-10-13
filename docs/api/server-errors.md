Restify handles errors as first class citizens. When an error object is passed
to the `next()` function, an event is emitted on the server object, and the
error object will be serialized and sent to the client. An error object is any
object that passes an `instanceof Error` check.

Before the error object is sent to the client, the server will fire an event
using the name of the error, without the `Error` part of the name. For example,
given an `InternalServerError`, the server will emit an `InternalServer` event.
This creates opportunities to do logging, metrics, or payload mutation based on
the type of error. For example:

```js
var errs = require('restify-errors');

server.get('/', function(req, res, next) {
    return next(new errs.InternalServerError('boom!'));
});

server.on('InternalServer', function(req, res, err, callback) {
    // before the response is sent, this listener will be invoked, allowing
    // opportunities to do metrics capturing or logging.
    myMetrics.capture(err);
    // invoke the callback to complete your work, and the server will send out
    // a response.
    return callback();
});
```

Inside the error event listener, it is also possible to change the serialization
method of the error if desired. To do so, simply implement a custom
`toString()` or `toJSON()`. Depending on the content-type and formatter being
used for the response, one of the two serializers will be used. For example,
given the folllwing example:

```js
server.on('restifyError', function(req, res, err, callback) {
    err.toJSON = function customToJSON() {
        return {
            name: err.name,
            message: err.message
        };
    };
    err.toString = function customToString() {
        return 'i just want a string';
    };
    return callback();
});
```

A request with an `accept: application/json` will trigger the `toJSON()`
serializer, while a request with `accept: text/plain` will trigger the
`toString()` serializer.

Note that the function signature for the error listener is identical for all
emitted error events. The signature is as follows:

```js
function(req, res, err, callback) { }
```

* `req` - the request object
* `res` - the response object
* `err` - the error object
* `callback` - a callback function to invoke


When using this feature in conjunction with
[restify-errors](https://github.com/restify/errors), restify will emit events
for all of the basic http errors:

* `400` - `BadRequestError`
* `401` - `UnauthorizedError`
* `402` - `PaymentRequiredError`
* `403` - `ForbiddenError`
* `404` - `NotFoundError`
* `405` - `MethodNotAllowedError`
* `406` - `NotAcceptableError`
* `407` - `ProxyAuthenticationRequiredError`
* `408` - `RequestTimeoutError`
* `409` - `ConflictError`
* `410` - `GoneError`
* `411` - `LengthRequiredError`
* `412` - `PreconditionFailedError`
* `413` - `RequestEntityTooLargeError`
* `414` - `RequesturiTooLargeError`
* `415` - `UnsupportedMediaTypeError`
* `416` - `RangeNotSatisfiableError` (node >= 4)
* `416` - `RequestedRangeNotSatisfiableError` (node 0.x)
* `417` - `ExpectationFailedError`
* `418` - `ImATeapotError`
* `422` - `UnprocessableEntityError`
* `423` - `LockedError`
* `424` - `FailedDependencyError`
* `425` - `UnorderedCollectionError`
* `426` - `UpgradeRequiredError`
* `428` - `PreconditionRequiredError`
* `429` - `TooManyRequestsError`
* `431` - `RequestHeaderFieldsTooLargeError`
* `500` - `InternalServerError`
* `501` - `NotImplementedError`
* `502` - `BadGatewayError`
* `503` - `ServiceUnavailableError`
* `504` - `GatewayTimeoutError`
* `505` - `HttpVersionNotSupportedError`
* `506` - `VariantAlsoNegotiatesError`
* `507` - `InsufficientStorageError`
* `509` - `BandwidthLimitExceededError`
* `510` - `NotExtendedError`
* `511` - `NetworkAuthenticationRequiredError`


Restify will also emit the following events:

### NotFound

When a client request is sent for a URL that does not exist, restify
will emit this event. Note that restify checks for listeners on this
event, and if there are none, responds with a default 404 handler.

### MethodNotAllowed

When a client request is sent for a URL that exists, but not for the requested
HTTP verb, restify will emit this event. Note that restify checks for listeners
on this event, and if there are none, responds with a default 405 handler.

### VersionNotAllowed

When a client request is sent for a route that exists, but does not
match the version(s) on those routes, restify will emit this
event. Note that restify checks for listeners on this event, and if
there are none, responds with a default 400 handler.

### UnsupportedMediaType

When a client request is sent for a route that exist, but has a `content-type`
mismatch, restify will emit this event. Note that restify checks for listeners
on this event, and if there are none, responds with a default 415 handler.