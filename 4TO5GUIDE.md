
# restify 4.x to 5.x migration guide


## Introduction

restify 5.0 is finally here! And a great big thank you to all of our
contributors. 5.x fixes a ton of bugs, adds some new features, and introduces
some breaking changes. This guide helps make sense of all the major changes
that have happened since the last 4.x release. A more detailed change log can
be found in CHANGES.md.


#### queryParser() and bodyParser()

By default, queryParser and bodyParser no longer map req.query and req.body to
req.params. To get the old behavior, please enable the `mapParams` behavior
with these plugins.


### restify-errors

Errors, which used to be available on the `restify.errors` namespace, now live
in their own [repository](https://github.com/restify/errors) and are published
[independently on npm](https://www.npmjs.com/package/restify-errors).
`restify-errors` can be used independently of restify in any of your other
projects for customizable error classes and chained errors.


### restify-clients

All restify clients have been broken out into their own
[repository](https://github.com/restify/clients), and are published
[independently on npm](https://www.npmjs.com/package/restify-clients).


### server.on('restifyError', ...)

restify now emits a generic error event. This error event will be fired for all
errors passed to `next()`. If you have specific listeners attached for a class
of error, the most specific one will be fired first, with the generic one being
fired last.

```js
// in some route, create a 500
server.get('/', function(req, res, next) {
  return next(new InternalServerError('oh noes!'));
  // this will hit the InternalServerError FIRST, allowing you to handle it some fashion,
  // before firing restifyError event. the semantics of the generic handler means it should
  // always be fired, but doesn't mean we shouldn't allow you to handle it first within
  // the error handler they care about. this is only possible if we fire events in serial.
});

// handle 500s
server.on('InternalServer', function(req, res, err, cb) {
  // this event is fired first. you can annotate errors here by saying
  // err.handled = true, because we must ALWAYS fire the generic handler after.
  err.handled = true;
  return cb();
});

// generic error handler
server.on('restifyError', function(req, res, err, cb) {
  // this event is fired last. do some generic metrics/logging
  if (!err.handled) {
    // do something
  }
  return cb();
});
```

### server.on('redirect', ...)

restify now emits a redirect event when `res.redirect()` is used. The event is
fired with the new location of the redirect.

```js
SERVER.on('redirect', function (newLocation) {
  // newLocation is the new url we redirected to.
});
```

### server.on('NotFound', ...)
### server.on('MethodNotAllowed', ...)
### server.on('VersionNotAllowed', ...)
### server.on('UnsupportedMediaType', ...)

restify's error events for these four types of errors have now been normalized
to act like other error events. Previously, listening to these events would
require you to send a response. It has now been normalized to work like the
other error events:

```js
server.on('NotFound', function(req, res, err, cb) {
  // do some logging or metrics collection here. if you want to send a custom
  // response, you can do so here by setting the response on the body of the
  // error object.
  err.body = 'whoops! can't find your stuff!'; // the body of the error becomes the response
  return cb();
});
```


### CORS

CORS has been removed from restify core. For CORS support, please use
[TabDigital's](https://github.com/TabDigital/restify-cors-middleware) plugin.

### strict routing

Strict routing is now supported via the `strictRouting` option. This allows
differentiation of routes with trailing slashes. The default value is `false`,
which mimics the behavior in 4.x which is to strip trailing slashes.

```js
var server = restify.createServer({
    strictRouting: true
});
// these two routes are distinct with strictRouting option
server.get('/foo/', function(req, res, next) { });
server.get('/foo', function(req, res, next) { });
```


### res.sendRaw()

restify has a concept of formatters, where each formatter is executed to format
a the content of a response before sending it out. A new method,
`res.sendRaw()`, has been added which allows bypassing of the formatters in
scenarios where you have preformatted content (pre-gzipped, pre-JSON
stringified, etc.). `sendRaw` has the same signature as `send`.


### Removal of undocumented APIs

Previous versions of restify had some undocumented exports on the main object.
These have been removed as of 5.x. These include:

* `restify.CORS` - due to removal of CORS from core
* `restify.httpDate` - undocumented
* `restify.realizeUrl` - undocumented


### next(err) & res.send(err)

To help reduce unintentional exposure of errors to the client, restify no
longer does special JSON serialization for Error objects. For example:

```js
server.get('/sendErr', function(req, res, next) {
  res.send(new Error('where is my msg?'));
  return next();
});

server.get('/nextErr', function(req, res, next) {
  return next(new Error('where is my msg?'));
});
```

```sh
$ curl -is localhost:8080/sendErr
HTTP/1.1 410 Gone
Content-Type: application/json
Content-Length: 37
Date: Fri, 03 Jun 2016 20:17:48 GMT
Connection: keep-alive

{}

$ curl -is localhost:8080/nextErr
HTTP/1.1 410 Gone
Content-Type: application/json
Content-Length: 37
Date: Fri, 03 Jun 2016 20:17:48 GMT
Connection: keep-alive

{}
```

The response is an empty object because `JSON.stringify(err)` returns an empty
object. In order to get properly serialized Errors, the preferred method is to
use restify-errors, which will have defined `toJSON` methods. Alternatively,
if you have custom Error classes, you can define a `toJSON` method which is
invoked when your Error is being stringified. If you have many custom error
types, consider using restify-errors to help you create and manage them easily.
Lastly, you can use restify-errors to opt-in to automatic `toJSON`
serialization:

```js
var errs = require('restify-errors');

server.get('/', function(req, res, next) {
  res.send(new errs.GoneError('gone girl'));
  return next();
});
```

```sh
$ curl -is localhost:8080/
HTTP/1.1 410 Gone
Content-Type: application/json
Content-Length: 37
Date: Fri, 03 Jun 2016 20:17:48 GMT
Connection: keep-alive

{"code":"Gone","message":"gone girl"}
```

## Deprecations

The following are still currently supported, but are on life support and may be
removed in future versions. Usage of these features will cause restify to spit
out deprecation warnings in the logs.


### domains

In 4.x, restify utilized domains by default. Any errors captured by the domain
could be handled to via the `server.on('uncaughtException', ...)` event.
However, it was not immediately obvious that this behavior was happening by
default, and many errors often went unhandled or unnoticed by end users.

With domains being deprecated, we've opted to turn domains off by default. If
you want to use domains, you can turn them back on via the
`handleUncaughtExceptions` option when you create the server:

```js
var server = restify.createServer({
    handleUncaughtExceptions: true
});
```

### next.ifError()

The `next.ifError()` feature leveraged domains under the hood. This feature is
also deprecated, and will only be available to you if the
`handleUncaughtExceptions` flag is set to true.
