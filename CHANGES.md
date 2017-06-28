# restify Changelog

## 5.0.0
 - #1377 Remove async formatters
 - #1363 Honor port for `Response.prototype.redirect`
 - #1369 Use public APIs for accessing response headers
 - #1353 Deprecate `next.ifError`
 - #1346 Return plugins to repo
 - #1322 Remove duplicate `close` event from `Server`
 - #1309 Add `getRoute()` to Request to get the route object. Rajat Kumar
 - #1288 add `pre` and `routed` events. Yunong Xiao
 - #1281 Add `server.getDebugInfo()` method, Yunong Xiao, Alex Liu
 - #1281 `server.unfinishedRequests()` to `server.inflightRequests()`, Yunong Xiao
 - #1256 add `req.id()` method, Alex Liu
 - #1251 add `req.connectionState()` method, Alex Liu
 - #1250 add `server.unfinishedRequests()` method, Alex Liu
 - #1247 Update jyoent cloud API link in README, Devinsuit
 - #1246 Fix syntax error in plugins.md example, Aria Stewart
 - #1241 Rev formidable to remove Node6+ warnings, Alex Liu
 - #1234 Update uuid to version 3.0.0, Marc Bachmann
 - #1212 Fix typos in plugins.md, Greg Walden
 - #1199 Update examples to use ES6, Amila Welihinda
 - #1190 Fix minor typo, The-Alchemist
 - #1179 Fix typo in comment, Niklas Ingholt
 - Fix dtrace demo to not use async formatter, Yunong Xiao
 - #1171 Router unmount now works for versioned routes, gcssabbagh
 - #1143 add docs about serveStatic plugin, Michael Burguet
 - #1135 ability to find a route by a path, Jacob Quatier
 - #1129 always invoke res.send callback if one is provided, even when the
   selected formatter is sync, Alex Liu
 - #1128 don't send domain errors to the client, Alex Liu
 - #1123 add deprecation warnings for domain dependent features, Alex Liu
 - #1119 set response status code to 0 when the request is terminated by the
   client, Alex Liu
 - #1118 remove undocumented exports and other unused methods, Alex Liu
 - #1113 Fix JSDOC comments, Marc Riegel
 - #1111 new documentation guides, Nicolas Artman
 - #1092 support for strict routing, lukealbao
 - #1089 remove route from LRU cache on when calling `server.rm`, Luis Gómez
 - #1086 support re-using request id headers on incoming requests, Alex Liu
 - #1081 update documentation, default content-type is now application/json,
   Dmitry Kirilyuk
 - #1078 send the server name down in the header per documentation, Alex Liu
 - #1072 update documentation for accept-version header, Ingo Renner
 - #1071 rev node-uuid to address advisory CVE-2015-8851, Alex Liu
 - #1056 fix `req.absoluteUri()` to use correct protocol, David Marek
 - #1032 fix potential xss vector, Alex Liu
 - #1024 **BREAKING** Disabled the uncaughtException handler by default, added
   server option 'handleUncaughtExceptions' to allow enabling of it again
   (restify 4.x and before used to handle exceptions by default), Todd Whiteman
 - #1047 update documentation for spdy example, Tyler Akins
 - #1041 add `rejectUnknown` option to restify plugin documentation, Dmitry
   Kirilyuk
 - #1038 capitalize header field for Location per RFC, Tommi Kyntola
 - #1011 update documentation to remove outdated references. fix more links,
   lukealbao
 - #1010 update documentation to include charSet property for static plugin,
   Greg Walker
 - #1000 update spdy to 3.2.0, Andy Tzeng
 - #1007 remove `defaultResponseHeaders` from documentation, lukealbao
 - #999 server `NotFound` handler is now normalized, works like other error
   events and no longer flushes responses automatically, Alex Liu
 - #991 update documentation links for new plugins and errors repo, Ken Warner
 - #987 disallow multiple values for content-type header, James O'Cull
 - #985 CORS removed from restify core. support `next(false)` in pre handler
   chains, Alex Liu
 - #982 allow sending of null body, Felix Milea-Ciobanu
 - #973 rev latest restify-errors, fix todoapp examples, Micah Ransdell
 - #972 added shrinkwrap+nsp for security vuln checks, Alex Liu
 - #971 Fix error creation when error message contain URI encoded characters,
   Benjamin Urban
 - #969 Fix incorrect usage of assert.AssertionError, Alex Liu
 - #965 added unit test for sending null body, Michael Nisi
 - #964 Fix cached routes not setting maxVersion, Alex Liu
 - #963 enhancements to res.redirect. server now emits `redirect` event, James
   Womack
 - #960 update documentation for websocket example, Richard Kiene
 - #958 RequestCaptureStream now writes triggering record, Gerrard Lindsay,
   Yunong Xiao
 - #955 update documentation for socket.io example, Thorsten Hans
 - #952 Formatters no longer set status codes or inspect payload, Christian
   Bongiorno, Alex Liu
 - #951 `res.sendRaw()` allows sending of responses without use of formatters,
   Matthew Amato, Alex Liu
 - #947 update documentation links for readme.md & badges, ReadmeCritic
 - #944 Support generic event listener, Alex Liu
 - #943 Fix typos in documentation, azollyx
 - #939 Fix issue where missing content-type header would hang response, Alex
   Liu
 - #935 Clearer docs for using certs, Vikram Tiwari
 - #932 Update to spdy 2.x, Fedor Indutny
 - #924 Update docs for async formatter breaking change, Magnus Wolffelt
 - #891 stop processing requests when 'close' event has been fired (early
   client termination), Alex Liu
 - #883 hypens no longer stripped from route names, Sean Wragg
 - #903 Update docs to reflect new error handling, Jacob Quatier
 - #889 Bump dependencies to latest, Micah Ransdell
 - #845 Support sync and async formatters, Alex Liu
 - #844 Move Errors to their own module, Alex Liu
 - #855 Clients now live in its own repo and npm module, Alex Liu
 - Various documentation improvements from leitsubomi

