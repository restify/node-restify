restify-response(7) -- The Response Object
==========================================

## SYNOPSIS

    response: {
      accept: 'application/json',
      requestId: uuid(),
      send: function(options),
      sendError: function(restifyError),
      sentError: boolean,
      startTime: new Date().getTime(),
    }

## DESCRIPTION

The restify response object is simply a set of extensions over the standard
node.js http response object.

The additional parameters placed on the request object are:

* accept:
  Contains a parsed out version of the 'Accept' header sent from the client, for
  one of restify's supported formats.  For example, if the client sends \*/\*,
  like curl does, accept will be application/json.
* requestId:
  Is a random uuid set to the same value as on the request object.  It is
  returned to the client in the `x-request-id` header. You should log this.
* send:
  `send` is the main extension to the request object, as it wraps up the node.js
  writeHead/write/end paradigm.  This method exists for you to really pass in
  a JS object, and have that object formatted in a type that restify can
  serialize, and matches what the client sent in the Accept header.  See
  [SEND][] for more information.
* sendError:
  A wrapper method over `send` that takes a restify `error` object, as returned
  from `restify.newError`.  See [ERRORS][] for more information.
* sentError:
  A boolean that is set automatically by `sendError`.  You can use this in
  post filters for logging, etc.
* startTime:
  The time this request arrived at the server.  Note that this timestamp is when
  node.js gives us the request object; so before the body is read, but after the
  headers are. It's in milliseconds since epoch.

## SEND

As noted in the getting started manual, there are two forms of the `send`
function:

    send(code, object, headers);
    send(options);

Where `send(code, object, headers)` takes a Number (HTTP status code), Object
(the JS object you want to send back), and optional Object of headers.  If you
provide the headers object, it is merged in with the standard headers that
restify fills in for you.  Those headers are:

* Access-Control-Allow-Origin: *
* Access-Control-Allow-Methods: [list of methods set on this uri]
* Connection: Close
* Content-Length
* Content-Type
* Content-MD5
* Date (RFC 1123 format, in UTC)
* Server
* X-Request-Id
* X-Response-Time (milliseconds)
* X-Api-Version (if set on createServer)

The `send(options)` form has the following parameters:

    send({
      code: 200,
      headers: {},
      body: {},
      noClose: boolean,
      noEnd: boolean,
      noContentMD5: boolean
    });

This method is used if you want to send back content that restify really doesn't
know what to do with, but you still want to pick up the standard headers (like
request-id, date, etc.).  You do this with the `noClose` and `noEnd` options. In
general, if you want to send back something else to clients, you probably want
to invoke `send` as such:

    response.send({
      code: 200,
      headers: {
        'Content-Type': 'text/html',
        'Trailer': 'Content-MD5',
      },
      noEnd: true
    };

    var hash = crypto.createHash('md5');
    ...
    response.write(data);
    hash.update(data);
    ...
    res.addTrailers({'Content-MD5': hash.digest('base64')});
    res.end();

## ERRORS

The response object also has a `sendError` object that is helpful for
marshalling back 'standard' error messages to clients. Standard here means
consistent, not some actual RFC (there is none).  This is particularly
useful, as it is often the case that an HTTP status code alone is not sufficient
for a client to switch on.  Additionally, restify uses this error method
internally, so you are advised to use it so that your errors fit the same
spec.  The error object restify works with is a standard JS `Error` object
that has the following fields:

    {
      name: 'HttpError',                 // Standard Error field
      httpCode: <HttpStatusCode>,        // Number
      restCode: 'StringInThisFormat',    // String client can switch on
      message: 'Human readable string',  // Whatever you want
      error: Error,                      // An Error 'cause'
      details: {                         // Whatever you want
        ...
      }
    }

There are built-ins for all codes defined in `restify.RestCodes`, and you can
chuck them into `next()` like so:

    server.get('/foo', function(req, res, next) {
      return next(new restify.BadRequestError('you did something wrong'));
    });

In previous versions of restify, you used like `restify.newError`:

    response.sendError(restify.newError({
      httpCode: 409,
      restCode: 'YouAreABadClient',
      message: 'Stop sending me bad stuff',
      details: {
        foo: 'bar',
      }
    }));

HttpCodes are defined on `restify.HttpCodes`, and there are some standard
REST code strings on `restify.RestCodes`.  RestCodes has the following:

* BadRequest: 'BadRequest'
* InternalError: 'InternalError'
* InvalidArgument: 'InvalidArgument'
* InvalidCredentials: 'InvalidCredentials'
* InvalidHeader: 'InvalidHeader'
* InvalidVersion: 'InvalidVersion'
* MissingParameter: 'MissingParameter'
* NotAuthorized: 'NotAuthorized'
* RequestThrottled: 'RequestThrottled'
* RequestTooLarge: 'RequestTooLarge'
* ResourceMoved: 'ResourceMoved'
* ResourceNotFound: 'ResourceNotFound'
* RetriesExceeded: 'RetriesExceeded'
* UnknownError: 'UnknownError'

If you don't set `restCode`, restify sets it to _UnknownError_.  If you don't
set `message`, restify sets it to _Unknown error occured._.  Details and error
are not required, and are not set if not present.

## SECURITY CONSIDERATIONS

Don't send back JS `Error` objects on the `sendError`  in production usage.
That will have your stack traces, etc.  Bad news.

## COPYRIGHT/LICENSE

Copyright 2011 Mark Cavage <mcavage@gmail.com>

This software is licensed under the MIT License.

## SEE ALSO

restify(3), restify-request(7)
