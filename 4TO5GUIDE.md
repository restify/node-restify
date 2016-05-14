
# restify 4.x to 5.x migration guide


## Introduction

restify 5.0 is finally here! And a great big thank you to all of our
contributors. 5.x fixes a ton of bugs, adds some new features, and introduces
some breaking changes. This guide helps make sense of all the major changes
that have happened since the last 4.x release. A more detailed change log can
be found in CHANGES.md.


### restify-plugins

Plugins, which used to available on the `restify.plugins` namespace and the
`restify.pre` namespace, now live in their own
[repository](https://github.com/restify/plugins) and are published
[independently on npm](https://www.npmjs.com/restify-plugins). This gives us a
lot more flexibility to make progress in both repos independently. All the
existing plugins are available in the repo, minus CORS. We'll touch on CORS a
little more below.


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

restify's `NotFound` has now been normalized to act like other error events.
Previously, the `NotFound` event required you to send a response, or else it
would hang. It has now been normalized along with the error events:

```js
server.on('NotFound', function(req, res, err, cb) {
  // do some logging or metrics collection here. if you want to send a custom
  // response, you can do so here by setting the response on the body of the
  // error object.
  err.body = 'whoops! can't find your stuff!'; // the body of the error becomes the response
  return cb();
});
```

### domains

In 4.x, restify utilized domains by default. Any errors captured by the domain
could be handled to via the `server.on('uncaughtException', ...` event.
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

### CORS

CORS has been removed from restify core. That means the existing CORS plugin is
no longer compatible with 5.x. A [new CORS
plugin](https://github.com/restify/plugins/pull/10) is currently in development
in the restify-plugins repo. It's a brand new rewrite of CORS and aims to
address all the shortcomings of the previous plugin. All that's left is to get
some tests in to verify the behavior.

If you're using CORS, we'd love to get your help testing this thing and getting
it out the door!


### strict routing

TBD

### res.sendRaw()

restify has a concept of formatters, where each formatter is executed to format
a the content of a response before sending it out. A new method,
`res.sendRaw()`, has been added which allows bypassing of the formatters in
scenarios where you have preformatted content (pre-gzipped, pre-JSON
stringified, etc.). `sendRaw` has the same signature as `send`.


