restify-client(7) -- The restify client
=======================================

## SYNOPSIS

    var restify = require('restify');

    var client = restify.createClient({
      url: 'http://localhost:8080',
      version: '1.2.3',
      retryOptions: {
        retries: 2,
        minTimeout: 250
      }
    });

    client.get('/users', function(err, body, headers) {
      if (err)
        return console.log(err);

      console.log('Body: ' + body);
      console.log('Headers: ' + JSON.stringify(headers, null, 2));
    });

    var req = {
      path: '/mark/update',
      body: {
        foo: 'bar'
      },
      query: {
        action: 'addAttribute'
      },
      expect: [200, 201, 202, 204]
    };
    client.post(req, function(err, body, headers) {
      if (err)
        console.log(err);
    });
    client.head('/mark', function(err, headers) {
      if (err)
        return console.log(err);

      console.log('Headers: ' + JSON.stringify(headers, null, 2));
    });


## DESCRIPTION

The restify client is the complement to the server; that is it tries to offload
some of the difficulty of dealing with REST APIs and node.js. Like the server
routing, you define 'get/head/put/post/del' methods with a URL path, and wait
for your callback to get invoked.  Advanced usage involves sending a fully
parameretized request object to these methods.  More on that below.

One of the big value adds is that it bakes in exponential backoff and retries;
If you're not familiar with how that works or why you nee it, read this:
http://dthain.blogspot.com/2009/02/exponential-backoff-in-distributed.html .
Basically, if you're making requests to another system, there's almost never a
case when you don't want this.  The restify client uses node-retry under the
hood, and so the options you pass in retryOptions go straight through to that
module.

## CREATING A CLIENT

To create a client, invoke `restify.createClient`.  This method takes an
optional `options` Object, of the following syntax:

    {
      version: '>=1.2.3',        // x-api-version to send
      url: 'http://google.com',  // What to talk to
      path: '/v1',               // path to prefix on all requests
      headers: {
        'x-foo-bar': 'bah'       // Any Additional headers
      },
      contentType: 'application/x-www-form-urlencoded', // How to send data
      retryOptions: {
        retries: 5               // node-retry options
      }
    }

## ISSUING REQUESTS

Like the server API, you issue requests with restify by invoking a method of the
same name as the HTTP verb you want to invoke.  There are two ways to invoke
these APIs, either with a string path to hit, in which case restify makes some
(hopefully) sane guesses about what the endpoint will return, or with a fully
parameterized request object, in which case restify doesn't make any guesses.

If you're issuing a fully parameterized request, the object syntax is:

    {
      path: '/foo',
      body: {
        key: 'value'
      },
      query: {
        limit: 10,
        offset: 11
      },
      expect: [100, 200]
    }

Where `path` is the resource to hit (remember this is suffixed to the path you
passed into the `createClient` call), `body` is any data to send in the request,
serialized with `contentType`. `query` is a set of params to tack on as a query
string, and `expect` is either a single code or an array of codes to check for
on response from the server.

Most of these should be obvious, but expect is noteworthy in that if the server
didn't return a status code matching that code, your callback will get an error.

## APIs

    client.get(request, function(err, body, headers, res) {});
    client.head(request, function(err, headers, res) {});
    client.post(request, function(err, body, headers, res) {});
    client.put(request, function(err, body, headers, res) {});
    client.del(request, function(err, headers, res) {});

* get expects a 200 by default.
* head expects [200, 204] by default.
* post expects [200, 201] by default.
* put expects [200, 201] by default.
* del expects [200, 202, 204] by default.

## HEADERS

The restify client automatically fills in the following headers:

* Date
* Accept (always application/json)

If there is a body, then additionally:

* Content-Type
* Content-Length
* Content-MD5

## COPYRIGHT/LICENSE

Copyright 2011 Mark Cavage <mcavage@gmail.com>

This software is licensed under the MIT License.

## SEE ALSO

restify(3), restify-versions(7)
