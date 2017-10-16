---
title: Plugins API
permalink: /docs/plugins-api/
---

Restify comes bundled with a selection of useful plugins. These are accessible
off of `restify.plugins` and `restify.pre`.

## Usage

```js
var server = restify.createServer();
server.use(restify.plugins.acceptParser(server.acceptable));
server.use(restify.plugins.authorizationParser());
server.use(restify.plugins.dateParser());
server.use(restify.plugins.queryParser());
server.use(restify.plugins.jsonp());
server.use(restify.plugins.gzipResponse());
server.use(restify.plugins.bodyParser());
server.use(restify.plugins.requestExpiry());
server.use(restify.plugins.throttle({
  burst: 100,
  rate: 50,
  ip: true,
  overrides: {
    '192.168.1.1': {
      rate: 0,        // unlimited
      burst: 0
    }
  }
}));
server.use(restify.plugins.conditionalRequest());
```

## `server.pre()` plugins

This module includes various pre plugins, which are intended to be used prior
to routing of the URL. To use a plugin before routing, use the `server.pre()`
method.

### `restify.plugins.pre.context()`

This plugin creates `req.set(key, val)` and `req.get(key)` methods for setting
and retrieving request specific data.

Example:

```js
server.pre(restify.plugins.pre.context());
server.get('/', [
    function(req, res, next) {
        req.set(myMessage, 'hello world');
        return next();
    },
    function two(req, res, next) {
        res.send(req.get(myMessage)); // => sends 'hello world'
        return next();
    }
]);
```

### `restify.plugins.pre.dedupeSlashes()`

This plugin deduplicates extra slashes found in the URL. This can help with
malformed URLs that might otherwise get misrouted.

Exmaple:

```js
server.pre(restify.plugins.pre.dedupeSlashes());
server.get('/hello/:one', function(req, res, next) {
    res.send(200);
    return next();
});

// the server will now convert requests to /hello//jake => /hello/jake
```

### `restify.plugins.pre.reqIdHeaders(opts)`

This plugin pulls the value from an incoming request header and uses it as the
value of the request id. Subsequent calls to `req.id()` will return the header
values.

* `opts` {Object} an options object
* `options.headers` {Array} an array of header names to use. lookup precedence
  is left to right (lowest index first)

### `restify.plugins.pre.strictQueryParams(opts)`

This plugins disallows sloppy query params. `?key=value&value2` would
normally result in a value of `{ key: value, value2: '' }`, but with this plugin
enabled the request is rejected with a `BadRequestError` (400).

* `opts` {Object} an options object
* `opts.message` {String} a custom error message

### `restify.plugins.pre.userAgentConnection(opts)`

For curl user-agents, this plugin sets a `connection: close` header, and
removes the content-length header for HEAD requests. A custom regexp can be
crafted to target other user-agents. Note that passing in `userAgentRegExp`
overriddes the default regexp matching curl agents.

* `opts` {Object} an options object
* `opts.userAgentRegExp` {RegExp} regexp matching any user-agents applicable



## `server.use()` plugins

### `restify.plugins.acceptParser(accepts)`

