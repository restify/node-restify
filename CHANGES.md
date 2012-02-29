# restify Changelog

## 1.1.1 (not yet released)

## 1.1.0

- GH-86 Bunyan version bump.
- Conditional Request plugin tests and fixes for some errors (Mike Williams).
- GH-83 pluggable storage engine for throttling, and LRU for default engine.
- GH-77 `server.on('uncaughtException', function (req, res, route, err) {});`
- GH-79 Docs typo(s).

## 1.0.1

- Version bump bunyan to 0.6.4.


## 1.0.0

- Makefile restructure (use Joyent templates)
- GH-20 HttpClient connectTimeout.
- Allow parser plugins to allow "override" params
- Proper handling of Expect: 100
- multipart/form-data plugin
- Added a 'header' event on res.writeHead
- GH-72 Wrong server name in response header on 404/405/...
- RegExp mounts throw a TypeError
- Allow pre handlers to update request url
- try/catch around route running
- Bundled audit logger (via bunyan)
- strict adherence to RFC3986 for URL encoding
- range versioning changed to be an array of explicit versions
- Switch from log4js to [bunyan](https://github.com/trentm/node-bunyan)
- Official version of `ConditionalRequest` plugin (Falco Nogatz)
- order formatters on response such that JSON/text are before custom ones
- RestErrors can use format strings
- date plugin has bad log check


## 1.0.0-rc2

- GH-66 Support for charSets in responses
- GH-65 Initial version of etag plugin (Falco Nogatz)
- GH-68 res.header() can serialize Date objects to RFC1123
- GH-67 Set some default response headers earlier (access-control-*)
- http-client should auto insert the date header
- GH-64 Support for a pre-routing chain
- JsonClient should "upcast" errors to RestErrors if it can
- GH-63 res.send(204) returning a body of 204
- GH-61 Make bodyParser merging into req.params optional
- Make Error objects backwards compatible with older restify (httpCode/restCode)
- GH-57, GH-62 range versioning on server (Diego Torres)
- GH-59 routes with just '/' are returning 404
- DTrace *-done actually firing content-length (was always 0)
- [Issue 56] Support streaming downloads
- Modify server.on('after') to emit the `Route` object, rather than the name.

## 1.0.0-rc1

(Started maintaining this log 21 January 2012. For earlier change information
you'll have to dig into the commit history.)
