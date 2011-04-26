node-restify is meant to do one thing: make it easy to build an API webservice
in node.js that is correct as per the HTTP RFC. That's it. It's not MVC, it
doesn't bring in a lot of baggage, it's just a small framework to let you
build a web service API.

## Why does this exist?

After starting with express for several backend, machine-consumed projects
it because obvious I only needed about 10% of what connect gives you, and the
parts they gave me still required  writing a lot of extension code over the top
to do what I needed (mainly properly parse request parameters and respond with
JS objects).

I wanted something smaller and more purposed to this use case.  If this isn't
you, move along, nothing to see here.

## tl;dr

    var restify = require('restify');

    var server = restify.createServer();

    server.get('/my/:name', function(req, res) {
      res.send(200, {
        name: req.params.name
      });
    });

    server.post('/my', function(req, res) {
      // name could be in the query string, in a form-urlencoded body, or a
      // JSON body
      res.send(201, {
        name: req.params.name
      });
    });

    server.del('/my/:name', function(req, res) {
      res.send(204);
    });

    server.listen(8080);

## Installation

    npm install restify

## Usage

### Request Formats

Currently both application/x-www-form-urlencoded and application/json are
supported where API calls take parameters.  For exmaple, all of the
following are valid calls:

Query String (on the uri):

    POST /my?first_name=mark&last_name=c HTTP/1.1
    Host: your.host.name
    Authorization: ...
    Content-Lenght: 0

Form encoded in the body:

    POST /my HTTP/1.1
    Host: your.host.name
    Authorization: ...
    Content-Type: application/x-www-form-urlencoded
    Content-Length: 123

    first_name=mark&last_name=c

JSON in the body:

    POST /my HTTP/1.1
    Host: your.host.name
    Authorization: ...
    Content-Type: application/json
    Content-Length: 123

    {
      "first_name": "mark",
      "last_name": "c"
    }

These formats all get merged into `request.params`.

### Response Headers

RESTify sends the following headers in all API calls:

* Date             // RFC1123 format (in UTC)
* X-Api-Version    // The version of the server api
* X-Request-Id      // a unique id for this request (uuid)
* X-Response-Time  // Time taken (server side) in milliseconds
* Access-Control-Allow-Origin: *
* Access-Control-Allow-Methods: HEAD, GET, POST, PUT, DELETE

If there is content, you can expect:

* Content-Length
* Content-Type
* Content-MD5

### Response Content

Response formats are goverened by the 'Accept' header.  Currently, the following
are supported:

* application/json

