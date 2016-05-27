# Server Guide

The most barebones echo server:

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

Try hitting that with the following curl commands to get a feel for
what restify is going to turn that into:

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

Note that by default, curl uses `Connection: keep-alive`. In order to make the HEAD
method return right away, you'll need to pass `Connection: close`.

Since curl is often used with REST APIs, restify provides a plugin to work around
this idiosyncrasy in curl. The plugin checks whether the user agent is curl. If it
is, it sets the Connection header to "close" and removes the "Content-Length" header.

```js
server.pre(restify.pre.userAgentConnection());
```

See the [pre](#pre) method for more information.

## Creating a Server

Creating a server is straightforward, as you simply invoke the
`createServer` API, which takes an options object with the options listed
below (and `listen()` takes the same arguments as node's
[http.Server.listen](http://nodejs.org/docs/latest/api/http.html#http_server_listen_port_hostname_backlog_callback)):

```js
var restify = require('restify'),
fs = require('fs');

var server = restify.createServer({
  certificate: fs.readFileSync('path/to/server/certificate'),
  key: fs.readFileSync('path/to/server/key'),
  name: 'MyApp',
});

server.listen(8080);
```

|Option|Type|Description|
|----------|--------|---------------|
|certificate|String|If you want to create an HTTPS server, pass in the path to PEM-encoded certificate and key|
|key|String|If you want to create an HTTPS server, pass in the path to PEM-encoded certificate and key|
|formatters|Object|Custom response formatters for `res.send()`|
|handleUncaughtExceptions|Boolean|When true (default is false) restify will use a domain to catch and respond to any uncaught exceptions that occur in it's handler stack|
|log|Object|You can optionally pass in a [bunyan](https://github.com/trentm/node-bunyan) instance; not required|
|name|String|By default, this will be set in the `Server` response header, default is `restify` |
|spdy|Object|Any options accepted by [node-spdy](https://github.com/indutny/node-spdy)|
|version|String|Array|A default version to set for all routes|
|handleUpgrades|Boolean|Hook the `upgrade` event from the node HTTP server, pushing `Connection: Upgrade` requests through the regular request handling chain; defaults to `false`|
|httpsServerOptions|Object|Any options accepted by [node-https Server](http://nodejs.org/api/https.html#https_https). If provided the following restify server options will be ignored: spdy, ca, certificate, key, passphrase, rejectUnauthorized, requestCert and ciphers; however these can all be specified on httpsServerOptions.|
|reqIdHeaders|Array|an optional array of request id header names that will be used to set the request id (i.e., the value for req.getId())|
|strictRouting|Boolean|(Default=`false`). If set, Restify will treat "/foo" and "/foo/" as different paths.|

## Common handlers: server.use()

A restify server has a `use()` method that takes handlers of
the form `function (req, res, next)`.   Note that restify runs
handlers in the order they are registered on a server, so if you want
some common handlers to run before any of your routes, issue calls to
`use()` before defining routes.

Note that in all calls to `use()` and the routes below, you can pass
in any combination of direct functions (`function(res, res, next)`) and
arrays of functions (`[function(req, res, next)]`).

## Routing

restify routing, in 'basic' mode, is pretty much identical to express/sinatra,
in that HTTP verbs are used with a parameterized resource to determine
what chain of handlers to run.  Values associated with named
placeholders are available in `req.params`. Note that values will be
URL-decoded before being passed to you.

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
`my/cats/name/is/gandalf`.  Basically, you can do whatever you want.

Note the use of `next()`.  You are responsible for calling `next()` in
order to run the next handler in the chain.  As below, you can pass an
Error object in to have restify automatically return responses to the client.

You can pass in  `false` to not error, but to stop the handler
chain.  This is useful if you had a `res.send` in an early filter, which is
not an error, and you possibly have one later you want to short-circuit.

Lastly, you can pass in a string `name` to `next()`, and restify will lookup
that route, and assuming it exists will run the chain *from where you left
off*.  So for example:

```js
var count = 0;

server.use(function foo(req, res, next) {
    count++;
    next();
});

server.get('/foo/:id', function (req, res, next) {
   next('foo2');
});

server.get({
    name: 'foo2',
    path: '/foo/:id'
}, function (req, res, next) {
   assert.equal(count, 1);
   res.send(200);
   next();
});
```

Note that `foo` only gets run once in that example.  A few caveats:

- If you provide a name that doesn't exist, restify will 500 that request.
- Don't be silly and call this in cycles.  restify won't check that.
- Lastly, you cannot "chain" `next('route')` calls; you can only delegate the
  routing chain once (this is a limitation of the way routes are stored
  internally, and may be revisited someday).

### Chaining Handlers

Routes can also accept more than one handler function. For instance:

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

If a parameterized route was defined with a string (not a regex), you can render it from other places in the server. This is useful to have HTTP responses that link to other resources, without having to hardcode URLs throughout the codebase. Both path and query strings parameters get URL encoded appropriately.

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
  "message": "GET /hello/mark supports versions: 1.1.3, 2.0.0"
}
```

In the first case, we didn't specify an `Accept-Version` header
at all, so restify treats that like sending a `*`. Much as not sending
an `Accept` header means the client gets the server's choice. Restify
will choose this highest matching route.
In the second case, we explicitly asked for for V1, which got
us response a response from the version 1 handler function, 
but then we asked for V2 and got back JSON.  Finally,
we asked for a version that doesn't exist and got an error (notably,
we didn't send an `Accept` header, so we got a JSON response).  Which
segues us nicely into content negotiation.

You can default the versions on routes by passing in a version field at
server creation time.  Lastly, you can support multiple versions in the API
by using an array:

```js
server.get({path: PATH, version: ['2.0.0', '2.1.0', '2.2.0']}, sendV2);
```

In this case you may need to know more information such as what the
original requested version string was, and what the matching
version from the routes supported version array was. Two methods make
this info available:

```js
var PATH = '/version/test';
server.get({path: PATH, version: ['2.0.0', '2.1.0', '2.2.0']}, function (req) {
  res.send(200, {
    requestedVersion: req.version(),
    matchedVersion: req.matchedVersion()
  });
});
```

Hitting this route:

```sh
$ curl -s -H 'accept-version: <2.2.0' localhost:8080/version/test | json
{
  "requestedVersion": "<2.2.0",
  "matchedVersion": "2.1.0"
}
```

In response to the above

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

If you're using `res.send()` restify will automatically select the
content-type to respond with, by finding the first registered
`formatter` defined.  Note in the examples above we've not defined any
formatters, so we've been leveraging the fact that restify ships with
`application/json`,  `text/plain` and `application/octet-stream`
formatters.  You can add additional formatters to restify by passing
in a hash of content-type -> parser at server creation time:

```js
var server = restify.createServer({
  formatters: {
    'application/foo': function formatFoo(req, res, body, cb) {
      if (body instanceof Error)
        return body.stack;

      if (Buffer.isBuffer(body))
        return cb(null, body.toString('base64'));

      return cb(null, util.inspect(body));
    }
  }
});
```

You can do whatever you want, but you probably want to check the type
of `body` to figure out what type it is, notably for
Error/Buffer/everything else.  You can always add more formatters
later by just setting the formatter on `server.formatters`, but it's
probably sane to just do it at construct time.   Also, note that if a
content-type can't be negotiated, the default is
`application/json`.  Of course, you can always explicitly set
the content-type:

```js
res.setHeader('content-type', 'application/foo');
res.send({hello: 'world'});
```

Note that there are typically at least three content-types supported by
restify: json, text and binary.  When you override or append to this, the
"priority" might change; to ensure that the priority is set to what you
want, you should set a `q-value` on your formatter definitions, which will
ensure sorting happens the way you want:

```js
restify.createServer({
  formatters: {
    'application/foo; q=0.9': function formatFoo(req, res, body, cb) {
      if (body instanceof Error)
        return cb(body);

      if (Buffer.isBuffer(body))
        return cb(null, body.toString('base64'));

      return cb(null, util.inspect(body));
    }
  }
});
```

Lastly, you don't have to use any of this magic, as a restify response
object has all the "raw" methods of a node
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

## Error handling

You can handle errors in restify a few different ways.  First, you can
always just call `res.send(err)`.  You can also shorthand this in a
route by doing:

```js
server.get('/hello/:name', function(req, res, next) {
  return database.get(req.params.name, function(err, user) {
    if (err)
      return next(err);

    res.send(user);
    return next();
  });
});
```

If you invoke `res.send()` with an error that has a `statusCode`
attribute, that will be used, otherwise a default of 500 will be used
(unless you're using `res.send(4xx, new Error('blah'))`).

Alternatively, restify 2.1 supports a `next.ifError` API:

```js
server.get('/hello/:name', function(req, res, next) {
  return database.get(req.params.name, function(err, user) {
    next.ifError(err);
    res.send(user);
    next();
  });
});
```

Sometimes, for all requests, you may want to handle an error condition the same
way. As an example, you may want to serve a 500 page on all
`InternalServerErrors`. In this case, you can add a listener for the
`InternalServer` error event that is always fired when this Error is
encountered by Restify as part of a `next(error)` statement. This gives you a
way to handle all errors of the same class identically across the server. You
can also use a generic `restifyError` event which will catch errors of all types.


```js
server.get('/hello/:name', function(req, res, next) {
  // some internal unrecoverable error
  var err = new restify.errors.InternalServerError('oh noes!');
  return next(err);
});

server.get('/hello/:foo', function(req, res, next) {
  // resource not found error
  var err = new restify.errors.NotFoundError('oh noes!');
  return next(err);
});

server.on('NotFound', function (req, res, err, cb) {
  // do not call res.send! you are now in an error context and are outside
  // of the normal next chain. you can log or do metrics here, and invoke
  // the callback when you're done. restify will automtically render the 
  // NotFoundError as a JSON response.
  return cb();
});

server.on('InternalServer', function (req, res, err, cb) {
  // if you don't want restify to automatically render the Error object
  // as a JSON response, you can customize the response by setting the 
  // `body` property of the error
  err.body = '<html><body>some custom error content!</body></html>';
  return cb();
});

server.on('restifyError', function (req, res, err, cb) {
  // this listener will fire after both events above!
  // `err` here is the same as the error that was passed to the above
  // error handlers.
  return cb();
});
```

### HttpError

Now the obvious question is what that exactly does (in either case).
restify tries to be programmer-friendly with errors by exposing all
HTTP status codes as a subclass of `HttpError`.  So, for example, you can
do this:

```js
server.get('/hello/:name', function(req, res, next) {
  return next(new restify.ConflictError("I just don't like you"));
});

$ curl -is -H 'accept: text/*' localhost:8080/hello/mark
HTTP/1.1 409 Conflict
Content-Type: text/plain
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET
Access-Control-Allow-Headers: Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, Api-Version
Access-Control-Expose-Headers: Api-Version, Request-Id, Response-Time
Connection: close
Content-Length: 21
Content-MD5: up6uNh2ejV/C6JUbLlvsiw==
Date: Tue, 03 Jan 2012 00:24:48 GMT
Server: restify
Request-Id: 1685313e-e801-4d90-9537-7ca20a27acfc
Response-Time: 1

I just don't like you
```

Alternatively, you can access the error classes via `restify.errors`. We can do this with a simple change to the previous example:

```js
server.get('/hello/:name', function(req, res, next) {
  return next(new restify.errors.ConflictError("I just don't like you"));
});
```

The core thing to note about an `HttpError` is that it has a numeric
code (statusCode) and a `body`.  The statusCode will automatically
set the HTTP response status code, and the body attribute by default
will be the message.

All status codes between 400 and 5xx are automatically converted into
an HttpError with the name being 'PascalCase' and spaces removed.  For
the complete list, take a look at the
[node source](https://github.com/joyent/node/blob/v0.6/lib/http.js#L152-205).

From that code above `418: I'm a teapot` would be `ImATeapotError`, as
an example.

### RestError

Now, a common problem with REST APIs and HTTP is that they often end
up needing to overload 400 and 409 to mean a bunch of different
things.  There's no real standard on what to do in these cases, but in
general you want machines to be able to (safely) parse these things
out, and so restify defines a convention of a `RestError`.  A
`RestError` is a subclass of one of the particular `HttpError` types,
and additionally sets the body attribute to be a JS object with the
attributes `code` and `message`.  For example, here's a built-in RestError:

```js
var server = restify.createServer();
server.get('/hello/:name', function(req, res, next) {
  return next(new restify.InvalidArgumentError("I just don't like you"));
});

$ curl -is localhost:8080/hello/mark | json
HTTP/1.1 409 Conflict
Content-Type: application/json
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET
Access-Control-Allow-Headers: Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, Api-Version
Access-Control-Expose-Headers: Api-Version, Request-Id, Response-Time
Connection: close
Content-Length: 60
Content-MD5: MpEcO5EQFUZ2MNeUB2VaZg==
Date: Tue, 03 Jan 2012 00:50:21 GMT
Server: restify
Request-Id: bda456dd-2fe4-478d-809c-7d159d58d579
Response-Time: 3

{
  "code": "InvalidArgument",
  "message": "I just don't like you"
}
```

The built-in restify errors are:

* BadRequestError (400 Bad Request)
* UnauthorizedError (401 Unauthorized)
* PaymentRequiredError (402 Payment Required)
* ForbiddenError (403 Forbidden)
* NotFoundError (404 Not Found)
* MethodNotAllowedError (405 Method Not Allowed)
* NotAcceptableError (406 Not Acceptable)
* ProxyAuthenticationRequiredError (407 Proxy Authentication Required)
* RequestTimeoutError (408 Request Time-out)
* ConflictError (409 Conflict)
* GoneError (410 Gone)
* LengthRequiredError (411 Length Required)
* PreconditionFailedError (412 Precondition Failed)
* RequestEntityTooLargeError (413 Request Entity Too Large)
* RequesturiTooLargeError (414 Request-URI Too Large)
* UnsupportedMediaTypeError (415 Unsupported Media Type)
* RequestedRangeNotSatisfiableError (416 Requested Range Not Satisfiable)
* ExpectationFailedError (417 Expectation Failed)
* ImATeapotError (418 I'm a teapot)
* UnprocessableEntityError (422 Unprocessable Entity)
* LockedError (423 Locked)
* FailedDependencyError (424 Failed Dependency)
* UnorderedCollectionError (425 Unordered Collection)
* UpgradeRequiredError (426 Upgrade Required)
* PreconditionRequiredError (428 Precondition Required)
* TooManyRequestsError (429 Too Many Requests)
* RequestHeaderFieldsTooLargeError (431 Request Header Fields Too Large)
* InternalServerError (500 Internal Server Error)
* NotImplementedError (501 Not Implemented)
* BadGatewayError (502 Bad Gateway)
* ServiceUnavailableError (503 Service Unavailable)
* GatewayTimeoutError (504 Gateway Time-out)
* HttpVersionNotSupportedError (505 HTTP Version Not Supported)
* VariantAlsoNegotiatesError (506 Variant Also Negotiates)
* InsufficientStorageError (507 Insufficient Storage)
* BandwidthLimitExceededError (509 Bandwidth Limit Exceeded)
* NotExtendedError (510 Not Extended)
* NetworkAuthenticationRequiredError (511 Network Authentication Required)
* BadDigestError (400 Bad Request)
* BadMethodError (405 Method Not Allowed)
* InternalError (500 Internal Server Error)
* InvalidArgumentError (409 Conflict)
* InvalidContentError (400 Bad Request)
* InvalidCredentialsError (401 Unauthorized)
* InvalidHeaderError (400 Bad Request)
* InvalidVersionError (400 Bad Request)
* MissingParameterError (409 Conflict)
* NotAuthorizedError (403 Forbidden)
* RequestExpiredError (400 Bad Request)
* RequestThrottledError (429 Too Many Requests)
* ResourceNotFoundError (404 Not Found)
* WrongAcceptError (406 Not Acceptable)

You can always add your own by subclassing `restify.RestError` like:

```js
var restify = require('restify');
var util = require('util');

function MyError(message) {
  restify.RestError.call(this, {
    restCode: 'MyError',
    statusCode: 418,
    message: message,
    constructorOpt: MyError
  });
  this.name = 'MyError';
};
util.inherits(MyError, restify.RestError);
```

Basically, a `RestError` takes a statusCode, a restCode, a message,
and a "constructorOpt" so that V8 correctly omits your code
from the stack trace (you don't *have* to do that, but you probably
want it).  In the example above, we also set the name property so
`console.log(new MyError());` looks correct.

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
