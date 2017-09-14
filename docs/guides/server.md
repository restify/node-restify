# Server Guide

Setting up a server is quick and easy. Here is a barebones echo server:

```js
var restify = require('restify');

function respond(req, res, next) {
  res.send('hello ' + req.params.name);
  next();
}

var server = restify.createServer();
server.get('/hello/:name', respond);
server.head('/hello/:name', respond);

server.listen(8080, function() {
  console.log('%s listening at %s', server.name, server.url);
});
```

Try hitting that with the following curl commands to get a feel for what
restify is going to turn that into:

```sh
$ curl -is http://localhost:8080/hello/mark -H 'accept: text/plain'
HTTP/1.1 200 OK
Content-Type: text/plain
Content-Length: 10
Date: Mon, 31 Dec 2012 01:32:44 GMT
Connection: keep-alive

hello mark


$ curl -is http://localhost:8080/hello/mark
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 12
Date: Mon, 31 Dec 2012 01:33:33 GMT
Connection: keep-alive

"hello mark"


$ curl -is http://localhost:8080/hello/mark -X HEAD -H 'connection: close'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 12
Date: Mon, 31 Dec 2012 01:42:07 GMT
Connection: close
```

Note that by default, curl uses `Connection: keep-alive`. In order to make the
HEAD method return right away, you'll need to pass `Connection: close`.

Since curl is often used with REST APIs, restify's plugins include a plugin to
work around this idiosyncrasy in curl. The plugin checks whether the user agent
is curl. If it is, it sets the Connection header to "close" and removes the
"Content-Length" header.

```js
server.pre(restify.plugins.pre.userAgentConnection());
```

## Sinatra style handler chains

Like many other Node.js based REST frameworks, restify leverages a Sinatra
style syntax for defining routes and the function handlers that service those
routes:

```js
server.get('/', function(req, res, next) {
  res.send('home')
  return next();
});

server.post('/foo',
  function(req, res, next) {
    req.someData = 'foo';
    return next();
  },
  function(req, res, next) {
    res.send(req.someData);
    return next();
  }
);
```

In a restify server, there are three distinct handler chains:

* `pre` - a handler chain executed prior to routing
* `use` - a handler chain executed post routing
* `{httpVerb}` - a handler chain executed specific to a route

All three handler chains accept either a single function, multiple functions,
or an array of functions.


## Universal pre-handlers: server.pre()

The `pre` handler chain is executed before routing. That means these handlers
will execute for an incoming request even if it's for a route that you did not
register. This can be useful for logging metrics or for cleaning up the
incoming request before routing it.

```js
// dedupe slashes in URL before routing
server.pre(restify.plugins.dedupeSlashes());
```


## Universal handlers: server.use()

The `use` handler chains is executed after a route has been chosen to service
the request. Function handlers that are attached via the `use()` method will be
run for all routes. Since restify runs handlers in the order they are
registered, make sure that all your `use()` calls happen before defining any
routes.

```js
server.use(function(req, res, next) {
    console.warn('run for all routes!');
    return next();
});
```


## Using next()

Upon completion of each function in the handler chain, you are responsible for
calling `next()`. Calling `next()` will move to the next function in the chain.

Unlike other REST frameworks, calling `res.send()` does not trigger `next()`
automatically. In many applications, work can continue to happen after
`res.send()`, so flushing the response is not synonmyous with completion of a
request.

In the normal case, `next()` does not typically take any parameters. If for
some reason you want to stop processing the request, you can call `next(false)`
to stop processing the request:

```js
server.use([
  function(req, res, next) {
    if (someCondition) {
      res.send('done!');
      return next(false);
    }
    return next();
  },
  function(req, res, next) {
    // if someCondition is true, this handler is never executed
  }
]);
```

`next()` also accepts any object for which `instanceof Error` is true, which
will cause restify to send that Error object as a response to the client. The
status code for the response will be inferred from the Error object's
`statusCode` property. If no `statusCode` is found, it will default to 500.
So the snippet below will send a serialized error to the client with an http
500:

```js
server.use(function(req, res, next) {
  return next(new Error('boom!'));
});
```

And this will send a 404, since the `NotFoundError` constructor provides a
value of 404 for `statusCode`:

```js
server.use(function(req, res, next) {
  return next(new NotFoundError('not here!'));
});
```

Calling `res.send()` with an Error object produces similar results, with this
snippet sending an http 500 with a serialized error the client:

```js
server.use(function(req, res, next) {
  res.send(new Error('boom!'));
  return next();
});
```

The difference between the two is that invoking `next()` with an Error object
allows you to leverage the server's event emitter.md#errors). This enables you
to handle all occurrences of an error type using a common handler. See the
Server API for more details.