JSON responses are the default (so passing nothing, */*, or application/* into
for Accept gets you back application/json).  You simply call the `response.send`
API with your JS object, and it gets marshalled.  On my TODO list are supporting
XML and whatever else people ask for (msgpack/protobuf/etc).

### Error Responses

If you get back any error code in the 4xx range, you will receive a formatted
error message of the scheme:

    {
      "code": "CODE",
      "message": "human readable string"
    }

Where the code element is one of:

* InvalidArgument
* InvalidCredentials
* InvalidHeader
* MissingParameter
* NotAuthorized
* RequestTooLarge
* ResourceNotFound
* UnknownError

Clients are expected to check HTTP status code first, and if in the 4xx range,
they can leverage the codes above.  To send your own error, leverage the `error`
API.  Basically do this:

     var newError = require('restify').newError;

     return response.sendError(newError({
        httpCode: 409,
        restCode: 'YourErrorCode',
        message: 'Some human parsable error string'
      }));

Would produce a full response to the client like:

     HTTP/1.1 409 Conflict
     Access-Control-Allow-Origin: *
     Access-Control-Allow-Methods: HEAD, GET, POST, PUT, DELETE
     Server: node.js
     Connection: close
     Date: Mon, 25 Apr 2011 21:52:45 GMT
     X-API-Version: 2011-004-25
     X-Request-Id: C94A6FD8-9C37-405D-B66A-47E7B7D0F800
     X-Response-Time: 13
     Content-Type: application/json
     Content-Length: 123
     Content-MD5: VOLosaU+eL4laO6gP5KiTw==

     {
        "code": "YourErrorCode"
        "message": "Some human parsable error string"
     }

To leverage the built in error codes, pick up `restify.RestCodes`.  Also, HTTP
constants are defined on `restify.HttpCodes`.

### Routes

Like every other framework on the planet, I liberally made this look like
Sinatra.  You don't get full on regex's, but I've never had a reason, when
trying to write a simple REST api to need them.  Want them? Go use something
else.  Basically you can define routes like:

      server.get('/:foo/:bar', pre, handler, post);

Where pre is an array of functions, handler is a function, and post is another
array of functions.  Note you can pass in one function, one array, whatever. I
am simply saying this is following the _Interceptor_ pattern that exists in
something like Java servers (e.g. Jetty).  The :foo and :bar become parameters
of the name foo, bar, respectively on `req.params`.  As described above, any
query params or body content get tacked in there too.  If you have conflicting
params, we throw.  So don't do that.

As to route methods, no silly webdav or anything, just:

* get
* post
* put
* del
* head

## API

### CreateServer

You create a server with the createServer(options) call:

    var server = restify.createServer({
      apiVersion: '2011-04-25', // Kicked back in X-Api-Version response header
      serverName: 'RESTify', // Kicked back in Server response header
      requireApiVersion: true // Enforce clients sending you a version header
    });

Supported parameters in options are listed above.  `apiVersion` is enforced if
sent in the `x-api-version` HTTP header.  Setting `requireApiVersion` requires
a client to send it (typically you want this with a web service API so you're
not supporting some weird version 0 for all of time).  Note that if you don't
set `apiVersion` the default set in lib/constants.js is sent back (which is a
YYYY-MM-DD string), so that's probably not what you want.  Set it ;-).  Lastly,
setting `serverName` lets you set the `server` header on all responses.

### Routes

As described above, tack get/post/put/del/head onto the server object.

### Request

Basically there's only a few new things tacked onto your familiar node `request`
object:

* contentType(): returns the content-type sent, or RFC-defined default.
* requestId: a uuid generated at request acceptance time.  Send this to your
downstreams for tracking.
* params: an object containing a merge of querystring, uri and body parameters.
* body: the raw body data that came in.
* startTime: the time the request was received at the server (not when data
  was finished processing).

### Response

I tacked quite a bit onto the response object:

* send(code, body, headers): serializes body into whatever was sent for Accept.
* sendError(error):  use restify.newError() (see below)
* startTime: what it sounds like (ms since epoch)

### Errors

As described above, grab the error creation function with:

    var newError = require('restify').newError;

    response.send(newError({
      httpCode: HttpCodes.NotFound,
      restCode: 'ClientParsableString',
      message: 'Some string meant for a human'
    });

Why does this exist?  Because clients typically need more than just an HTTP
status code to make an intelligent decision (400/409 means a lot of things...).
And it gives you a natural place to start thinking about where to put translated
strings.

### Logging

Oh yeah, I wrote a simple logger for this (simple log4j-like thing).  You get
the following levels:

* Trace
* Debug
* Info
* Warn
* Error
* Fatal

These all write to `stderr`, and you'll get formats like:

    2011-03-25 20:28:21Z TRACE: Some message string here

Basically, `YYYY-MM-DD HH:MM:SSZ LEVEL: Your string here`.  You get sprintf-like
functionality in the name of `%s`, `%d`, and `%o` for strings, numbers and
objects, respectively.  You can set the log level on the server with:

    server.logLevel(restify.LogLevel.Debug);

Default level is Info.  Setting it to Trace gets you debug output from the
restify framework.  Debug is meant for you.  Isn't that sweet?  You can grab the
logger with:

    var log = require('restify').log;

Also, as in log4j, to avoid a crapload of stack-based string building when
you're not even in that level, you can wrap all log calls with:

    if (log.debug()) {
      log.debug('Some message I %s: %o', 'made up', {foo: 'bar'});
    }

That works on all the levels.

## License

MIT.

## Bugs

See <https://github.com/mcavage/node-restify/issues>.