## 4.3.0

- #1024 Add `handleUncaughtExceptions` server option to supporting disabling
  the uncaughtException handler.

## 4.2.0

- #925 Support passing (most) [qs](https://github.com/ljharb/qs#readme) options
  to the `restify.queryParser` plugin. Update the "qs" dependency to latest (v6)
  while maintaining backward compatibility (see notes in the API doc and
  "test/query.test.js" on `allowDots` and `plainObjects`).

## 4.1.1

- update negotiator (NSP advisory #106) and lru-cache (bug fix).

## 4.1.0

- Bump SPDY to latest.
- #959: fix issue where cached routes were not setting maxVersion on the req

## 4.0.4

- #937 Fix missing content-type header causing response to hang

## 4.0.3
- #917 Fix: HTTP 413 status name, Micah Ransdell

## 4.0.2
- #887 Bump dtrace-provider to 0.6.0 for Node 4 support, Corbin Uselton

## 4.0.0
- #877 content-type can be case-insensitive. Yunong Xiao
- #856 update various dependencies. Alex Liu
- #851 **BREAKING** fix formatters such that they always return cb. Yunong Xiao
- #847 fix body parser race condition. Yunong Xiao
- #842 add `req.matchedVersion()` Nathan Peck, Micah Ransdell
- #840 Fix issue with server toString Method. OiNutter, Micah Ransdell
- #836 Add JSDoc comments. Alex Liu
- #835 Update static.js to allow for serving static files that do not use the route as a path. Wavewash, Micah Ransdell
- #831 Support hash option to Formidable for multipart file uploads. blakevanian, ManRueda
- #832 Updated dtrace-provider. yads
- #812 add query parameters to auditlogger. Alex Liu
- #800 Allow 0, false, and null as json body. Alex Dobeck
- #771 q-value choice on wildcards ignores default q-value of 1. Kevin Peno
- #822 Allow optional headers to be added as properties to bunyan logs. Michael Paulson.
- #824 Don't include large coverage files in published packages. Trent Mick
- #819 Add a feature to allow the expiration of old unprocessed requests. Michael Paulson
- #803 Add redirect support to Response. Alex Liu
- #686 `res.send` can't send 0, false and null. Alex Dobeck

## 3.0.3
- #669 Fix socket.io 1.x integration. Mark Doeswijk
- #662 Improve request logger doc. Jordan Klassen
- #793 Update Server API error event listener doc. github.com/durkes
- #795 Remove unused vars in source. James Womack
- #796 Hypermedia API fails when paths have multiple patterns with sub-regexs. Morten Fangel
- #775 Fix UTF-8 corruption in body parser. Michał Moskal

## 3.0.2
- #785 update semver dependency.

## 3.0.1
- #779 set-cookie headers should not include comma separated values. See:
  http://tools.ietf.org/html/rfc6265#section-3

## 3.0.0

- Bumping major because of #753

## 2.9.0

- #688 Fix various throttle bugs
- #691 Fix an issue where posting with text/csv content type crashes Restify
- #693 Support multiple response header values
- #704 Allow partial regex for named parameters
- #726 Allow per-request agent overrides
- #726 Ebanle `{agent: false}` option override per request
- #727 Fix JSON body parser behavior when request body is null
- #727 Fix a bug when `req.body === null`
- #731 SVG badges in README
- #734 Add API to track timers for nested handlers
- #744 Fix `request.isUpload` for PATCH requests
- #751 Fix `server.url` property when using IPv6
- #758 Switch to UUID v4
- #758 Use v4 UUIDs for `[x-]request-id`
- #759 Documentation fix
- #762 `res.noCache()` API to prevent all caching
- #767 Prefer the existing `err` serializer for audit logging
- Update dtrace-provider dependency
- #753 **BREAKING** Include `err` parameter for all \*Error events:
  Error events will all have the signature `function (req, res, err, cb)` to
  become consistent with the handling functionality introduced in 2.8.5.
  Error handlers using the `function (req, res, cb)` signature must be updated.

## 2.8.5

- Add ability to listen for error events
- Documentation fixes

## 2.8.4

- Update dtrace-provider, bunyan and backoff
- Fix request URL cache interaction with dtrace probes

## 2.8.3

- Support html5 multiple file uploads

## 2.8.2

- #619 Default to url, if string provided to createClient
- #614 do not compute the MD5 Hash of a partial content
- #516 Allow an `options` object to be passed into the authorization plugin
- Updating dependencies
- #626 Add more built-in errors to doc
- #460 Provide direct access to https server options if needed
- #656 update qs

## 2.8.1

- revert #604, work around by not removing client listener

## 2.8.0

- #604 trap http client errors
- #598 Simplify and correct path segment regexp
- #570 Route matching should only prefer later routes if version is greater
- #564 Using req.accepts() according to implementation
- #504 Helper to render a route with given parameters (for hypermedia APIs)

## 2.7.0

- #547 Added mapFiles option to bodyParser
- #552 PUT JsonClient test should use PUT not POST
- #550 Make router preflight code more readable
- #548 Allow custom handling of multipart data.

## 2.6.3

- Hotfix for CORS plugin if no origin was set in the options

## 2.6.2

- #508 add server option: `ciphers` to pass down to https(tls)
- #502 `server.on('request')` not emitting
- #496 static plugin incorrectly handling `directories`; revert back to 2.6.0
       version
- #495 don't override client response code with custom error object
- #494 socket connecting detection logic incorrect
- #492 client `false` needs to actually disable retries
- changed indent from four to eight
- #505 fix audit logger plugin bug
- #510 request timeout support
- #523 added Access-Control-Allow-Credentials to the preflight handler

## 2.6.1

- #478 Add `req.timers` to audit logging plugin.
- #487 RequestCaptureStream: dumpDefault, haveNonRawStreams, zero ring after dump
- #407 - bunyan 0.21.3
- Add CSV/TSV parser (Dominik Lessel)
- Add `req.timers`: a list of hrtime's for each handler
- Set TCP SO_KEEPALIVE when default KeepAliveAgent is on (client)

## 2.6.0

- EXPERIMENTAL: Native websocket support via watershed (Josh Clulow)
- Pass entire route, not just route.name to `after` (Dingman)
- Type coercion bug in Cache Control API (Chris Cannell)

## 2.5.1

- GH-401 RegEx routes stomp one another, resulting in 404
- GH-389 StringClient should handle garbage servers that send neither
         `Content-Length` nor `Transfer-Encoding: chunked` headers.

## 2.5.0

- Pick up http-signature@0.10.0 (breaking change, to those using it); see
  https://github.com/joyent/node-http-signature/issues/10
- GH-388 JSON client blows up on bad content
- GH-379 Static plugin: NotAuthorizedError for file path with
         parentheses (Ricardo Stuven)
- GH-370 Add charSet option for static file plugin (Jonathan Dahan)

## 2.4.1

- Support node 0.10.X TLS options in client(s)

## 2.4.0

- GH-368 Route /\/.*/ does not match request /? (Ben Hutchison)
- GH-366 `req.accepts()` not working with short-hand mime types
- GH-362 Empty body throws TypeError in StringClient (Bryan Donovan)
- GH-355 Serve gzip encoded files from static if they are available
         (Nathanael Anderson)
- GH-338 turn `req.body` into an `Object` when content-type is
         JSON (Daan Kuijsten)
- GH-336 `res.charSet()` back in
- dependency version bumps
- 0.10.X support in tests (add necessary `resume()` calls)
- client should log request/response pairs

## 2.3.5

- bunyan@0.20.0
- GH-346 `server.toString()` crashes (Alex Whitman)
- GH-193 support `next('name_of_route')`

## 2.3.4

- GH-343 default to 'identity' for accept-encoding
- GH-342 client support for PATCH
- Pick up spdy@1.4.6 (doesn't ship all the example garbage)

## 2.3.3

- Stop logging client_req in bunyan output
- GH-319 make DTrace optional
- GH-335 Content-Type'd routes not accepting array (Pedro Palazón)

## 2.3.2

- pick up bunyan 0.18.3
- server.address() returning null causes server.url to deref null

## 2.3.1

- GH-335 Content-Type'd routes not correct when only Accept-Extension varies,
         part deux (switch to `negotiator`, drop `mimeparse`).

## 2.3.0

- GH-335 Content-Type'd routes not correct when only Accept-Extension varies
- GH-332 Cache-Control max-age should show minutes (Ben Hutchison)
- GH-329 Wrong values in res.methods on some cases
- GH-327 server.versionedUse('1.2.3', function (req, res, next) {}) (Tim Kuijsten)
- GH-326 non-default origins not working, Chrome requires allow/origin and
         allow users to append to CORS array (John Fieber/Damon Oehlman)
- GH-323 <path>/?<querystring> broken
- GH-322 add `req.route`, which contains the original params for the
         route (Tim Kuijsten)
- GH-312 bodyParser() should return buffers when data is binary (Tim Kuijsten)
- GH-318 Allow use of 'requestBodyOnGet' option in bodyParser (@geebee)

## 2.2.1

- GH-283 broke versioned, typed routes. Fix.
- node-http-signature@0.9.11

## 2.2.0

- GH-316 drop `clone`, and just shallow copy (Trent Mick)
- GH-284 preflight requests not working without access-control-request-headers
- GH-283 versioned routes should use maximum match, not first (Colin O'Brien)
- dtrace probes for restify clients
- node-dtrace-provider@0.2.8
- backoff@2.0.0 and necessary changes

## 2.1.1

- revert to backoff@1.2.0

## 2.1.0

- GH-284 built-in CORS
- GH-290 next.ifError
- GH-291 fix overwriting `options.type` in createJSONClient (Trent Mick)
- GH-297 default document serving in static plugin (Adam Argo)
- GH-299 gzip plugin doesn't play nice with content-length (Ben Hale)
- GH-301 support private keys w/passphrase (Erik Kristensen)
- GH-302 responseTime cleanup
- Move to `node-backoff` and rework retry logic in HttpClient
- Support keep-alive by default in HttpClient

## 2.0.4

- GH-280 req.params cached by router
- RequestCaptureStream should support outputting to multiple streams
- Default uncaughtException handler should check if headers have been sent

## 2.0.2/2.0.3

- GH-278 missing events on route errors
- Undo `RestError` `constructorOpt` from 2.0.1

## 2.0.1

- GH-269 plugin to make curl happy
- RestError not honoring `constructorOpt` from `cause`
- GH-271 bump to dtrace 0.2.6 (fix build on Mountain Lion)

# Legacy Releases

## 1.4.2

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