Parses the `Accept` header, and ensures that the server can respond to what
the client asked for. In almost all cases passing in `server.acceptable` is
all that's required, as that's an array of content types the server knows
how to respond to (with the formatters you've registered). If the request is
for a non-handled type, this plugin will return a `NotAcceptableError` (406).

* `accepts` {Array} an array of acceptable types

Example:

```js
server.use(restify.plugins.acceptParser(server.acceptable));
```

### `restify.plugins.authorizationParser(opts)`
Parses out the `Authorization` header as best restify can. Currently only HTTP
Basic Auth and [HTTP Signature](https://github.com/joyent/node-http-signature)
schemes are supported.

* `opts` {Object} an optional options object that is passed to http-signature

If successfully parsed, `req.authorization` will be set:

```js
{
  scheme: <Basic|Signature|...>,
  credentials: <Undecoded value of header>,
  basic: {
    username: $user
    password: $password
  }
}
```

`req.username` will also be set, and defaults to 'anonymous'.  If the scheme
is unrecognized, the only thing available in `req.authorization` will be
`scheme` and `credentials` - it will be up to you to parse out the rest.


### `restify.plugins.dateParser(sec)`

Parses out the HTTP Date header (if present) and checks for clock skew.  If the
header is invalid, a `InvalidHeaderError` (400) is returned. If the clock skew
exceeds the specified value, a `RequestExpiredError` (400) is returned.

* `sec` {Number} allowed clock skew in seconds. defaults to 300s, like Kerberos

```js
// Allows clock skew of 1m
server.use(restify.plugins.dateParser(60));
```

## TBD to be organized

This module includes the following header parser plugins:

* `conditionalRequest()` - Conditional headers (If-\*)
* `fullResponse()` - handles disappeared CORS headers

This module includes the following data parsing plugins:

* `bodyParser(options)` - parses POST bodies to `req.body`. automatically uses one of the following parsers based on content type:
  * `urlEncodedBodyParser(options)` - parses url encoded form bodies
  * `jsonBodyParser(options)` - parses JSON POST bodies
  * `multipartBodyParser(options)` - parses multipart form bodies
  * All bodyParsers support the following options:
    * `options.mapParams` - default false. copies parsed post body values onto req.params
    * `options.overrideParams` - default false. only applies when if mapParams true. when true, will stomp on req.params value when existing value is found.
* `jsonp()` - parses JSONP callback
* `queryParser()` - Parses URL query paramters into `req.query`. Many options
  correspond directly to option defined for the underlying
  [`qs.parse`](https://github.com/ljharb/qs).
  * `options.mapParams` - Default false. Copies parsed query parameters into
    `req.params`.
  * `options.overrideParams` - Default false. Only applies when if mapParams
    true. When true, will stomp on req.params field when existing value is
    found.
  * `options.allowDots` - Default false. Transform `?foo.bar=baz` to a nested
    object: `{foo: {bar: 'baz'}}`.
  * `options.arrayLimit` - Default 20. Only transform `?a[$index]=b` to an array
    if `$index` is less than `arrayLimit`.
  * `options.depth` - Default 5. The depth limit for parsing nested objects,
    e.g. `?a[b][c][d][e][f][g][h][i]=j`.
  * `options.parameterLimit` - Default 1000. Maximum number of query params
    parsed. Additional params are silently dropped.
  * `options.parseArrays` - Default true. Whether to parse `?a[]=b&a[1]=c` to an
    array, e.g. `{a: ['b', 'c']}`.
  * `options.plainObjects` - Default false. Whether `req.query` is a "plain"
    object -- does not inherit from `Object`. This can be used to allow query
    params whose names collide with Object methods, e.g. `?hasOwnProperty=blah`.
  * `options.strictNullHandling` - Default false. If true, `?a&b=` results in
    `{a: null, b: ''}`. Otherwise, `{a: '', b: ''}`.
* `requestLogger(options)` - adds timers for each handler in your request chain
  * `options.properties` {Object} properties to pass to bunyan's `log.child()` method

The module includes the following response plugins:

* `gzip(options)` - gzips the response if client accepts it
  * `options` {Object} options to pass to zlib
* `serveStatic()` - used to serve static files
* `throttle(options)` - throttles responses
  * `options.burst` {Number}
  * `options.rate` {Number}
  * `options.ip` {Boolean}
  * `options.username` {Boolean}
  * `options.xff` {Boolean}
  * `options.overrides` {Object}
* `requestExpiry(options)` - Sends back a `GatewayTimeoutError` if a request has expired. This is a throttling plugin which lets you throttle requests if they've exceeded some timeout, which can be defined by incoming headers. It's entirely safe to decorate your handler chain with multiple instances of this plugin, to check in between various middleware. Additionally, the plugin exposes `req.isExpired()` which returns whether the request has expired. This function can be used by endusers to explicitly check whether a request has expired. There are two modes for this plugin:
  1. Absolute Time
     * `options.absoluteHeader` {String} which is the header that specifies milliseconds since epoch when a request should expire.
  2. Relative Time
     * `options.startHeader` {String} The start time of the request in milliseconds since epoch
     * `options.timeoutHeader` {String} The relative time in milliseconds from `options.startHeader` that the request should expire.

The module includes the following plugins to be used with restify's `pre`, `routed`, and `after`
event, e.g., `server.on('after', plugins.auditLogger());`:

* `auditLogger(options)` - an audit logger for recording all handled requests
  * `options.event` {String} The name of the event, one of `pre`, `routed`, or `after`
  * `options.log` {Object} bunyan logger
  * `[opts.context]` {Function} The optional context function of signature
   f(req, res, route, err).  Invoked each time an audit log is generated. This
   function can return an object that customizes the format of anything off the
   req, res, route, and err objects. The output of this function will be
   available on the `context` key in the audit object.
  * `[options.server]` {Object} restify server. if passed in, causes server to
     emit 'auditlog' event after audit logs are flushed
  * `[options.printLog]` {Boolean} when true, prints audit logs. defaults to true.

The module includes the following plugins to be used with restify's `after`
event, e.g., `server.on('after', plugins.metrics());`:
* `metrics(callback)` - a metrics plugin which will invoke callback with the
  the following parameters (5.x compatible only):
  * `err` {Object} an error if the request had an error
  * `metrics` {Object} - metrics about the request
  * `metrics.statusCode` {Number} status code of the response. can be undefined
    in the case of an uncaughtException
  * `metrics.method` {String} http request verb
  * `metrics.latency` {Number} request latency
  * `metrics.path` {String} req.path() value
  * `metrics.inflightRequests` {Number} Number of inflight requests pending in restify.
  * `metrics.unifinishedRequests` {Number} Same as `inflightRequests`
  * `metrics.connectionState` {String} can be either 'close', 'aborted', or
    undefined. If this value is set, err will be a corresponding
    `RequestCloseError` or `RequestAbortedError`. If connectionState is either
    'close' or 'aborted', then the statusCode is not applicable since the
    connection was severed before a response was written.
  * `req` {Object} the request obj
  * `res` {Object} the response obj
  * `route` {Object} the route obj that serviced the request

The module includes the following plugins to be used with restify's `pre` event:
* `inflightRequestThrottle(options)` - limits the max number of inflight requests
  * `options.limit` {Number} the maximum number of inflight requests the server will handle before returning an error
  * `options.err` {Error} A restify error used as a response when the inflight request limit is exceeded
  * `options.server` {Object} The restify server that this module will throttle
* `cpuUsageThrottle(options)`- Reject requests based on the server's current CPU usage
  * `options.limit` - {Number} The point at which restify will begin rejecting a % of all requests at the front door.
  * `options.max` - {Number} The point at which restify will reject 100% of all requests at the front door.
  * `options.interval` - {Number} How frequently to recalculate the % of traffic to be rejecting.
  * `options.halfLife` - {Number} How responsive your application will be to spikes in CPU usage, for more details read the cpuUsageThrottle section below.
  * `options.err` - {Error} A restify error used as a response when the cpu usage limit is exceeded


## QueryParser

```js
server.use(restify.plugins.queryParser());
```

Parses the HTTP query string (i.e., `/foo?id=bar&name=mark`).  If you use this,
the parsed content will always be available in `req.query`, additionally params
are merged into `req.params`.  You can disable by passing in `mapParams: false`
in the options object:

```js
server.use(restify.plugins.queryParser({ mapParams: false }));
```

## JSONP

Supports checking the query string for `callback` or `jsonp` and ensuring that
the content-type is appropriately set if JSONP params are in place.  There is
also a default `application/javascript` formatter to handle this.

You *should* set the `queryParser` plugin to run before this, but if you don't
this plugin will still parse the query string properly.

## BodyParser

Blocks your chain on reading and parsing the HTTP request body.  Switches on
`Content-Type` and does the appropriate logic.  `application/json`,
`application/x-www-form-urlencoded` and `multipart/form-data` are currently
supported.

```js
server.use(restify.plugins.bodyParser({
    maxBodySize: 0,
    mapParams: true,
    mapFiles: false,
    overrideParams: false,
    multipartHandler: function(part) {
        part.on('data', function(data) {
          /* do something with the multipart data */
        });
    },
    multipartFileHandler: function(part) {
        part.on('data', function(data) {
          /* do something with the multipart file data */
        });
    },
    keepExtensions: false,
    uploadDir: os.tmpdir(),
    multiples: true,
    hash: 'sha1',
    rejectUnknown: true,
    requestBodyOnGet: false,
    reviver: undefined,
    maxFieldsSize: 2 * 1024 * 1024
 }));
```

Options:

* `maxBodySize` - The maximum size in bytes allowed in the HTTP body. Useful for limiting clients from hogging server memory.
* `mapParams` - if `req.params` should be filled with parsed parameters from HTTP body.
* `mapFiles` - if `req.params` should be filled with the contents of files sent through a multipart request. [formidable](https://github.com/felixge/node-formidable) is used internally for parsing, and a file is denoted as a multipart part with the `filename` option set in its `Content-Disposition`. This will only be performed if `mapParams` is true.
* `overrideParams` - if an entry in `req.params` should be overwritten by the value in the body if the names are the same. For instance, if you have the route `/:someval`, and someone posts an `x-www-form-urlencoded` Content-Type with the body `someval=happy` to `/sad`, the value will be `happy` if `overrideParams` is `true`, `sad` otherwise.
* `multipartHandler` - a callback to handle any multipart part which is not a file. If this is omitted, the default handler is invoked which may or may not map the parts into `req.params`, depending on the `mapParams`-option.
* `multipartFileHandler` - a callback to handle any multipart file. It will be a file if the part has a `Content-Disposition` with the `filename` parameter set. This typically happens when a browser sends a form and there is a parameter similar to `<input type="file" />`. If this is not provided, the default behaviour is to map the contents into `req.params`.
* `keepExtensions` - if you want the uploaded files to include the extensions of the original files (multipart uploads only). Does nothing if `multipartFileHandler` is defined.
* `uploadDir` - Where uploaded files are intermediately stored during transfer before the contents is mapped into `req.params`. Does nothing if `multipartFileHandler` is defined.
* `multiples` - if you want to support html5 multiple attribute in upload fields.
* `hash` - If you want checksums calculated for incoming files, set this to either `sha1` or `md5`.
* `rejectUnknown` - Set to `true` if you want to end the request with a `UnsupportedMediaTypeError` when none of the supported content types was given.
* `requestBodyOnGet` -  Parse body of a GET request. The default is `false`.
* `reviver` - `jsonParser` only. If a function, this prescribes how the value originally produced by parsing is transformed, before being returned. For more information check out [JSON.parse(text[, reviver])](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse). Optional.
* `maxFieldsSize` - `multipartParser` only. Limits the amount of memory all fields together (except files) can allocate in bytes. The default size is `2 * 1024 * 1024` bytes *(2MB)*.

## RequestLogger

Sets up a child [bunyan](https://github.com/trentm/node-bunyan) logger with the
current request id filled in, along with any other parameters you define.

```js
server.use(restify.plugins.requestLogger({
    properties: {
        foo: 'bar'
    },
    serializers: {...}
}));
```

You can pass in no options to this, in which case only the request id will be
appended, and no serializers appended (this is also the most performant); the
logger created at server creation time will be used as the parent logger.
This logger can be used normally, with [req.log](#request-api).

This plugin does _not_ log each individual request. Use the Audit Logging
plugin or a custom middleware for that use.

Options:
* `headers` - A list of headers to transfer from the request to top level props on the log.

## GzipResponse

```js
server.use(restify.plugins.gzipResponse());
```

If the client sends an `accept-encoding: gzip` header (or one with an
appropriate q-val), then the server will automatically gzip all response data.
Note that only `gzip` is supported, as this is most widely supported by clients
in the wild.  This plugin will overwrite some of the internal streams, so any
calls to `res.send`, `res.write`, etc., will be compressed.  A side effect is
that the `content-length` header cannot be known, and so
`transfer-encoding: chunked` will *always* be set when this is in effect.  This
plugin has no impact if the client does not send `accept-encoding: gzip`.

## Serve Static

The serveStatic module is different than most of the other plugins, in that it
is expected that you are going to map it to a route, as below:

```js
server.get(/\/docs\/current\/?.*/, restify.plugins.serveStatic({
  directory: './documentation/v1',
  default: 'index.html'
}));
```

The above `route` and `directory` combination will serve a file located in
`./documentation/v1/docs/current/index.html` when you attempt to hit
`http://localhost:8080/docs/current/`. If you want the serveStatic module to serve files
directly from the `/documentation/v1` directory (and not append the request path `/docs/current/`),
you can set the `appendRequestPath` option to `false`, and the served file would be
`./documentation/v1/index.html`, in the previous example.

The plugin will enforce that all files under `directory` are served. The
`directory` served is relative to the process working directory. You can also
provide a `default` parameter such as index.html for any directory that
lacks a direct file match.
You can specify additional restrictions by passing in a `match` parameter,
which is just a `RegExp` to check against the requested file name.
Additionally, you may set the `charSet` parameter, which will append a
character set to the content-type detected by the plugin.  For example,
`charSet: 'utf-8'` will result in HTML being served with a Content-Type
of `text/html; charset=utf-8`.
Lastly, you can pass in a `maxAge` numeric, which will set the
`Cache-Control` header. Default is `3600` (1 hour).

An additional option for serving a static file is to pass `file` in to the
serveStatic method as an option. The following will serve index.html from
the documentation/v1/ directory anytime a client requests `/home/`.

```js
server.get(/\/home\//, restify.plugins.serveStatic({
  directory: './documentation/v1',
  file: 'index.html'
}));
```


## Throttle

restify ships with a fairly comprehensive implementation of
[Token bucket](http://en.wikipedia.org/wiki/Token_bucket), with the ability to
throttle on IP (or x-forwarded-for) and username (from `req.username`).  You
define "global" request rate and burst rate, and you can define overrides for
specific keys.  Note that you can always place this on per-URL routes to enable
different request rates to different resources (if for example, one route, like
`/my/slow/database` is much easier to overwhlem than `/my/fast/memcache`).

```js
server.use(restify.plugins.throttle({
  burst: 100,
  rate: 50,
  ip: true,
  overrides: {
    '192.168.1.1': {
      rate: 0,        // unlimited
      burst: 0
    }
  }
}));
```

If a client has consumed all of their available rate/burst, an HTTP response
code of `429`
[Too Many Requests](http://tools.ietf.org/html/draft-nottingham-http-new-status-03#section-4)
is returned.

Options:

|Name|Type|Description|
|----|----|-----------|
|rate|Number|Steady state number of requests/second to allow|
|burst|Number|If available, the amount of requests to burst to|
|ip|Boolean|Do throttling on a /32 (source IP)|
|xff|Boolean|Do throttling on a /32 (X-Forwarded-For)|
|username|Boolean|Do throttling on `req.username`|
|overrides|Object|Per "key" overrides|
|tokensTable|Object|Storage engine; must support put/get|
|maxKeys|Number|If using the built-in storage table, the maximum distinct throttling keys to allow at a time|

Note that `ip`, `xff` and `username` are XOR'd.

## Request Expiry

Request Expiry can be used to throttle requests that have already exceeded
their client timeouts. Requests can be sent with a configurable client timeout
header, e.g. 'x-request-expiry-time', which gives in absolute ms since epoch,
when this request will be timed out by the client.

This plugin will throttle all incoming requests via a 504 where
'x-request-expiry-time' less than Date.now() -- since these incoming requests
have already been timed out by the client. This prevents the server from
processing unnecessary requests.

```js
server.use(restify.plugins.requestExpiry({
    header: 'x-request-expiry-time'
});
```

The only option provided is `header` which is the request header used to specify
the client timeout.

### Using an external storage mechanism for key/bucket mappings.

By default, the restify throttling plugin uses an in-memory LRU to store
mappings between throttling keys (i.e., IP address) to the actual bucket that
key is consuming.  If this suits you, you can tune the maximum number of keys
to store in memory with `options.maxKeys`; the default is 10000.

In some circumstances, you want to offload this into a shared system, such as
Redis, if you have a fleet of API servers and you're not getting steady and/or
uniform request distribution.  To enable this, you can pass in
`options.tokensTable`, which is simply any Object that supports `put` and `get`
with a `String` key, and an `Object` value.

## Inflight Request Throttling

```js
var errors = require('restify-errors');
var restify = require('restify');

var server = restify.createServer();
const options = { limit: 600, server: server };
options.res = new errors.InternalServerError();
server.pre(restify.plugins.inflightRequestThrottle(options));
```

The `inflightRequestThrottle` module allows you to specify an upper limit to
the maximum number of inflight requests your server is able to handle. This
is a simple heuristic for protecting against event loop contention between
requests causing unacceptable latencies.

The custom error is optional, and allows you to specify your own response
and status code when rejecting incoming requests due to too many inflight
requests. It defaults to `503 ServiceUnavailableError`.

This plugin should be registered as early as possibly in the middleware stack
using `pre` to avoid performing unnecessary work.

## CPU Usage Throttling

```js
var restify = require('restify');

var server = restify.createServer();
const options = {
  limit: .75,
  max: 1,
  interval: 250,
  halfLife: 500,
}

server.pre(restify.plugins.cpuUsageThrottle(options));
```

cpuUsageThrottle is a middleware that rejects a variable number of requests (between 0% and 100%) based on a historical view of CPU utilization of a Node.js process. Essentially, this plugin allows you to define what constitutes a saturated Node.js process via CPU utilization and it will handle dropping a % of requests based on that definiton. This is useful when you would like to keep CPU bound tasks from piling up causing an increased per-request latency.

The algorithm asks you for a maximum CPU utilization rate, which it uses to determine at what point it should be rejecting 100% of traffic. For a normal Node.js service, this is 1 since Node is single threaded. It uses this, paired with a limit that you provide to determine the total % of traffic it should be rejecting. For example, if you specify a limit of .5 and a max of 1, and the current EWMA (next paragraph) value reads .75, this plugin will reject approximately 50% of all requests.

When looking at the process' CPU usage, this algorithm will take a load average over a user specified interval. For example, if given an interval of 250ms, this plugin will attempt to record the average CPU utilization over 250ms intervals. Due to contention for resources, the duration of each average may be wider or narrower than 250ms.  To compensate for this, we use an exponentially weighted moving average. The EWMA algorithm is provided by the ewma module. The parameter for configuring the EWMA is halfLife. This value controls how quickly each load average measurment decays to half it's value when being represented in the current average. For example, if you have an interval of 250, and a halfLife of 250, you will take the previous ewma value multiplied by  .5 and add it to the new CPU utilization average measurement multiplied by .5. The previous value and the new measurement would each represent 50% of the new value. A good way of thinking about the halfLife is in terms of how responsive this plugin will be to spikes in CPU utilization. The higher the halfLife, the longer CPU utilization will have to remain above your defined limit before this plugin begins rejecting requests and, converserly, the longer it will have to drop below your limit before the plugin begins accepting requests again. This is a knob you will want to with play when trying to determine the ideal value for your use case.

For a better understanding of the EWMA algorithn, refer to the documentation for the ewma module.

Params:
  * `limit` - The point at which restify will begin rejecting a % of all requests at the front door. This value is a percentage. For example `0.8` === 80% average CPU utilization. Defaults to `0.75`.
  * `max` - The point at which restify will reject 100% of all requests at the front door. This is used in conjunction with limit to determine what % of traffic restify needs to reject when attempting to bring the average load back within tolerable thresholds. Since Node.js is single threaded, the default for this is `1`. In some rare cases, a Node.js process can exceed 100% CPU usage and you will want to update this value.
  * `interval` - How frequently we calculate the average CPU utilization. When we calculate an average CPU utilization, we calculate it over this interval, and this drives whether or not we should be shedding load. This can be thought of as a "resolution" where the lower this value, the higher the resolution our load average will be and the more frequently we will recalculate the % of traffic we should be shedding. This check is rather lightweight, while the default is 250ms, you should be able to decrease this value without seeing a significant impact to performance.
  * `halfLife` - When we sample the CPU usage on an interval, we create a series of data points. We take these points and calculate a moving average. The halfLife indicates how quickly a point "decays" to half it's value in the moving average. The lower the halfLife, the more impact newer data points have on the average. If you want to be extremely responsive to spikes in CPU usage, set this to a lower value. If you want your process to put more emphasis on recent historical CPU usage when determininng whether it should shed load, set this to a higher value. The unit is in ms. Defaults to `250`.

You can also update the plugin during runtime using the `.update()` function. This function accepts the same `opts` object as a constructor.

```js
var plugin = restify.plugins.cpuUsageThrottle(options);
server.pre(plugin);

plugin.update({ limit: .4, halfLife: 5000 });
```

## Conditional Request Handler

```js
server.use(restify.plugins.conditionalRequest());
```

You can use this handler to let clients do nice HTTP semantics with the
"match" headers.  Specifically, with this plugin in place, you would set
`res.etag=$yourhashhere`, and then this plugin will do one of:

- return 304 (Not Modified) [and stop the handler chain]
- return 412 (Precondition Failed) [and stop the handler chain]
- Allow the request to go through the handler chain.

The specific headers this plugin looks at are:

- `Last-Modified`
- `If-Match`
- `If-None-Match`
- `If-Modified-Since`
- `If-Unmodified-Since`

Some example usage:

```js
server.use(function setETag(req, res, next) {
  res.header('ETag', 'myETag');
  res.header('Last-Modified', new Date());
});

server.use(restify.plugins.conditionalRequest());

server.get('/hello/:name', function(req, res, next) {
  res.send('hello ' + req.params.name);
});
```

## Audit Logging

Audit logging is a special plugin, as you don't use it with `.use()`, but with
the `after` event:

```js
server.on('after', restify.plugins.auditLogger({
  event: 'after',
  log: bunyan.createLogger({
    name: 'audit',
    stream: process.stdout
  }),
  server: SERVER,
  logMetrics : logBuffer,
  printLog : true
}));
```

You pass in the auditor a bunyan logger, optionally server object, Ringbuffer and a flag printLog indicate if
log needs to be print out at info level or not.  By default, without specify printLog flag, it will write out
record lookling like this:

```js
{
  "name": "audit",
  "hostname": "your.host.name",
  "audit": true,
  "remoteAddress": "127.0.0.1",
  "remotePort": 57692,
  "req_id": "ed634c3e-1af0-40e4-ad1e-68c2fb67c8e1",
  "req": {
    "method": "GET",
    "url": "/foo",
    "headers": {
      "authorization": "Basic YWRtaW46am95cGFzczEyMw==",
      "user-agent": "curl/7.19.7 (universal-apple-darwin10.0) libcurl/7.19.7 OpenSSL/0.9.8r zlib/1.2.3",
      "host": "localhost:8080",
      "accept": "application/json"
    },
    "httpVersion": "1.1",
    "query": {
        foo: "bar"
    },
    "trailers": {},
    "version": "*",
    "timers": {
      "bunyan": 52,
      "saveAction": 8,
      "reqResTracker": 213,
      "addContext": 8,
      "addModels": 4,
      "resNamespaces": 5,
      "parseQueryString": 11,
      "instanceHeaders": 20,
      "xForwardedProto": 7,
      "httpsRedirector": 14,
      "readBody": 21,
      "parseBody": 6,
      "xframe": 7,
      "restifyCookieParser": 15,
      "fooHandler": 23,
      "barHandler": 14,
      "carHandler": 14
    }
  },
  "res": {
    "statusCode": 200,
    "headers": {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, Api-Version",
      "access-control-expose-headers": "Api-Version, Request-Id, Response-Time",
      "server": "Joyent SmartDataCenter 7.0.0",
      "x-request-id": "ed634c3e-1af0-40e4-ad1e-68c2fb67c8e1",
      "access-control-allow-methods": "GET",
      "x-api-version": "1.0.0",
      "connection": "close",
      "content-length": 158,
      "content-md5": "zkiRn2/k3saflPhxXI7aXA==",
      "content-type": "application/json",
      "date": "Tue, 07 Feb 2012 20:30:31 GMT",
      "x-response-time": 1639
    },
    "trailer": false
  },
  "route": {
  "name": "GetFoo",
  "version": ["1.0.0"]
  },
  "secure": false,
  "level": 30,
  "msg": "GetFoo handled: 200",
  "time": "2012-02-07T20:30:31.896Z",
  "v": 0
}
```

The `timers` field shows the time each handler took to run in microseconds.
Restify by default will record this information for every handler for each
route. However, if you decide to include nested handlers, you can track the
timing yourself by utilizing the Request
[startHandlerTimer](#starthandlertimerhandlername) and
[endHandlerTimer](#endhandlertimerhandlername) API.

You can also listen to auditlog event and get same above log object when log event emits. For example

```js
SERVER.on('auditlog', function (data) {
    //do some process with log
});
```

Log is also accumulated in the Ringbuffer object, if user choose to pass in during auditlogger construction time.