## Routing

restify routing, in 'basic' mode, is pretty much identical to express/sinatra,
in that HTTP verbs are used with a parameterized resource to determine what
chain of handlers to run. Values associated with named placeholders are
available in `req.params`. That values will be URL-decoded before being
passed to you.

```js
function send(req, res, next) {
  res.send('hello ' + req.params.name);
  return next();
}

server.post('/hello', function create(req, res, next) {
  res.send(201, Math.random().toString(36).substr(3, 8));
  return next();
});
server.put('/hello', send);
server.get('/hello/:name', send);
server.head('/hello/:name', send);
server.del('hello/:name', function rm(req, res, next) {
  res.send(204);
  return next();
});
```

You can also pass in a [RegExp](https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/RegExp)
object and access the capture group with `req.params` (which will not
be interpreted in any way):

```js
server.get(/^\/([a-zA-Z0-9_\.~-]+)\/(.*)/, function(req, res, next) {
  console.log(req.params[0]);
  console.log(req.params[1]);
  res.send(200);
  return next();
});
```

Here any request like:

```sh
$ curl localhost:8080/foo/my/cats/name/is/gandalf
```

Would result in `req.params[0]` being `foo` and `req.params[1]` being
`my/cats/name/is/gandalf`.


Routes can be specified by any of the following http verbs - `del`, `get`,
`head`, `opts`, `post`, `put`, and `patch`.


```js
server.get(
    '/foo/:id',
    function(req, res, next) {
        console.log('Authenticate');
        return next();
    },
    function(req, res, next) {
        res.send(200);
        return next();
    }
);
```

### Hypermedia

If a parameterized route was defined with a string (not a regex), you can
render it from other places in the server. This is useful to have HTTP
responses that link to other resources, without having to hardcode URLs
throughout the codebase. Both path and query strings parameters get URL encoded
appropriately.


```js
server.get({name: 'city', path: '/cities/:slug'}, /* ... */);

// in another route
res.send({
  country: 'Australia',
  // render a URL by specifying the route name and parameters
  capital: server.router.render('city', {slug: 'canberra'}, {details: true})
});
```

Which returns:

```js
{
  "country": "Australia",
  "capital": "/cities/canberra?details=true"
}
```

### Versioned Routes

