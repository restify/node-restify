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
REST web services.  restify is **not** an MVC framework and  does not come
bundled with unnecessary functionality (such as templating).  restify lets you
do one thing, which is easily build machine-consumable web service APIs that
correctly implement HTTP.

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
      apiVersion: '1.2.3',   // a semver string (see [VERSIONING] below)
      serverName: 'MySite',  // returned in the HTTP 'Server:` header
      exceptionHandler: function(e) {}, // calls function(2) on uncaught errors
      maxRequestSize: 8192,  // Any request body larger than this gets a 400
      clockSkew: 300,        // Allow up to N seconds of skew in the Date header
      accept: ['application/json']  // Allow these Accept types
    }

Defaults/Details for the paramters above:

* apiVersion:
  By default, there is no version handling invoked.  However, if you do specify
  this header, then `x-api-version: 1.2.3` will be returned in all HTTP
  responses.  Additionally, clients are expected to send an `x-api-version`
  header that matches.  In the **very** near future, expect this parameter to
  support versioned routes (i.e., so you can map handlers to versions).
* serverName:
  Simple string that is not interpreted and returned in the 'Server:' HTTP
  header.  Defaults to `node.js`.
* exceptionHandler:
  Installs your function to handle all uncaught JS exceptions.  If you **don't**
  provide one, restify installs a default handler that simply returns 500
  Internal Server Error, and logs a warning.
* maxRequestSize:
  Caps the amount of data a client can send to your HTTP server, in bytes.
  Defaults to 8192 (8k).
* clockSkew:
  If the client sends a 'Date' header, it is checked to be within `clockSkew`
  seconds, in either direction. Defaults to 300s (5m).
* accept:
  An array of Acceptable content types this server can process. Defaults to
  `application/json`.  Not really useful as of yet.

## ROUTING

As of v0.1.6, routes are simple exact matches, and do not support RegEx
matching.  This is on the feature list however.  Routes are installed on the
server object with the HTTP verb to map to, a paramterized URL, and any
combination of functions or array of functions as arguments.

    server.head('/foo/:id', [pre1, pre2], handler, [post1]);
    server.get('/foo/:id', [pre1, pre2], handler, [post1]);
    server.post('/foo', [pre1, pre2], handler, [post1]);
    server.put('/foo/:id', [pre1, pre2], handler, [post1]);
    server.del('/foo/:id', [pre1, pre2], handler, [post1]);

All functions passed in are expected to be of the form:

    function(request, response, next);

Note that you **must** call return next(); in your function when done if you
want the chain to carry through (sometimes you might not want to do that).

All :parameter names you specify in the URL route get parsed into the
`request.uriParams` object.  For example, in the routes above, you could access
`id` at `request.uriParams.id`.  Note these parameters are **not** on the
`request.params` object, which is where any API parameters a client sends in are
placed.

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

restify ships with a minimal approximation of the log4j logger.  You are
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
the level to Trace.

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

restify-request(7), restify-response(7), restify-routes(7), restify-log(7)
