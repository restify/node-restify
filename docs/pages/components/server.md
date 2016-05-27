# Events

Restify servers emit all the events from the node
[http.Server](http://nodejs.org/docs/latest/api/http.html#http_class_http_server)
and have several restify-specific events you want to listen on.

## NotFound

`function (request, response, error, cb) {}`

When a client request is sent for a URL that does not exist, restify
will emit this event. Note that restify checks for listeners on this
event, and if there are none, responds with a default 404 handler.  It
is expected that if you listen for this event, you respond to the client.

## MethodNotAllowed

`function (request, response, error, cb) {}`

When a client request is sent for a URL that does exist, but you have
not registered a route for that HTTP verb, restify will emit this
event. Note that restify checks for listeners on this event, and if
there are none, responds with a default 405 handler.  It
is expected that if you listen for this event, you respond to the client.

## VersionNotAllowed

`function (request, response, error, cb) {}`

When a client request is sent for a route that exists, but does not
match the version(s) on those routes, restify will emit this
event. Note that restify checks for listeners on this event, and if
there are none, responds with a default 400 handler.  It
is expected that if you listen for this event, you respond to the client.

## UnsupportedMediaType

`function (request, response, error, cb) {}`

When a client request is sent for a route that exist, but has a `content-type`
mismatch, restify will emit this event. Note that restify checks for listeners
on this event, and if there are none, responds with a default 415 handler.  It
is expected that if you listen for this event, you respond to the client.

## after

`function (request, response, route, error) {}`

Emitted after a route has finished all the handlers you registered.
You can use this to write audit logs, etc.  The route parameter will be
the `Route` object that ran.  Note that when you are using the default
404/405/BadVersion handlers, this event will still be fired, but route will
be `null`. If you have registered your own listeners for those, this event
will not be fired unless you invoke the `cb` argument that is provided with
them.

## uncaughtException

`function (request, response, route, error) {}`

Emitted when some handler throws an uncaughtException somewhere in the chain and
only when 'handleUncaughtExceptions' is set to true on the restify server. The
restify server has a default handler for this event - which is to just call
`res.send(error)`, and lets the built-ins in restify handle transforming, but
you can override the default handler to do whatever you want.


# Properties

A restify server has the following properties on it:

|Name|Type|Description|
|--------|--------|---------------|
|name|String|name of the server|
|version|String|Array|default version to use in all routes|
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

## pre()

Allows you to add in handlers that run *before* routing occurs. This gives you
a hook to change request headers and the like if you need to. Note that
`req.params` will be undefined, as that's filled in *after* routing.

```js
server.pre(function(req, res, next) {
  req.headers.accept = 'application/json';  // screw you client!
  return next();
});
```

You can also clean up URLs before routes are matched with the built in
`restify.pre.sanitizePath`. This [re-implements v1.4 behaviour](https://github.com/restify/node-restify/wiki/1.4-to-2.0-Migration-Tips#trailing--characters)

```js
server.pre(restify.pre.sanitizePath());
```

## use()

Allows you to add in handlers that run no matter what the route.
