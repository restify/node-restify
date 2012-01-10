---
title: API Guide | restify
markdown2extras: wiki-tables, code-friendly
---

# About restify

restify is a node.js module built specifically to enable you to build correct
REST web services.  It borrows heavily from [express](http://expressjs.com/)
(intentionally) as that is more or less the de facto API for writing
web applications on top of node.js.

## Why use restify and not express?

I get asked this more than anything else, so I'll just get it out of
the way up front.

Express' use case is targeted at browser applications, and contains a
lot of functionality (i.e., templating/rendering) to support that.
Restify does not.  Restify exists to let you build "strict" API
services that are maintanable and observable; restify comes with automatic
[DTrace](http://en.wikipedia.org/wiki/DTrace) support for all your
handlers, if you're running on a platform that supports DTrace.

In short, I wrote restify as I needed a framework that
gave me absolute control over interactions with HTTP and full
observability into the latency and characteristics of my
applications.  If you don't need that, or don't care about those
aspect(s), then it's probably not for you.

## About this guide

This guide provides comprehensive documentation on writing a REST api (server)
with restify, writing clients that easily consume REST APIs, and on
the DTrace integration present in restify.

Note this documentation refers to the 1.0.X version(s) of restify;
these versions are not backwards-compatible with the 0.5 versions.

## Conventions

Any content formatted like this:

    $ curl localhost:8080

is a command-line example that you can run from a shell.  All other examples
and information is formatted like this:

    GET /foo HTTP/1.1

# Installation

    $ npm install restify

# Server API

The most barebones echo server:

    var restify = require('restify');

    function respond(req, res, next) {
      res.send('hello ' + req.params.name);
    }

    var server = restify.createServer();
    server.get('/hello/:name', respond);
    server.head('/hello/:name', respond);

    server.listen(8080, function() {
      console.log('%s listening at %s', server.name, server.url);
    });

Try hitting that with the following curl commands to get a feel for
what restify is going to turn that into:

    $ curl -is http://localhost:8080/hello/mark -H 'accept: text/plain'
    HTTP/1.1 200 OK
    Access-Control-Allow-Origin: *
    Access-Control-Allow-Methods: GET
    Access-Control-Allow-Headers: Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version
    Access-Control-Expose-Headers: X-Api-Version, X-Request-Id, X-Response-Time
    Server: restify
    X-Request-Id: b0cec85c-cc17-4985-8f2f-7787ad6e3512
    Date: Fri, 30 Dec 2011 20:09:36 GMT
    X-Response-Time: 1
    Content-Type: text/plain
    Content-Length: 10
    Content-MD5: pvc6+Tyy1EBQgBWaN1v+eQ==
    Connection: close

    hello mark

    $ curl -is http://localhost:8080/hello/mark
    HTTP/1.1 200 OK
    Access-Control-Allow-Origin: *
    Access-Control-Allow-Methods: GET
    Access-Control-Allow-Headers: Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version
    Access-Control-Expose-Headers: X-Api-Version, X-Request-Id, X-Response-Time
    Server: restify
    X-Request-Id: 07c4b4b5-5866-4b08-ace8-63ef7c70b48f
    Date: Fri, 30 Dec 2011 20:11:17 GMT
    X-Response-Time: 1
    Content-Type: application/json
    Content-Length: 12
    Content-MD5: UxC9l75x6aHfos8MhdrDLg==
    Connection: close

    "hello mark"

    $ curl -is http://localhost:8080 -X HEAD
    HTTP/1.1 200 OK
    Access-Control-Allow-Origin: *
    Access-Control-Allow-Methods: GET
    Access-Control-Allow-Headers: Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version
    Access-Control-Expose-Headers: X-Api-Version, X-Request-Id, X-Response-Time
    Server: restify
    X-Request-Id: 07c4b4b5-5866-4b08-ace8-63ef7c70b48f
    Date: Fri, 30 Dec 2011 20:11:17 GMT
    X-Response-Time: 1
    Content-Type: application/json
    Content-Length: 12
    Content-MD5: UxC9l75x6aHfos8MhdrDLg==
    Connection: close

Note that all of those headers are set automatically IFF you don't set
them explicitly (or register a `defaultResponseHeaders` function).

## Creating a Server

Creating a server is straightforward, as you simply invoke the
`createServer` API, which takes an options object with the options
below (and `listen()` takes the same arguments as node's
[http.Server.listen](http://nodejs.org/docs/latest/api/http.html#server.listen)):

    var log4js = require('log4js);
    var restify = require('restify');

    var server = restify.createServer({
      certificate: ...,
      key: ...,
      log4js: log4js,
      name: 'MyApp',
    });

    server.listen(8080);

||**Option**||**Type**||**Description**||
||certificate||String||If you want to create an HTTPS server, pass in the PEM-encoded certificate and key||
||key||String||If you want to create an HTTPS server, pass in the PEM-encoded certificate and key||
||formatters||Object||Custom response formatters for `res.send()`||
||log4js||Object||You can optionally pass in a log4js handle; note log4js is not required||
||name||String||By default, this will be set in the `Server` response header, and also will name the DTrace provider; default is `restify` ||
||version||String||A default version to set for all routes||

## Common handlers: server.use()

A restify server has a `use()` method on it, which takes handlers of
the form `function (req, res, next)`.   Note that restify runs
handlers in the order they are registered on a server, so if you want
some common handlers to run before any of your routes, issue calls to
`use()` before defining routes.  restify ships with several handlers
you can use, specifically:

* Accept header parsing
* Authorization header parsing
* Date header parsing
* Query string parsing
* Body parsing (JSON/URL-encoded)
* Throttling

Here's some example code using all the shipped plugins:

    var server = restify.createServer();
    server.use(restify.acceptParser(server.acceptable));
    server.use(restify.authorizationParser());
    server.use(restify.dateParser());
    server.use(restify.queryParser());
    server.use(restify.bodyParser());
    server.use(restify.throttle({
      burst: 100,
      rate: 50,
      ip: true,
      overrides: {
        '192.168.1.1': {
          rate: 0,        // unlimited
          burst: 0
        }
      }
    }));

Note that in all calls to `use()` and the routes below, you can pass
in any combination of `function(res, res, next)` and
`[function(req, res, next)]` (i.e., direct functions and arrays of functions).

## Routing

restify routing, in 'basic' mode, is pretty much identical to express/sinatra,
in that HTTP verbs are used with a parameterized resource to determine
what chain of handlers to run.  Values associated with named
placeholders are available in `req.params`. Note that values will be
URL-decoded before being passed to you.

     function send(req, res, next) {
       res.send(hello ' + req.params.name);
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

You can also pass in a [RegExp](https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/RegExp)
object and access the capture group with `req.params` (which will not
be interpreted in any way):

    server.get(/^\/([a-zA-Z0-9_\.~-]+)\/(.*)/, function(req, res, next) {
      console.log(req.params[0]);
      console.log(req.params[1]);
      res.send(200);
      return next();
    });

Here any request like:

    $ curl localhost:8080/foo/my/cats/name/is/gandalf

Would result in `req.params[0]` being `foo` and `req.params[1]` being
`my/cats/name/is/gandalf`.  Basically, you can do whatever you want.

### Versioned Routes

Most REST APIs tend to need versioning, and restify ships with support
for [semver](http://semver.org/) versioning in an `Accept-Version`
header, the same way you specify NPM version dependencies:

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

Try hitting with:

    $ curl -s localhost:8080/hello/mark
    "hello: mark"
    $ curl -s -H 'accept-version: ~1' localhost:8080/hello/mark
    "hello: mark"
    $ curl -s -H 'accept-version: ~2' localhost:8080/hello/mark
    {"hello":"mark"}
    $ curl -s -H 'accept-version: ~3' localhost:8080/hello/mark | json
    {
      "code": "InvalidVersion",
      "message": "GET /hello/mark supports versions: 1.1.3, 2.0.0"
    }

In the first case, we didn't specify an `Accept-Version` header
at all, so restify treats that like sending a `*`. Much as not sending
an `Accept` header means the client gets the server's choice. Restify
will choose the first matching route, in the order specified in the
code. In the second case, we explicitly asked for for V1, which got
us the same response, but then we asked for V2 and got back JSON.  Finally,
we asked for a version that doesn't exist and got an error (notably,
we didn't send an `Accept` header, so we got a JSON response).  Which
segues us nicely into content negotiation.

Lastly, note that you can default the versions on routes by passing in
a version field at server creation time.


## Content Negotiation

If you're using `res.send()` restify will automatically select the
content-type to respond with, by finding the first registered
`formatter` defined.  Note in the examples above we've not defined any
formatters, so we've been leveraging the fact that restify ships with
`application/json`,  `text/plain` and `application/octet-stream`
formatters.  You can add additional formatters to restify by passing
in a hash of content-type -> parser at server creation time:

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

You can do whatever you want, but you probably want to check the type
of `body` to figure out what type it is, notably for
Error/Buffer/everything else.  You can always add more formatters
later by just setting the formatter on `server.formatters`, but it's
probably sane to just do it at construct time.   Also, note that if a
content-type can't be negotiated, the default is
`application/octet-stream`.  Of course, you can always explicitly set
the content-type to return by setting it on `res.contentType`:

    res.contentType = 'application/foo';
    res.send({hello: 'world'});

Lastly, you don't have to use any of this magic, as a restify response
object has all the "raw" methods of a node
[ServerResponse](http://nodejs.org/docs/latest/api/http.html#http.ServerResponse)
 on it as well.

    var body = 'hello world';
    res.writeHead(200, {
      'Content-Length': Buffer.byteLength(body),
      'Content-Type': 'text/plain'
    });
    res.write(body);
    res.end();

## Error handling

You can handle errors in restify a few different ways.  First, you can
always just call `res.send(err)`.  You can also shorthand this in a
route by doing:

    server.get('/hello/:name', function(req, res, next) {
      return database.get(req.params.name, function(err, user) {
        if (err)
          return next(err);

        res.send(user);
        return next();
      });
    });

If you invoke `res.send()` with an error that has a `statusCode`
attribute, that will be used, otherwise a default of 500 will be used
(unless you're using `res.send(4xx, new Error('blah))`).

### HttpError

Now the obvious question is what that exactly does (in either case).
restify tries to be programmer-friendly with errors by exposing all
HTTP status codes as a subclass of `HttpError`.  So, for example, you can
do this:

    server.get('/hello/:name', function(req, res, next) {
      return next(new restify.ConflictError("I just don't like you"));
    });

    $ curl -is -H 'accept: text/*' localhost:8080/hello/mark
    HTTP/1.1 409 Conflict
    Content-Type: text/plain
    Access-Control-Allow-Origin: *
    Access-Control-Allow-Methods: GET
    Access-Control-Allow-Headers: Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version
    Access-Control-Expose-Headers: X-Api-Version, X-Request-Id, X-Response-Time
    Connection: close
    Content-Length: 21
    Content-MD5: up6uNh2ejV/C6JUbLlvsiw==
    Date: Tue, 03 Jan 2012 00:24:48 GMT
    Server: restify
    X-Request-Id: 1685313e-e801-4d90-9537-7ca20a27acfc
    X-Response-Time: 1

    I just don't like you

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

    var server = restify.createServer();
    server.get('/hello/:name', function(req, res, next) {
      return next(new restify.InvalidArgumentError("I just don't like you"));
    });

    $ curl -is localhost:8080/hello/mark | json
    HTTP/1.1 409 Conflict
    Content-Type: application/json
    Access-Control-Allow-Origin: *
    Access-Control-Allow-Methods: GET
    Access-Control-Allow-Headers: Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version
    Access-Control-Expose-Headers: X-Api-Version, X-Request-Id, X-Response-Time
    Connection: close
    Content-Length: 60
    Content-MD5: MpEcO5EQFUZ2MNeUB2VaZg==
    Date: Tue, 03 Jan 2012 00:50:21 GMT
    Server: restify
    X-Request-Id: bda456dd-2fe4-478d-809c-7d159d58d579
    X-Response-Time: 3

    {
      "code": "InvalidArgument",
      "message": "I just don't like you"
    }

The built-in restify errors are:

* RestError
* BadDigestError
* BadMethodError
* InternalErrorError
* InvalidArgumentError
* InvalidContentError
* InvalidCredentialsError
* InvalidHeaderError
* InvalidVersionError
* MissingParameterError
* NotAuthorizedError
* RequestExpiredError
* RequestThrottledError
* ResourceNotFoundError
* WrongAcceptError

You can always add your own by subclassing `restify.RestError` like:

    var restify = require('restify');
    var util = require('util');

    function MyError(message) {
      restify.RestError.call(this, 418, 'MyError', message, MyError);
      this.name = 'MyError';
    };
    util.inherits(MyError, restify.RestError);

Basically, a `RestError` takes a statusCode, a restCode, a message,
and a "constructorOpt" so that V8 correctly omits your code
from the stack trace (you don't *have* to do that, but you probably
want it).  In the example above, we also set the name property so
`console.log(new MyError());` looks correct.

## Events

Restify servers emit all the events from the node
[http.Server](http://nodejs.org/docs/latest/api/http.html#http.Server)
and has several other events you want to listen on.

### Event: 'NotFound'

`function (request, response) {}`

When a client request is sent for a URL that does not exist, restify
will emit this event. Note that restify checks for listeners on this
event, and if there are none, responds with a default 404 handler.  It
is expected that if you listen for this event, you respond to the client.

### Event: 'MethodNotAllowed'

`function (request, response) {}`

When a client request is sent for a URL that does exist, but you have
not registered a route for that HTTP verb, restify will emit this
event. Note that restify checks for listeners on this event, and if
there are none, responds with a default 405 handler.  It
is expected that if you listen for this event, you respond to the client.

### Event: 'VersionNotAllowed'

`function (request, response) {}`

When a client request is sent for a route that exists, but does not
match the version(s) on those routes, restify will emit this
event. Note that restify checks for listeners on this event, and if
there are none, responds with a default 400 handler.  It
is expected that if you listen for this event, you respond to the client.

### Event: 'after'

`function (request, response, name) {}`

Emitted after a route has finished all the handlers you registered.
You can use this to write audit logs, etc.  The name parameter will be
the name of the route that ran.

## Properties and other methods

### Properties

A restify server has the following properties on it:

||**Name**||**Type**||**Description**||
||name||String||name of the server||
||version||String||default version to use in all routes||
||log4js||Object||log4js handle (might be a stub)||
||acceptable||Array(String)||list of content-types this server can respond with||
||url||String||Once listen() is called, this will be filled in with where the server is running||

### Methods

#### address()

Wraps node's [address()](http://nodejs.org/docs/latest/api/net.html#server.address).

#### listen(port, [host], [callback]) or listen(path, [callback])

Wrap's node's [listen()](http://nodejs.org/docs/latest/api/net.html#server.listen).

#### close()

Wrap's node's [close()](http://nodejs.org/docs/latest/api/net.html#server.close).

## Request API

Wraps all of the node
[ServerRequest](http://nodejs.org/docs/latest/api/http.html#http.ServerRequest)
APIs, events and properties, plus the following.

### header(key, [defaultValue])

Get the case-insensitive request header key, and optionally provide a
default value (express-compliant):

    req.header('Host');
    req.header('HOST');
    req.header('Accept', '*/*');

### accepts(type)

(express-compliant)

Check if the Accept header is present, and includes the given type.

When the Accept header is not present true is returned. Otherwise the
given type is matched by an exact match, and then subtypes. You may
pass the subtype such as `html` which is then converted internally
to `text/html` using the mime lookup table.

    // Accept: text/html
    req.accepts('html');
    // => true

    // Accept: text/*; application/json
    req.accepts('html');
    req.accepts('text/html');
    req.accepts('text/plain');
    req.accepts('application/json');
    // => true

    req.accepts('image/png');
    req.accepts('png');
    // => false

### is(type)

Check if the incoming request contains the Content-Type header field,
and it contains the give mime type.

    // With Content-Type: text/html; charset=utf-8
    req.is('html');
    req.is('text/html');
    // => true

    // When Content-Type is application/json
    req.is('json');
    req.is('application/json');
    // => true

    req.is('html');
    // => false

Note this is almost compliant with express, but restify does not have
all the `app.is()` callback business express does.

### getLogger(category)

Shorthand to grab a new log4js logger.

    var log = req.getLogger('MyFoo');

### Properties

||*Name*||*Type*||*Description*||
||contentLength||Number||short hand for the header content-length||
||contentType||String||short hand for the header content-type||
||href||String||url.parse(req.url) href||
||id||String||A unique request id (x-request-id)||
||path||String||cleaned up URL path||
||query||String||the query string only||
||secure||Boolean||Whether this was an SSL request||
||time||Number||the time when this request arrived (ms since epoch)||

## Response API

Wraps all of the node
[ServerResponse](http://nodejs.org/docs/latest/api/http.html#http.ServerResponse)
APIs, events and properties, plus the following.

### header(key, value)

Get or set the response header key.

    res.header('Content-Length');
    // => undefined

    res.header('Content-Length', 123);
    // => 123

    res.header('Content-Length');
    // => 123

### cache([type], [options])

Sets the cache-control header.  `type` defaults to _public_, and
options currently only takes `maxAge`.

    res.cache();

### status(code)

Sets the response statusCode.

    res.status(201);

### send([status], body)

You can use `send()` to wrap up all the usual `writeHead()`,
`write()`, `end()` calls on the HTTP API of node.  You can pass send
either a code and body, or just a body.  `body` can be an Object, a
Buffer, or an Error.  When you call `send()`, restify figures out how
to format the response (see content-negotiation, above), and does
that.

    res.send({hello: 'world'});
    res.send(201, {hello: 'world'});
    res.send(new BadRequestError('meh'));

### json([status], body)

Short-hand for:

    res.contentType = 'json';
    res.send({hello: 'world'});

### Properties

||*Name*||*Type*||*Description*||
||code||Number||HTTP status code||
||contentLength||Number||short hand for the header content-length||
||contentType||String||short hand for the header content-type||
||headers||Object||response headers||
||id||String||A unique request id (x-request-id)||

### Setting the default headers

You can change what headers restify sends by default by setting the
top-level property `defaultResponseHeaders`.  This should be a
function that takes one argument `data`, which is the already
serialized response body.  `data` can be either a String or Buffer (or
null).  The `this` object will be the response itself.

    var restify = require('restify');

    restify.defaultResponseHeaders = function(data) {
      this.header('Server', 'helloworld');
    };

    restify.defaultResponseHeaders = false; // disable altogether

## DTrace

One of the coolest features of restify is that it automatically
creates DTrace probes for you whenever you add a new route/handler.
The easiest way to explain this is with an example:

    var restify = require('restify');

    var server = restify.createServer({
      name: 'helloworld'
    });

    server.use(restify.acceptParser(server.acceptable));
    server.use(restify.authorizationParser());
    server.use(restify.dateParser());
    server.use(restify.queryParser());
    server.use(restify.urlEncodedBodyParser());

    server.use(function slowHandler(req, res, next) {
      setTimeout(function() {
        return next();
      }, 250);
    });

    server.get({path: '/hello/:name', name: 'GetFoo'}, function respond(req, res, next) {
      res.send({
        hello: req.params.name
      });
      return next();
    });

    server.listen(8080, function() {
      console.log('listening: %s', server.url);
    });

So we've got our typical "hello world" server now, with a slight twist; we
introduced an artificial 250ms lag.  Also, note that we named our server, our
routes, and all of our handlers (functions); while that's optional, it
does make DTrace much more usable.  So, if you started that server,
then looked for DTrace probes, you'd see something like this:

    $ dtrace -l -P helloworld*
       ID   PROVIDER            MODULE                          FUNCTION NAME
    23491 helloworld10254            module                              func getfoo-start
    23492 helloworld10254            module                              func getfoo-done
    23493 helloworld10254            module                              func getfoo-parseAccept-start
    23494 helloworld10254            module                              func getfoo-parseAccept-done
    23495 helloworld10254            module                              func getfoo-parseAuthorization-start
    23496 helloworld10254            module                              func getfoo-parseAuthorization-done
    23497 helloworld10254            module                              func getfoo-parseDate-start
    23498 helloworld10254            module                              func getfoo-parseDate-done
    23499 helloworld10254            module                              func getfoo-parseQueryString-start
    23500 helloworld10254            module                              func getfoo-parseQueryString-done
    23501 helloworld10254            module                              func getfoo-parseUrlEncodedBody-start
    23502 helloworld10254            module                              func getfoo-parseUrlEncodedBody-done
    23503 helloworld10254            module                              func getfoo-slowHandler-start
    23504 helloworld10254            module                              func getfoo-slowHandler-done
    23505 helloworld10254            module                              func getfoo-respond-start
    23506 helloworld10254            module                              func getfoo-respond-done

What restify does is autogenerate a probe for each route/handler on
start and finish, and uses the names found to do so. If there's no
names, it fills in based on the method, url and index in the chain.
The probe signatures generated look like:

### Start Probes

`$route-start and $route-$handler-start`

||*Field*||*Type*||*Description*||
||id||int||cookie you can use to correlate request/response||
||url||char *||request url||
||user-agent||char *||value of user-agent header||
||user||char *||req.username (i.e., the authenticated party)||
||content-type||char *||value of content-type header||
||content-length||int||value of content-length header||

### Done Probes

`$route-done and $route-$handler-done`

||*Field*||*Type*||*Description*||
||id||int||cookie you can use to correlate request/response||
||statusCode||int||HTTP response code||
||content-type||char *||value of content-type header||
||content-length||int||value of content-length header||

Now, if you wanted to say get a breakdown of latency by handler, you
could do something like this:

    #!/usr/sbin/dtrace -s
    #pragma D option quiet

    helloworld*:::getfoo-*-start
    {
      tracker[arg0, substr(probename, 0, rindex(probename, "-"))] = timestamp;
    }

    helloworld*:::getfoo-*-done
    /tracker[arg0, substr(probename, 0, rindex(probename, "-"))]/
    {
      this->name = substr(probename, 0, rindex(probename, "-"));
      @[this->name] = quantize(((timestamp - tracker[arg0, this->name]) / 1000000));
      tracker[arg0, substr(probename, 0, rindex(probename, "-"))] = 0;
    }

So running the server in one terminal:

    $ node helloworld.js

The D script in another:

    $ ./helloworld.d

Hit the server a few times with curl:

    $ curl http://localhost:8080/hello/mcavage

Then Ctrl-C the D script, and you'll see the "slowHandler" at the
bottom of the stack, bucketized that it's the vast majority of latency
in this pipeline

    $ ./guide.d
    ^C

    getfoo-parseAuthorization
           value  ------------- Distribution ------------- count
              -1 |                                         0
               0 |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ 4
               1 |                                         0

    getfoo-parseDate
           value  ------------- Distribution ------------- count
              -1 |                                         0
               0 |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ 4
               1 |                                         0

    getfoo-parseQueryString
           value  ------------- Distribution ------------- count
              -1 |                                         0
               0 |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ 4
               1 |                                         0

    getfoo-parseUrlEncodedBody
           value  ------------- Distribution ------------- count
              -1 |                                         0
               0 |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ 4
               1 |                                         0

    getfoo-parseAccept
           value  ------------- Distribution ------------- count
              -1 |                                         0
               0 |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@           3
               1 |@@@@@@@@@@                               1
               2 |                                         0

    getfoo-respond
           value  ------------- Distribution ------------- count
               0 |                                         0
               1 |@@@@@@@@@@                               1
               2 |@@@@@@@@@@@@@@@@@@@@                     2
               4 |                                         0
               8 |                                         0
              16 |                                         0
              32 |@@@@@@@@@@                               1
              64 |                                         0

    getfoo-slowHandler
           value  ------------- Distribution ------------- count
              64 |                                         0
             128 |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ 4
             256 |                                         0

# Client API

There are actually three separate clients shipped in restify:

* **JsonClient:** sends and expects application/json
* **StringClient:** sends url-encoded request and expects text/plain
* **HttpClient:** thin wrapper over node's http/https libraries

The idea being that if you want to support "typical" control-plane
REST APIs, you probably want the `JsonClient`, or if you're using some
other serialization (like XML) you'd write your own client that
extends the `StringClient`. If you need streaming support, you'll need
to do some work on top of the `HttpClient`, as `StringClient` and
friends buffer requests/responses.

All clients support retry with exponential backoff for getting a TCP
connection; they do not perform retries on 5xx error codes like
previous versions of the restify client.  Here's an example of hitting
the [Joyent CloudAPI](https://api.us-west-1.joyentcloud.com):

    var restify = require('restify');

    // Creates a JSON client
    var client = restify.createJsonClient({
      url: 'https://us-west-1.api.joyentcloud.com'
    });


    client.basicAuth('$login', '$password');
    client.get('/my/machines', function(err, req, res, obj) {
      assert.ifError(err);

      console.log(JSON.stringify(obj, null, 2));
    });

Note that all further documentation refers to the "short-hand" form of
methods like `get/put/del` which take a string path.  You can also
pass in an object to any of those methods with extra params (notably
headers):

    var options = {
      path: '/foo/bar',
      headers: {
        'x-foo': 'bar'
      },
      retry: {
        'retries': 0
      },
      agent: false
    };

    client.get(options, function(err, req, res) { .. });

## JsonClient

The JSON Client is the highest-level client bundled with restify; it
exports a set of methods that map directly to HTTP verbs.  All
callbacks look like `function(err, req, res, [obj])`, where `obj` is
optional, depending on if content was returned. HTTP status codes are
not interpreted, so if the server returned 4xx or something with a
JSON payload, `obj` will be the JSON payload.  `err` however will be
set if the server returned a status code >= 400 (it will be one of the
restify HTTP errors).  If `obj` looks like a `RestError`:

    {
      "code": "FooError",
      "message": "some foo happened"
    }

then `err` gets "upconverted" into a `RestError` for you.  Otherwise
it will be an `HttpError`.

### createJsonClient(options)

    var client = restify.createJsonClient({
      url: 'https://api.us-west-1.joyentcloud.com',
      version: '*'
    });

Options:

||*Name*||*Type*||*Description*||
||url||String||Fully-qualified URL to connect to||
||headers||Object||HTTP headers to set in all requests||
||accept||String||Accept header to send||
||userAgent||String||user-agent string to use; restify inserts one, but you can override it||
||version||String||semver string to set the accept-version||
||retry||Object||options to provide to node-retry; defaults to 3 retries||
||dtrace||Object||node-dtrace-provider handle||
||log4js||Object||log4js handle||

### get(path, callback)

Performs an HTTP get; if no payload was returned, `obj` defaults to
`{}` for you (so you don't get a bunch of null pointer errors).

    client.get('/foo/bar', function(err, req, res, obj) {
      assert.ifError(err);
      console.log('%j', obj);
    });

### head(path, callback)

Just like `get`, but without `obj`:

    client.head('/foo/bar', function(err, req, res) {
      assert.ifError(err);
      console.log('%d -> %j', res.statusCode, res.headers);
    });

### post(path, object, callback)

Takes a complete object to serialize and send to the server.

    client.post('/foo', { hello: 'world' }, function(err, req, res, obj) {
      assert.ifError(err);
      console.log('%d -> %j', res.statusCode, res.headers);
      console.log('%j', obj);
    });

### put(path, object, callback)

Just like `post`:

    client.put('/foo', { hello: 'world' }, function(err, req, res, obj) {
      assert.ifError(err);
      console.log('%d -> %j', res.statusCode, res.headers);
      console.log('%j', obj);
    });

### del(path, callback)

`del` doesn't take content, since you know, it should't:

    client.del('/foo/bar', function(err, req, res) {
      assert.ifError(err);
      console.log('%d -> %j', res.statusCode, res.headers);
    });

## StringClient

`StringClient` is what `JsonClient` is built on, and provides a base
for you to write other buffering/parsing clients (like say an XML
client). If you need to talk to some "raw" HTTP server, then
`StringClient` is what you want, as it by default will provide you
with content uploads in `application/x-www-form-url-encoded` and
downloads as `text/plain`.  To extend a `StringClient`, take a look at
the source for `JsonClient`. Effectively, you extend it, and set the
appropriate options in the constructor and implement a `write` (for
put/post) and `parse` method (for all HTTP bodies), and that's it.

### createStringClient(options)

    var client = restify.createStringClient({
      url: 'https://example.com'
    })

### get(path, callback)

Performs an HTTP get; if no payload was returned, `data` defaults to
`''` for you (so you don't get a bunch of null pointer errors).

    client.get('/foo/bar', function(err, req, res, data) {
      assert.ifError(err);
      console.log('%s', data);
    });

### head(path, callback)

Just like `get`, but without `data`:

    client.head('/foo/bar', function(err, req, res) {
      assert.ifError(err);
      console.log('%d -> %j', res.statusCode, res.headers);
    });

### post(path, object, callback)

Takes a complete object to serialize and send to the server.

    client.post('/foo', { hello: 'world' }, function(err, req, res, data) {
      assert.ifError(err);
      console.log('%d -> %j', res.statusCode, res.headers);
      console.log('%s', data);
    });

### put(path, object, callback)

Just like `post`:

    client.put('/foo', { hello: 'world' }, function(err, req, res, data) {
      assert.ifError(err);
      console.log('%d -> %j', res.statusCode, res.headers);
      console.log('%s', data);
    });

### del(path, callback)

`del` doesn't take content, since you know, it should't:

    client.del('/foo/bar', function(err, req, res) {
      assert.ifError(err);
      console.log('%d -> %j', res.statusCode, res.headers);
    });

## HttpClient

`HttpClient` is the lowest-level client shipped in restify, and is
basically just some sugar over the top of node's http/https modules
(with HTTP methods like the other clients).  It is useful if you want
to stream with restify.  Note that the event below is unfortunately
named `result` and not `response` (because
[Event 'response'](http://nodejs.org/docs/latest/api/all.html#event_response_)
is already used).

    client = restify.createClient({
      url: 'http://127.0.0.1'
    });

    client.get('/str/mcavage', function(err, req) {
      assert.ifError(err); // connection error

      req.on('result', function(err, res) {
        assert.ifError(err); // HTTP status code >= 400

        res.body = '';
        res.setEncoding('utf8');
        res.on('data', function(chunk) {
          res.body += chunk;
        });

        res.on('end', function() {
          console.log(body);
        });
      });
    });

Or a write:

    client.post(opts, function(err, req) {
      assert.ifError(connectErr);

      req.write('hello world');
      req.end();

      req.on('result', function(err, res) {
        assert.ifError(err);
        res.body = '';
        res.setEncoding('utf8');
        res.on('data', function(chunk) {
          res.body += chunk;
        });

        res.on('end', function() {
          console.log(res.body);
        });
      });
    });

Note that get/head/del all call `req.end()` for you, so you can't
write data over those. Otherwise, all the same methods exist as
`JsonClient/StringClient`.

One wishing to extend the `HttpClient` should look at the internals
and note that `read` and `write` probably need to be overridden.

### basicAuth(username, password)

Since it hasn't been mentioned yet, this convenience method (available
on all clients), just sets the `Authorization` header for all HTTP requests:

    client.basicAuth('mark', 'mysupersecretpassword');
