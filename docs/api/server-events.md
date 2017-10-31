In additional to emitting all the events from node's
[http.Server](http://nodejs.org/docs/latest/api/http.html#http_class_http_server),
restify servers also emit a number of additional events that make building REST
and web applications much easier.

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
  return callback();
});

server.on('restifyError', function(req, res, err, callback) {
  // this is fired second.
  return callback();
});
```


### after

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

* `req` - the request object
* `res` - the response object
* `route` - the route object that serviced the request
* `error` - the error passed to `next()`, if applicable

Note that when the server automatically responds with a
NotFound/MethodNotAllowed/VersionNotAllowed, this event will still be fired.


### pre

Before each request has been routed, a `pre` event is fired. This event can be
hooked into handle audit logs and other metrics. Since this event fires
*before* routing has occured, it will fire regardless of whether the route is
supported or not, e.g. requests that result in a `404`.

The signature for the `pre` event is as follows:

```js
function(req, res) {}
```
* `req` - the request object
* `res` - the response object

Note that when the server automatically responds with a
NotFound/MethodNotAllowed/VersionNotAllowed, this event will still be fired.


### routed

A `routed` event is fired after a request has been routed by the router, but
before handlers specific to that route has run.

The signature for the `routed` event is as follows:

```js
function(req, res, route) {}
```

* `req` - the request object
* `res` - the response object
* `route` - the route object that serviced the request

Note that this event will *not* fire if a requests comes in that are not
routable, i.e. one that would result in a `404`.


### uncaughtException

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

* `req` - the request object
* `res` - the response object
* `route` - the route object that serviced the request
* `error` - the error passed to `next()`, if applicable

### close

Emitted when the server closes.