restify-versions(7) -- REST API Verisioning
===========================================

## SYNOPSIS

    var server = restify.createServer({
      version: '1.2.3'
    });

    server.get('/foo/:id', function(req, res, next) {
      res.send(200);
      return next();
    });

    server.get('1.1.0', '/foo/:id', function(req, res, next) {
      res.send(204);
      return next();
    });


    GET /foo/1 HTTP/1.1
    Host: localhost
    x-api-version: ">=1.2'

    HTTP/1.0 200 OK
    Access-Control-Allow-Origin: *
    Access-Control-Allow-Methods: GET
    Server: restify (node.js)
    Connection: close
    Date: Mon, 13 Jun 2011 04:01:48 GMT
    x-request-id: 531981fb-39ac-4633-a817-76e8adbe40d5
    x-response-time: 0
    x-api-version: '1.2.4'
    Content-Length: 0


    GET /foo/1 HTTP/1.1
    Host: localhost
    x-api-version: "=1.1.0'

    HTTP/1.0 204 No Content
    Access-Control-Allow-Origin: *
    Access-Control-Allow-Methods: GET
    Server: restify (node.js)
    Connection: close
    Date: Mon, 13 Jun 2011 04:01:48 GMT
    x-request-id: 531981fb-39ac-4633-a817-76e8adbe40d5
    x-response-time: 0
    x-api-version: '1.1.0'
    Content-Length: 0

## DESCRIPTION

Restify versioning enables you to build a REST API that uses versioning the same
way you might as an NPM package maintainer.  That is, you specify versions of
your API, either as a "blanket" server configuration, or a-la-carte on a
particular route.  A client MUST then send an x-api-version header specifying
the version of the route they find acceptable.  This is all opt-in, so if you
don't want to run with versioning on, you don't have to.

Once you enable versioning, as shown above, you can pass in a `version` flag to
`restify.createServer`, which will set that version string on all routes
automatically.  You can override each route with a different version string.
Note that restify processes routes in the order they are encountered, so the
*first matching* route for an x-api-version header will be used.  You can
explicitly disable versioning on a route by passing in `null` as the first
parameter.

As to version sytax, two are supported: semver and everything else.  If version
is a valid semver header, then the client can send anything they would to npm
(e.g., '1.x || >=2.5.0 || 5.0.0 - 7.2.3').  Restify uses the lovely node-semver
library to parse these.  If version is not a valid semver string, then clients
MUST send an exact match.

As mentioned above, if versioning is enabled, clients MUST send an x-api-version
header describing the route version they want to use.  This avoids the dreaded
'default' version a service would need to support in perpetuity.

Note that mixing semver and non-semver version strings will result in undefined
behavior.

If there is not a matching version found for a route (but other parameters are
valid), a response of `HTTP/1.1 449 Retry with an x-api-version header` is sent
along with an `x-api-versions` header, which contains a list of valid versions
for that route.

## COPYRIGHT/LICENSE

Copyright 2011 Mark Cavage <mcavage@gmail.com>

This software is licensed under the MIT License.

## SEE ALSO

restify(3), restify-routes(7)
