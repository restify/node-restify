restify(3) -- Getting Started with restify
==========================================

## SYNOPSIS

    var restify = require('restify');
    var server = restify.createServer();

    server.get('/my/:name', function(req, res) {
      res.send(200, {
        message: 'Hello ' + req.uriParams.name
      });
    });

    server.listen(8080);

## DESCRIPTION

restify is a node.js module built specifically to enable you to build correct
REST web services.  restify is **not** an MVC framework and does not come
bundled with unnecessary functionality for this use case (such as templating).
restify lets you do one thing, which is easily build machine-consumable web
service APIs that correctly implement HTTP.

restify's external API looks very similar to some amalgam of sinatra and
express.  This man page contains basic getting started information, and plenty
of references to more details on the API.

## INSTALLATION

    npm install restify

## GETTING STARTED

To create an instance of the restify HTTP server, simply call the `createServer`
api on the top-level module.  This method takes an optional `options` Object, of
the following syntax:

    {
      version: '1.2.3',      // The default version  (see restify-versions(7))
      serverName: 'MySite',  // returned in the HTTP 'Server:` header
      maxRequestSize: 8192,  // Any request body larger than this gets a 400
      clockSkew: 300,        // Allow up to N seconds of skew in the Date header
      accept: [
        'application/json',  // Allow these Accept types
        'application/foo'
      ],
      contentHandlers: {     // A hash of custom content-type handlers
        'application/foo': function(body) {
          return JSON.parse(body);
        }
      },
      contentWriters: {      // A hash of custom serializers
        'application/foo': function(obj) {
          return JSON.stringify(obj);
        }
      },
      headers: {             // A hash of customer headers
        'X-Foo': function(res) {
          return 'bar';
        }
      },
      key: <PEM>,            // Together with `cert`, create an SSL server
      cert: <PEM>            // Together with `key`, create an SSL server
    }

Defaults/Details for the paramters above:

* version:
  By default, there is no version handling invoked.  However, if you do specify
  this header, then `x-api-version: 1.2.3` will be returned in all HTTP
  responses.  Additionally, clients MUST send an `x-api-version` header that
  satisfies that version.  See  restify-versions(7) for more details, as this is
  a large feature set.
* serverName:
  Simple string that is not interpreted and returned in the 'Server:' HTTP
  header.  Defaults to `node.js`.
* maxRequestSize:
  Caps the amount of data a client can send to your HTTP server, in bytes.
  Defaults to 8192 (8k).
* clockSkew:
  If the client sends a 'Date' header, it is checked to be within `clockSkew`
  seconds, in either direction. Defaults to 300s (5m).
* accept:
  An array of Acceptable content types this server can process. Defaults to
  `application/json`.  Not really useful as of yet.
