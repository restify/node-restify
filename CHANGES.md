# restify Changelog

## 1.0.0-rc2 (not yet released)

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
