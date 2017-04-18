# Request API

Wraps all of the node
[http.IncomingMessage](http://nodejs.org/api/http.html#http_http_incomingmessage)
APIs, events and properties, plus the following.


## accepts(type)

* `type` {String | Array}

__Returns__ {Boolean}

Check if the Accept header is present, and includes the given type.  When the
Accept header is not present true is returned. Otherwise the given type is
matched by an exact match, and then subtypes. You may pass the subtype such as
`html` which is then converted internally to `text/html` using the mime lookup
table:

```js
// Accept: text/html
req.accepts('html');
// => true

// Accept: text/*; application/json
req.accepts('html');
req.accepts('text/html');
req.accepts('text/plain');
req.accepts('application/json');
// => true

req.accepts('image/png');
req.accepts('png');
// => false
```

## acceptsEncoding(type)

* `type` {String | Array}

__Returns__ {Boolean}

Checks if the request accepts the encoding type(s) specified.


## contentLength()

__Returns__ {String}

Returns the value of the content-length header.


## contentType()

__Returns__ {String}

Returns the value of the content-type header. If a content-type is not set,
this will return a default value of `application/octet-stream`.


## date()

__Returns__ {Object}

Returns a Date object representing when the request was setup. Like `time()`,
but returns a Date object.


## header(key, [defaultValue])

* `key` {String} the name of the header
* `[defaultValue]` {String} a default value of header does not exist

__Returns__ {String}

Get the case-insensitive request header key, and optionally provide a
default value (express-compliant):

```js
req.header('Host');
req.header('HOST');
req.header('Accept', '*/*');
```


## getQuery()

Returns the raw query string. Returns empty string if no query string is found:

```js
// incoming request is /foo?a=1
req.getQuery();
// => 'a=1'
```

Note that if the query parser plugin is used, then this method will returned
the parsed query string:

```js
// incoming request is /foo?a=1
server.use(plugins.queryParser());
req.getQuery();
// => { a: 1 }
```


## href()

__Returns__ {String}

Returns the full requested URL.

```js
// incoming request is http://localhost:3000/foo/bar?a=1
server.get('/:x/bar', function(req, res, next) {
    console.warn(req.href());
    // => /foo/bar/?a=1
});
```


## id([reqId])

* `[reqId]` {String}

__Returns__ {String}

Returns the request id. If a `reqId` value is passed in, this will
become the request's new id. The request id is immutable, and can only be
set once. Attempting to set the request id more than once will cause
restify to throw.


## path()

__Returns__ {String}

Returns the cleaned up requested URL.

```js
// incoming request is http://localhost:3000/foo/bar?a=1
server.get('/:x/bar', function(req, res, next) {
    console.warn(req.href());
    // => /foo/bar
});
```


## is(type)

Check if the incoming request contains the Content-Type header field,
and it contains the give mime type.

* `type` {String | Array}
__Returns__ {Boolean}

```js
// With Content-Type: text/html; charset=utf-8
req.is('html');
req.is('text/html');
// => true

// When Content-Type is application/json
req.is('json');
req.is('application/json');
// => true

req.is('html');
// => false
```

## isSecure()

__Returns__ {Boolean}

Check if the incoming request is encrypted.


## isChunked()

__Returns__ {Boolean}

Check if the incoming request is chunked.


## isKeepAlive()

__Returns__ {Boolean}

Check if the incoming request is kept alive.


## isUpgradeRequest()

__Returns__ {Boolean}

Check if the incoming request has been upgraded.


## isUpload()

__Returns__ {Boolean}

Check if the incoming request is an upload http verb (PATCH, POST, PUT).


## log

If you are using the [RequestLogger](#bundled-plugins) plugin, the child logger
will be available on `req.log`:

```js
function myHandler(req, res, next) {
  var log = req.log;

  log.debug({params: req.params}, 'Hello there %s', 'foo');
}
```

The child logger will inject the request's UUID in the `req._id` attribute of
each log statement. Since the logger lasts for the life of the request, you can
use this to correlate statements for an individual request across any number of
separate handlers.


## time()

__Returns__ {Number}

The number of ms since epoch of when this request began being processed. Like
`date()`, but returns a number.


## userAgent()

__Returns__ {String}

Returns the user-agent header.


## startHandlerTimer(handlerName)

Start the timer for a request handler. By default, restify uses calls this
automatically for all handlers registered in your handler chain. However, this
can be called manually for nested functions inside the handler chain to record
timing information.

```js
server.get('/', function fooHandler(req, res, next) {
    vasync.pipeline({
        funcs: [
            function nestedHandler1(req, res, next) {
                req.startHandlerTimer('nestedHandler1');
                // do something
                req.endHandlerTimer('nestedHandler1');
                return next();
            },
            function nestedHandler1(req, res, next) {
                req.startHandlerTimer('nestedHandler2');
                // do something
                req.endHandlerTimer('nestedHandler2');
                return next();

            }...
       ]...
    }, next);
});
```

## endHandlerTimer(handlerName)

End the timer for a request handler. You must invoke this function if you
called `startRequestHandler` on a handler. Otherwise the time recorded will be
incorrect.

## connectionState()

Returns the current connection state of the request. Current possible values
are:

* `close` - when the request has been closed by the client
* `aborted` - when the socket was closed unexpectedly


## version()

__Returns__ {String}

Returns the accept-version header.


## getRoute()

__Returns__ {Object}

Returns the route information to which the current request was matched to.
The following json represents the JSON object returned by getRoute():

```js
{
    path: '/ping/:name',
    method: 'GET',
    versions: [],
    name: 'getpingname'
}
```
