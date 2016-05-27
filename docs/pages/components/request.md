# Request API

Wraps all of the node
[http.IncomingMessage](http://nodejs.org/api/http.html#http_http_incomingmessage)
APIs, events and properties, plus the following.

## header(key, [defaultValue])

Get the case-insensitive request header key, and optionally provide a
default value (express-compliant):

```js
req.header('Host');
req.header('HOST');
req.header('Accept', '*/*');
```

## accepts(type)

(express-compliant)

Check if the Accept header is present, and includes the given type.

When the Accept header is not present true is returned. Otherwise the
given type is matched by an exact match, and then subtypes. You may
pass the subtype such as `html` which is then converted internally
to `text/html` using the mime lookup table.

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

## is(type)

Check if the incoming request contains the Content-Type header field,
and it contains the give mime type.

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

Note this is almost compliant with express, but restify does not have
all the `app.is()` callback business express does.

## isSecure()

Check if the incoming request is encrypted.

## isChunked()

Check if the incoming request is chunked.

## isKeepAlive()

Check if the incoming request is kept alive.

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

## getQuery()

Returns the raw query string. Returns empty string if no query string is found.
To get the parsed query object, use the `queryParser` plugin. More info can
be found about the plugin in the [bundled plugins](#bundled-plugins) section.

## time()

The time when this request arrived (ms since epoch)

## startHandlerTimer(handlerName)

Start the timer for a request handler. You might want to use this if you've got
a Restify request handler in your chain that contains nested handlers.

```js
function fooHandler(req, res, next) {
    vasync.pipeline(funcs: [
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
}
```

## endHandlerTimer(handlerName)

End the timer for a request handler. You must invoke this function if you
called `startRequestHandler` on a handler. Otherwise the time recorded will be
incorrect.

## Properties

|Name|Type|Description|
|----|----|-----------|
|contentLength()|Number|short hand for the header content-length|
|contentType()|String|short hand for the header content-type|
|href()|String|url.parse(req.url) href|
|log|Object|bunyan logger you can piggyback on|
|id()|String|A unique request id (x-request-id)|
|path()|String|cleaned up URL path|