Most REST APIs tend to need versioning, and restify ships with support
for [semver](http://semver.org/) versioning in an `Accept-Version`
header, the same way you specify NPM version dependencies:

```js
var restify = require('restify');

var server = restify.createServer();

function sendV1(req, res, next) {
  res.send('hello: ' + req.params.name);
  return next();
}

function sendV2(req, res, next) {
  res.send({hello: req.params.name});
  return next();
}

var PATH = '/hello/:name';
server.get({path: PATH, version: '1.1.3'}, sendV1);
server.get({path: PATH, version: '2.0.0'}, sendV2);

server.listen(8080);
```

Try hitting with:

```sh
$ curl -s localhost:8080/hello/mark
{"hello":"mark"}
$ curl -s -H 'accept-version: ~1' localhost:8080/hello/mark
"hello: mark"
$ curl -s -H 'accept-version: ~2' localhost:8080/hello/mark
{"hello":"mark"}
$ curl -s -H 'accept-version: ~3' localhost:8080/hello/mark | json
{
  "code": "InvalidVersion",
  "message": "~3 is not supported by GET /hello/mark"
}
```

In the first case, we didn't specify an `Accept-Version` header at all, so
restify treats that like sending a `*`. Much as not sending an `Accept` header
means the client gets the server's choice. Restify will choose this highest
matching route. In the second case, we explicitly asked for for V1, which got
us response a response from the version 1 handler function, but then we asked
for V2 and got back JSON. Finally, we asked for a version that doesn't exist
and got an error.

You can default the versions on routes by passing in a version field at server
creation time.  Lastly, you can support multiple versions in the API by using
an array:

```js
server.get({path: PATH, version: ['2.0.0', '2.1.0', '2.2.0']}, sendV2);
```

In this case you may need to know more information such as what the original
requested version string was, and what the matching version from the routes
supported version array was. Two methods make this info available:

```js
var PATH = '/version/test';
server.get({
  path: PATH,
  version: ['2.0.0', '2.1.0', '2.2.0']
}, function (req, res, next) {
  res.send(200, {
    requestedVersion: req.version(),
    matchedVersion: req.matchedVersion()
  });
  return next();
});
```

Hitting this route will respond as below:

```sh
$ curl -s -H 'accept-version: <2.2.0' localhost:8080/version/test | json
{
  "requestedVersion": "<2.2.0",
  "matchedVersion": "2.1.0"
}
```


## Upgrade Requests

Incoming HTTP requests that contain a `Connection: Upgrade` header are treated
somewhat differently by the node HTTP server.  If you want restify to push
Upgrade requests through the regular routing chain, you need to enable
`handleUpgrades` when creating the server.

To determine if a request is eligible for Upgrade, check for the existence of
`res.claimUpgrade()`.  This method will return an object with two properties:
the `socket` of the underlying connection, and the first received data `Buffer`
as `head` (may be zero-length).

Once `res.claimUpgrade()` is called, `res` itself is marked unusable for
further HTTP responses; any later attempt to `send()` or `end()`, etc, will
throw an `Error`.  Likewise if `res` has already been used to send at least
part of a response to the client, `res.claimUpgrade()` will throw an `Error`.
Upgrades and regular HTTP Response behaviour are mutually exclusive on any
particular connection.

Using the Upgrade mechanism, you can use a library like
[watershed](https://github.com/jclulow/node-watershed) to negotiate WebSockets
connections.  For example:

```js
var ws = new Watershed();
server.get('/websocket/attach', function upgradeRoute(req, res, next) {
  if (!res.claimUpgrade) {
    next(new Error('Connection Must Upgrade For WebSockets'));
    return;
  }

  var upgrade = res.claimUpgrade();
  var shed = ws.accept(req, upgrade.socket, upgrade.head);
  shed.on('text', function(msg) {
    console.log('Received message from websocket client: ' + msg);
  });
  shed.send('hello there!');

  next(false);
});
```

## Content Negotiation

If you're using `res.send()` restify will automatically select the content-type
to respond with, by finding the first registered `formatter` defined.  Note in
the examples above we've not defined any formatters, so we've been leveraging
the fact that restify ships with `application/json`, `text/plain` and
`application/octet-stream` formatters. You can add additional formatters to
restify by passing in a hash of content-type -> parser at server creation time:

```js
var server = restify.createServer({
  formatters: {
    'application/foo': function formatFoo(req, res, body) {
      if (body instanceof Error)
        return body.stack;

      if (Buffer.isBuffer(body))
        return body.toString('base64');

      return util.inspect(body);
    }
  }
});
```

If a content-type can't be negotiated, then restify will default to using the
`application/octet-stream` formatter. For example, attempting to send a
content-type that does not have a defined formatter:

```js
server.get('/foo', function(req, res, next) {
  res.setHeader('content-type', 'text/css');
  res.send('hi');
  return next();
});
```

Will result in a response with a content-type of `application/octet-stream`:

```sh
$ curl -i localhost:3000/
HTTP/1.1 200 OK
Content-Type: application/octet-stream
Content-Length: 2
Date: Thu, 02 Jun 2016 06:50:54 GMT
Connection: keep-alive
```

As previously noted, restify ships with built-in formatters for json, text,
and binary. When you override or append to this, the "priority" might change;
to ensure that the priority is set to what you want, you should set a `q-value`
on your formatter definitions, which will ensure sorting happens the way you
want:

```js
restify.createServer({
  formatters: {
    'application/foo; q=0.9': function formatFoo(req, res, body) {
      if (body instanceof Error)
        return body.stack;

      if (Buffer.isBuffer(body))
        return body.toString('base64');

      return util.inspect(body);
    }
  }
});
```

Restify ships with the following default formatters, which can be overridden
when passing a formatters options to `createServer()`:

* application/javascript
* application/json
* text/plain
* application/octet-stream


The restify response object retains has all the "raw" methods of a node
[ServerResponse](http://nodejs.org/docs/latest/api/http.html#http.ServerResponse)
 on it as well.

```js
var body = 'hello world';
res.writeHead(200, {
  'Content-Length': Buffer.byteLength(body),
  'Content-Type': 'text/plain'
});
res.write(body);
res.end();
```


## Socket.IO

To use [socket.io](http://socket.io/) with restify, just treat your restify
server as if it were a "raw" node server:

```js
var server = restify.createServer();
var io = socketio.listen(server.server);

server.get('/', function indexHTML(req, res, next) {
    fs.readFile(__dirname + '/index.html', function (err, data) {
        if (err) {
            next(err);
            return;
        }

        res.setHeader('Content-Type', 'text/html');
        res.writeHead(200);
        res.end(data);
        next();
    });
});


io.sockets.on('connection', function (socket) {
    socket.emit('news', { hello: 'world' });
    socket.on('my other event', function (data) {
            console.log(data);
    });
});

server.listen(8080, function () {
    console.log('socket.io server listening at %s', server.url);
});
```
