restify-routes(7) -- Routing in Restify
=======================================

## SYNOPSIS

    function authenticate(req, res, next) {
      // Check the Authorization header
      return next();
    }

    function authorize(req, res, next) {
      // Check ownership of resource
      return next();
    }

    function audit(req, res, next) {
      // Log this request/response
      return next();
    }

    var pre = [
      authenticate,
      authorize
    ];

    var post = [
      audit
    ];

    server.get('/your/:param/:id', pre, function(req, res, next) {
      res.send(200, {
        id: req.uriParams.id,
        message: 'You sent ' + req.uriParams.param,
	sent: req.params
      });
      return next();
    }, post);

## DESCRIPTION

Restify routing looks like a simplified version of Sinatra.  Basically, you
define an HTTP resource path, and optionally paramterize any section of it
with `:parameters`, and restify will do the work of mapping an HTTP verb and
resource to your handler chain.  Anything in the syntax `:param` in your uri
gets set on the `request.uriParams` object with that name.

Everythng after the first argument is any combination of filters/interceptors
that run in the order you define them.  Each function is responsible for calling
`next()`, otherwise the chain stops.  While you can do whatever you want here,
the author recommends a pattern of an array of `pre` interceptors, a route
specific `handler`, followed by an array of `post` interceptors.  Also, note
that restify does not come bundled with any functions to perform common tasks,
like authenticate/authorize/audit, as these are often domain-specific.

## HTTP VERBS

Currently restify supports the following verbs as route definitions:

* HEAD: server.head(...)
* GET: server.get(...)
* POST: server.post(...)
* PUT: server.put(...)
* DELETE: server.del(...)

## RESTIFY ERROR RESPONSES

When a request comes in, and there is no matching resource at all, restify will
return a 404 error message to the client.  If the resource does exist, but there
is not a matching route for the given verb, restify will return a 405. This is
what RFC 2616 tells us we should do, so that's what we do.

## ACCESS-CONTROL-ALLOW-METHODS

restify automatically inserts an access-control-allow-methods header on
`response.send`, and fills it in with all verbs that match the current resource.

For example, the following code:

    server.get('/foo', function(req, res, next) { ... });
    server.put('/foo', function(req, res, next) { ... });
    server.del('/foo', function(req, res, next) { ... });

Would result in restify sending back an access-control-allow-methods header that
was the array `[GET, PUT, DELETE]` when a request was issued against `/foo`.

## COPYRIGHT/LICENSE

Copyright 2011 Mark Cavage <mcavage@gmail.com>

This software is licensed under the MIT License.

## SEE ALSO

restify(3)
