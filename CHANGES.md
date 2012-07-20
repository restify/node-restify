# restify Changelog

## 1.4.4 (not yet released)

- GH-177 move to dtrace-provider 0.0.9
- GH-172 option `keepExtensions` in body parser (Luri Aranda)
- GH-173 set req.files on multipart (Jonathan Wiepert)
- GH-169 json body parser failing content-md5, sometimes
- GH-166 plugins assume content-length is integer (Petter Rasmussen)
- GH-164 Get rid of ETag quotes and W/ prefix for ETag header (Dominic Denicola)
- GH-163 Don't default content-length to 0
- GH-160 don't rely on npm's directories: "bin".
- GH-159 req.charset not working (Tamas Daniel)
- set `req.params.files` on multipart file uploads

## 1.4.3

- update dependencies to latest (notably dtrace-provider)
- GH-158 res.charSet broken (Tamas Daniel)
- GH-154 bodyParser work with PATCH (Domenic Denicola)
- GH-153 bodyParser can reject or allow unknown content-types (Domenic Denicola)
- GH-152 Send JSON on HttpError (Domenic Denicola)
- GH-149 allow setting of max body size (and return 413) (Simon Sturmer)
- GH-146 allow setting of route regex flags when path is not a RegExp
- Support SSL CAs (Paul Bouzakis)
- body parser should return 415 when content-type not known (Simon Sturmer)


## 1.4.2

- Add Route.realize( Domenic Denicola)
- defaultResponseHeaders setter was setting the wrong method (Harry Marr)
- Workaround joyent/node#3257 (Dave Pacheco)
- logging typo (Pedro Candel)
- response `beforeSend` event (Paul Bouzakis)

## 1.4.1

- GH-130 Allow restify and express to coexist.
- GH-129 format HttpErrors as well as RestErrors (Domenic Denicola)
- GH-127 add absolute uri to request (Paul Bouzakis)
- GH-124 `req.query` is `undefined` if no query string was sent
- GH-123 Generated DTrace probe names should be valid
- GH-122 Response._writeHead can cause infinite loop (Trent Mick)
- GH-120 Allow server.patch (Paul Bouzakis)
- GH-119 defaultResponseHeaders not settable
- GH-113 document `return next(false)`


## 1.4.0

- GH-116 More friendly error objects (Domenic Denicola)
- GH-115 Client hangs on server "hard kills" (i.e., RST)
- GH-111 JSON parser only works on objects (not arrays)
- GH-110 emit expectContinue (Paul Bouzakis)
- Fix "undefined" log message in string_client.js
- GH-107
  - Go back to hacking up http.prototype for performance reasons
  - Default to keep-alive on for HTTP/1.1 requests
  - Misc fixes after refactoring.
- GH-109 routes not honoring regex flags.
- GH-108 server missing `listening` event.
- Audit logger optionally logs request/response bodies
- Require http-signature@0.9.9/ctype@0.5.0 (node 0.7 compatible)

## 1.3.0

- GH-100 Make DTrace an optional dependency, and stub it out if not found.
- res.link API not allowing sprintf style sets.
- Support for `socketPath` in client API (alternative to url).
- OPTIONS api not returning access-control-allow-methods header (Steve Mason).
- Allow null passwords in HTTP basic auth (Andrew Robinson).
- set `req.files` on multipart file uploads (Andrew Robinson).

## 1.2.0

- Don't rely on instanceof checks for Errors in response.
- Change route.run log level from trace to debug on next(err).
- Add `res.link` API (wrap up sending a Link: response header).
- GH-98 req.secure needs to return a boolean, not an object
- GH-97 Malformed URI results in server crash
- GH-94 leverage `qs` module for object notation in query string.

## 1.1.1

- dependency version bumps
- res.header accepts sprintf-style arguments
- GH-95 Make restify compatible with node-logging (Andrew Robinson)
- GH-93 Minimal port of express pre-conditions (Dominic Barnes)
- GH-92 Make X-Response-Time configurable (Shaun Berryman)
- GH-87 server.listen on port as string (Andrew Sliwinski)

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
