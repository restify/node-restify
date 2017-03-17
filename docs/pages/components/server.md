# Creating a server

A restify server object is the main interface through which you will register
routes and handlers for incoming requests. A server object will be returned
to you using the `createServer()` method:

```js
var restify = require('restify');
var server = restify.createServer();
```

The `createServer()` method takes the following options:

|Option|Type|Description|
|----------|--------|---------------|
|certificate|String|Buffer|If you want to create an HTTPS server, pass in a PEM-encoded certificate and key|
|key|String|Buffer|If you want to create an HTTPS server, pass in a PEM-encoded certificate and key|
|formatters|Object|Custom response formatters for `res.send()`|
|handleUncaughtExceptions|Boolean|When true (default is false) restify will use a domain to catch and respond to any uncaught exceptions that occur in it's handler stack|
|log|Object|You can optionally pass in a [bunyan](https://github.com/trentm/node-bunyan) instance; not required|
|name|String|By default, this will be set in the `Server` response header, default is `restify`. Pass empty string to unset the header. |
|spdy|Object|Any options accepted by [node-spdy](https://github.com/indutny/node-spdy)|
|version|String|Array|A default version to set for all routes|
|handleUpgrades|Boolean|Hook the `upgrade` event from the node HTTP server, pushing `Connection: Upgrade` requests through the regular request handling chain; defaults to `false`|
|httpsServerOptions|Object|Any options accepted by [node-https Server](http://nodejs.org/api/https.html#https_https). If provided the following restify server options will be ignored: spdy, ca, certificate, key, passphrase, rejectUnauthorized, requestCert and ciphers; however these can all be specified on httpsServerOptions.|
|strictRouting|Boolean|(Default=`false`). If set, Restify will treat "/foo" and "/foo/" as different paths.|


# Properties

A restify server has the following properties on it:

|Name|Type|Description|
|--------|--------|---------------|
|name|String|name of the server|
|version|String|Array|default version(s) to use in all routes|
|log|Object|[bunyan](https://github.com/trentm/node-bunyan) instance|
|acceptable|Array(String)|list of content-types this server can respond with|
|url|String|Once listen() is called, this will be filled in with where the server is running|

# Methods

## address()

Wraps node's [address()](http://nodejs.org/docs/latest/api/net.html#net_server_address).

## listen(port, [host], [callback])

Wraps node's [listen()](http://nodejs.org/docs/latest/api/net.html#net_server_listen_path_callback).

## listen(path, [callback])

Wraps node's [listen()](http://nodejs.org/docs/latest/api/net.html#net_server_listen_path_callback).

## close()

Wraps node's [close()](http://nodejs.org/docs/latest/api/net.html#net_event_close).

## pre(handler)

* `handler` {Function | Array}

Allows you to add handlers that run for all routes. *before* routing occurs.
This gives you a hook to change request headers and the like if you need to.
Note that `req.params` will be undefined, as that's filled in *after* routing.
Takes a function, or an array of functions.

```js
server.pre(function(req, res, next) {
  req.headers.accept = 'application/json';
  return next();
});
```

For example, `pre()` can be used to deduplicate slashes in URLs:
[plugin](https://github.com/restify/plugins):

```js
var plugins = require('restify-plugins');
server.pre(plugins.dedupeSlashes());
```

## use(handler)

* `handler` {Function | Array}

Allows you to add in handlers that run for all routes. Note that handlers added
via `use()` will run only after the router has found a matching route. If no
match is found, these handlers will never run. Takes a function, or an array
of functions.

## inflightRequests()

Returns the number of inflight requests currently being handled by the server.

## debugInfo()

Returns debugging information about the current state of the server.

# Events

In additional to emitting all the events from node's
[http.Server](http://nodejs.org/docs/latest/api/http.html#http_class_http_server),
restify servers also emit a number of additional events that make building REST
and web applications much easier.

## Errors

Restify handles errors as first class citizens. When an error object is passed
to the `next()` function, an event is emitted on the server object, and the
error object will be serialized and sent to the client. An error object is any
object that passes an `instanceof Error` check.

Before the error object is sent to the client, the server will fire an event
using the name of the error. This creates opportunities to do logging, metrics,
or payload mutation based on the type of error. For example:

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

Inside the error event listener, it is also possible to change the payload
if so desired. To do so, simply set your custom response on the `body` property
of the error. For example, it is common to send a custom 500 response:

```js
server.on('InternalServer', function(req, res, err, callback) {
    err.body = 'Sorry, an error occurred!';
    return callback();
});
```

Note that the signature is identical for all error events emitted. The listener
is invoked with the following signature:

```js
function(req, res, err, callback) { }
```

* req - the request object
* res - the response object
* err - the error object
* callback - a callback function to invoke


When using this feature in conjunction with
[restify-errors](https://github.com/restify/errors), restify will emit events
for all of the basic http errors:

* 400 BadRequestError
* 401 UnauthorizedError
* 402 PaymentRequiredError
* 403 ForbiddenError
* 404 NotFoundError
* 405 MethodNotAllowedError
* 406 NotAcceptableError
* 407 ProxyAuthenticationRequiredError
* 408 RequestTimeoutError
* 409 ConflictError
* 410 GoneError
* 411 LengthRequiredError
* 412 PreconditionFailedError
* 413 RequestEntityTooLargeError
* 414 RequesturiTooLargeError
* 415 UnsupportedMediaTypeError
* 416 RangeNotSatisfiableError (node >= 4)
* 416 RequestedRangeNotSatisfiableError (node 0.x)
* 417 ExpectationFailedError
* 418 ImATeapotError
* 422 UnprocessableEntityError
* 423 LockedError
* 424 FailedDependencyError
* 425 UnorderedCollectionError
* 426 UpgradeRequiredError
* 428 PreconditionRequiredError
* 429 TooManyRequestsError
* 431 RequestHeaderFieldsTooLargeError
* 500 InternalServerError
* 501 NotImplementedError
* 502 BadGatewayError
* 503 ServiceUnavailableError
* 504 GatewayTimeoutError
* 505 HttpVersionNotSupportedError
* 506 VariantAlsoNegotiatesError
* 507 InsufficientStorageError
* 509 BandwidthLimitExceededError
* 510 NotExtendedError
* 511 NetworkAuthenticationRequiredError


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

### restifyError

This event is emitted following all error events as a generic catch all. It is
recommended to use specific error events to handle specific errors, but this
event can be useful for metrics or logging. If you use this in conjunction with
other error events, the most specific event will be fired first, followed by
this one:

```js
server.get('/', function(req, res, next) {
  return next(new InternalServerError('boom'));
});

server.on('InternalServer', function(req, res, err, callback) {
  // this will get fired first, as it's the most relevant listener
  return next();
});

server.on('restifyError', function(req, res, err, callback) {
  // this is fired second.
  return next();
});
```

### FormatterError

This event is fired when an async formatter returns an error as a result of
calling `res.send()`. Unlike other error events, if you listen this event, it
is expected that you flush a response. Once a formatter has returned an error,
restify cannot make any assumptions about how to format the content. It is up
to you to figure out how to best do that.

```js
server.on('FormatterError', function(req, res, route, err) {
  // err is a formatter error - can't sa
  res.end('unsafe to call res.send, in case formatter blows up again!');
});
```


## after

After each request has been fully serviced, an `after` event is fired. This
event can be hooked into to handle audit logs and other metrics. Note that
flushing a response does not necessarily correspond with an `after` event.
restify considers a request to be fully serviced when either:

1) The handler chain for a route has been fully completed
2) An error was returned to `next()`, and the corresponding error events have
   been fired for that error type

The signature is for the after event is as follows:

```js
function(req, res, route, error) { }
```

* req - the request object
* res - the response object
* route - the route object that serviced the request
* error - the error passed to `next()`, if applicable

Note that when the server automatically responds with a
NotFound/MethodNotAllowed/VersionNotAllowed, this event will still be fired.


## pre

Before each request has been routed, a `pre` event is fired. This event can be
hooked into handle audit logs and other metrics. Since this event fires
*before* routing has occured, it will fire regardless of whether the route is
supported or not, e.g. requests that result in a `404`.

The signature for the `pre` event is as follows:

```js
function(req, res) {}
```
* req - the request object
* res - the response object

Note that when the server automatically responds with a
NotFound/MethodNotAllowed/VersionNotAllowed, this event will still be fired.


## routed

A `routed` event is fired after a request has been routed by the router, but
before handlers specific to that route has run.

The signature for the `routed` event is as follows:

```js
function(req, res, route) {}
```

* req - the request object
* res - the response object
* route - the route object that serviced the request

Note that this event will *not* fire if a requests comes in that are not
routable, i.e. one that would result in a `404`.


##

## uncaughtException

If the restify server was created with `handleUncaughtExceptions: true`,
restify will leverage [domains](https://nodejs.org/api/domain.html) to handle
thrown errors in the handler chain. Thrown errors are a result of an explicit
`throw` statement, or as a result of programmer errors like a typo or a null
ref. These thrown errors are caught by the domain, and will be emitted via this
event. For example:

```js
server.get('/', function(req, res, next) {
    res.send(x);  // this will cause a ReferenceError
    return next();
});

server.on('uncaughtException', function(req, res, route, err) {
    // this event will be fired, with the error object from above:
    // ReferenceError: x is not defined
});
```

If you listen to this event, you __must__ send a response to the client. This
behavior is different from the standard error events. If you do not listen to
this event, restify's default behavior is to call `res.send()` with the error
that was thrown.

The signature is for the after event is as follows:

```js
function(req, res, route, error) { }
```

* req - the request object
* res - the response object
* route - the route object that serviced the request
* error - the error passed to `next()`, if applicable

## close

Emitted when the server closes.