* contentHandlers:
  By default, restify supports (and doesn't let you override) clients sending
  content in `application/json`, `application/x-www-form-urlencoded` and
  `multipart/form-data`.  If you want your clients to be able to send content
  in a custom format, you can specify it in this option; keys are (lowercase)
  MIME type, value is a function that takes a (UTF-8 string) body, and returns
  an object of k/v pairs that get merged into `request.params`.  Note that
  this is only for parsing, not for using `res.send`.
* contentWriters:
  By default, restify supports (and doesn't let you override) servers sending
  content in `application/json`, `application/x-www-form-urlencoded`. If you
  want to use `res.send` with custom content types, you will need to add a
  custom writer to this object.  *You must additionally set the* `accept`
  *array to allow it!*.  Using this dictionary, you can then use the
  `res.send` naturally with content-types not built-in to restify.
* headers:
  An object of global headers that are sent back on all requests. Restify
  automatically sets the list below.  If you don't set those particular keys,
  restify fills in default functions; if you do set them, you can fully override
  restify's defaults. Note that like contentWriters, this is an object with a
  string key as the header name, and the value is a function of the form
  f(response) which must return a string.  Defaults:
   - X-Api-Version (if versioned)
   - X-Request-Id
   - X-Response-Time
   - Content-(Length|Type|MD5)
   - Access-Control-Allow-(Origin|Methods|Headers)
   - Access-Control-Expose-Headers



## ROUTING

Routing is similar to, but different than, express.  Defining a route still
looks like a `method` name tacked onto the server object, but you can (1)
pass in versions (so you can define a versioned route), (2) you can pass in
whatever combination of functions you see fit, with the exception that if
*both the first and last* handlers are an array of functions, they are treated
as `pre` and `post` interceptors.  This has the following semnatics:

* `pre[0]` is guaranteed to be called.  If you do not call `response.send` or
  `response.sendError` in your `pre` chain, and your pre functions all call
  `next()`, your `main` chain will get invoked. If your pre chain calls
  `response.send` or `response.sendError`, your `main` chain will be skipped,
  and `post[0]` will be invoked next (assuming you are still calling `next()`).
* Once in your `main` chain, if you call `response.sendError`, restify will
  stop processing your `main` handlers, and skip to `post`.  Calling
  `response.send` does not have this effect, as you are expected to call
  `response.send` as part of a "normal" request.
* Once your `post` chain is invoked, restify stops playing with ordering.

Note that for this to work as described, you *still have to call next()*
in your functions!

Also note that if you're not using an array of functions for the first and last
handlers, restify does not perform the logic above.  It instead falls back to
what express does, and it's up to you to manage your call chain.

As to URL definitions, note that they can be either parameterized string URLs,
(e.g., `/:user/stuff/:id`) or a `RegExp`.  In either case, the parameters are
available to your handler functions as `request.uriParams`.  In the non-regex
case, they're as you named them (minus the ':', of course).  In the `RegExp`
case, they're available in the array `RegExp.exec()` returns.

As some examples:

    server.head('/foo/:id', [pre1, pre2], handler, [post1]);
    server.get('/foo/:id', [pre1, pre2], handler, [post1]);
    server.post('/foo', [pre1, pre2], handler, [post1]);
    server.put('/foo/:id', [pre1, pre2], handler1, handler2, [post1]);
    server.del('/foo/:id', handler1, handler2, handler3);
    server.get(/^\/media\/img\/*/, function(req, res, next) {...});

All functions passed in are expected to be of the form:

    function(request, response, next);

Lastly, you can version your routes, as such:

    server.get('1.2.3', '/:user/foo/:id', [pre], [handlers], [post]);
    server.get('1.2.2', '/:user/foo/:id', myLegacyHandler);

Again, see restify-versions(7) to understand how versioning works.

## REQUEST PARAMETERS

restify supports API parameters in form-urlencoded content and application/json
bodies.  All parameters are placed on the `request.parameters` object.  For
example, a request like:

    server.post('/foo/:id', function(req, res, next) {});

    POST /foo/123?param1=dog&param2=cat
    Host: example.com
    Content-Type: application/x-www-form-urlencoded

    param3=bird&param4=turtle

Would result in a request object like:

    {
      uriParams: {
        id: '123'
      },
      params: {
        param1: 'dog',
        param2: 'cat',
        param3: 'bird',
        param4: 'turtle'
      }
    }

Note that restify supports form-urlencoded parameter parsing, as well as
application/json parsing.  Any parameters are merged with query string
parameters.

For more details on the request object, see `npm help restify-request`.

## SENDING RESPONSE

Responses are sent by your handler using either the `send` or `sendError`
api.

The `send` method can be invoked in one of two forms:

    response.send(code, body, headers);
    response.send({
      code: 200,
      body: {
        message: 'Hello World'
      }
      headers: {
        'x-foo': 'bar'
      }
    });

The first form being more common, the latter form being preferable for
advanced use cases.  In the first form, code is a `Number`, body is
a JS `Object`, and headers is an optional JS `Object`.

For more details on the respose object, see `npm help restify-response`.

## LOGGING

restify ships with a minimal interpretation of the log4j logger.  You are
not required to use it in any way.  You can tune the restify logging level
with `restify.log.level(restify.LogLevel.<Level>)`, where <Level> is one
of:

* Fatal
* Error
* Warn
* Info
* Debug
* Trace

The default level is Info.  To get verbose internal logging from restify, set
the level to Trace. All messages from these apis go to stderr.

Note that for the handful of cases where restify doesn't invoke your handlers,
(e.g., 404, 405, 406), restify will output a w3c-compliant message to stdout.

You can redirect stdout/stderr by passing a `WriteableStream` to
`log.stdout(stream)` and `log.stderr(stream)`, respectively.

For more details on logging, see `npm help restify-log`.

## SECURITY CONSIDERATIONS

restify does not provide you any built-in authentication or authorization.  It
is typical that you will need to implement 2 `pre` filters to handle these.
You should additionally consider always adding an audit `post` filter on all
requests.

## COPYRIGHT/LICENSE

Copyright 2011 Mark Cavage <mcavage@gmail.com>

This software is licensed under the MIT License.

## SEE ALSO

restify-request(7), restify-response(7), restify-routes(7), restify-versions(7),
restify-log(7), restify-client(7), restify-throttle(7)
