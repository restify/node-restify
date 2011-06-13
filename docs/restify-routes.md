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
      log.w3c,
      audit
    ];

    server.get('1.2.3', '/your/:param/:id', pre, function(req, res, next) {
      res.send(200, {
        id: req.uriParams.id,
        message: 'You sent ' + req.uriParams.param,
        sent: req.params
      });
      return next();
    }, post);

    server.get(/^\/img\/*/, function(req, res, next) {
      fs.readFile('./media' + req.url, 'utf8', function(err, file) {
        if (err) {
          res.writeHead(500);
          response.end();
          return next();
        }

        res.writeHead(200);
        res.write(file);
        res.end();
        return next();
      });
    };


## DESCRIPTION

Restify routing is similar to, but different than, express and sinatra.
You define, at minimum, a URL which is optionally parameretized (with ':'
prefixes), and any number of handler functions.  You can substitute a `RegExp`
for the string URL if you like.  Additionally, you can version a route; see
restify-versions(7) for details on versioning.  Last but not least, a key
feature of restify is that you can set up `pre` and `post` handlers that run
before and after your `main` handlers (can be any number of functions or arrays
of functions).

When using the string syntax for a URL, you can optionally paramterize any
section of it with `:parameters`, and anything in the syntax `:param` in your
url gets set on the `request.uriParams` object with that name.

Each function in your chain is responsible for calling `next()` otherwise the
processing chain will stop.

A special pattern in restify is the notion of passing in an array for the first
and last handlers.  Doing so makes restify automatically treat them as `pre` and
`post`, respectively. This has the following semnatics:

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
in your functions. If you don't, your chain gets dropped. It's that simple.

Also note that if you're not using an array of functions for the first and last
handlers, restify does not perform the logic above.  It instead falls back to
what express does, and it's up to you to manage your call chain.

As to URL parameters, note that they can be either parameterized string URLs,
(e.g., `/:user/stuff/:id`) or a `RegExp`.  In either case, the parameters are
available to your handler functions as `request.uriParams`.  In the non-regex
case, they're as you named them (minus the ':', of course).  In the `RegExp`
case, they're available in the array `RegExp.exec()` returns.

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
is not a matching route for the given verb, restify will return a 405. Lastly,
if there is both a resource and a URL, but not a matching version, restify will
return a 449 with an `x-api-versions`.  449 is a Microsoft HTTP extension status
code that means 'retry-with'; I chose to snag that and use it here to mean
'retry with a different version'. Restify does not pass back any MS headers.

## ACCESS-CONTROL-ALLOW-METHODS

restify automatically inserts an access-control-allow-methods header on
`response.send`, and fills it in with all verbs that match the current resource.

For example, the following code:

    server.get('/foo', function(req, res, next) { ... });
    server.put('/foo', function(req, res, next) { ... });
    server.del('/foo', function(req, res, next) { ... });

Would result in restify sending back an access-control-allow-methods header that
was the array `[GET, PUT, DELETE]` when a request was issued against `/foo`.

## HTTP OPTIONS

Restify automatically supports the HTTP OPTIONS verb based on your routes.  You
can call OPTIONS against either a specific resource or `*`.  Either way, restify
handles it, and currently does not expose the ability to override it.

## COPYRIGHT/LICENSE

Copyright 2011 Mark Cavage <mcavage@gmail.com>

This software is licensed under the MIT License.

## SEE ALSO

restify(3), restify-versions(7)
