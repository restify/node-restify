restify-request(7) -- The Request Object
========================================

## SYNOPSIS

    request: {
      body, 'Raw data sent from client',
      contentType: function() {
        return 'application/json'
      }
      params: {
        foo: 'bar'
      },
      requestId: uuid(),
      startTime: new Date().getTime(),
      uriParams: {
        foo: 'bar'
      },
      url: sanitized(request.url),
      _url: url.parse(request.url),
    }

## DESCRIPTION

The restify request object is simply a set of extensions over the standard
node.js http request object.

The additional parameters placed on the request object are:

* body:
  Contains a UTF-8 string that is the complete message sent from the client for
  this request.  Note that the body is subject to the `maxRequestSize` set at
  server creation time.  You're not really expected to use this, as the body
  is parsed for you if it's in one of restify's supported formats.
* contentType:
  A function that returns a parsed out content-type header for the content sent
  from the client.
* params:
  Assuming `body` was either form-urlencoded or application/json, body is a JS
  Object containing all the key value pairs sent from the client.  Note that
  nested Object parameters are not supported in form-urlencoded, so if you need
  to support that, your API should only support JSON.
* requestId:
  requestId is a randomly generated type IV uuid, which is sent back to the
  client automagically in the `x-request-id` header.  You really should log
  this, as the intent is that a client of your API can provide this to you for
  debugging/repudation purposes.
* startTime:
  The time this request arrived at the server.  Note that this timestamp is when
  node.js gives us the request object; so before the body is read, but after the
  headers are. It's in milliseconds since epoch.
* uriParams:
  The uriParams object contains a set of key/value pairs for filled in
  parameters from your route description.  It is kept separate from the params
  object so that you can name uri parameters the same name as api parameters
  in your requests.
* url:
  restify overwrites the node.js request.url value with a 'santized' version of
  the url.  What that really means is that any repeated '/' params are
  collapsed and any trailing '/' params are erased.
* _url:
  _url is the result of the node.js url.parse method.
* authorization:
  If there was an Authorization header, restify will parse as much of it as it
  can.  The resulting object is available under the authorization param.  The
  object is guaranteed to have `scheme` and `credentials`.  Credentials is the
  untouched string after being split off from the scheme. Scheme is, obviously,
  the scheme.  As an example `Authorization: Basic abc123` would result in an
  object of `{ scheme: 'Basic', credentials: 'abc123' }`.  If the scheme is
  `Basic`, restify will fully parse out the header as shown below:

    {
      scheme: 'Basic',
      credentials: 'abc123',
      basic: {
        username: 'mark'
        password: 'secret'
      }
    }

## SUPPORTED CONTENT TYPES

Currently restify supports the following content type when parsing requests:

* application/json
* application/x-www-form-urlencoded

Plans to support multipart form data are on the short-term roadmap.

## COPYRIGHT/LICENSE

Copyright 2011 Mark Cavage <mcavage@gmail.com>

This software is licensed under the MIT License.

## SEE ALSO

restify(3), restify-routes(7)
