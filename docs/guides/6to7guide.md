---
title: restify 6.x to 7.x migration guide
permalink: /docs/6to7/
---

## Introduction

restify `7.x` comes with a completely new router and middleware logic that
brings significant performance improvement to your application.
From `v7.0.0` restify uses the Radix Tree based
[find-my-way](https://github.com/delvedor/find-my-way) package as a router
backend.

## Breaking Changes

### Server returns `RequestCloseError` instead of `RequestAbortedError`

Server returns `RequestCloseError` instead of `RequestAbortedError` in the case
of the request was terminated by the client for some reason.

The new version of restify never returns `RequestAbortedError`.

### Non-strict routing is gone

Option `strictRouting` is removed `createServer({ strictRouting: false })`.
Strict routing is the new default.

### Path trailing slash at the end

`/path` and `/path/` are not the same thing in restify `v7.x`.
Use `ignoreTrailingSlash: true` server option if you don't want to differentiate
them from each other.

### Path must to start with `/`

In restify 7.x path must start with a `/`.
For example `server.get('foo')` is invalid, change it to `server.get('/foo')`.

If you use [enroute](https://github.com/restify/enroute) be sure
that you updated it to the latest version.

### Different `RegExp` usage in router path and wildcards

restify's new router backend
[find-my-way](https://github.com/delvedor/find-my-way) has limited RegExp
support.

#### Guide to define paths

To register a **parametric** path, use the *colon* before the parameter name.
For **wildcard** use the *star*.
*Remember that static routes are always inserted before parametric and wildcard.*

```js
// parametric
server.get('GET', '/example/:userId', (req, res, next) => {}))
server.get('GET', '/example/:userId/:secretToken', (req, res, next) => {}))

// wildcard
server.get('GET', '/example/*', (req, res, next) => {}))
```

Regular expression routes are supported as well, but pay attention, RegExp are
very expensive in term of performance!

```js
// parametric with RegExp
server.get('GET', '/example/:file(^\\d+).png', () => {}))
```

RegExp path chunks needs to be between parentheses.

It's possible to define more than one parameter within the same couple of slash
("/"). Such as:

```js
server.get('/example/near/:lat-:lng/radius/:r', (req, res, next) => {}))
```

*Remember in this case to use the dash ("-") as parameters separator.*

Finally it's possible to have multiple parameters with RegExp.

```js
server.get('/example/at/:hour(^\\d{2})h:minute(^\\d{2})m', (req, res, next) => {
  // req.params => { hour: 12, minute: 15 }
}))
```
In this case as parameter separator it's possible to use whatever character is
not matched by the regular expression.

Having a route with multiple parameters may affect negatively the performance,
so prefer single parameter approach whenever possible, especially on routes
which are on the hot path of your application.

Fore more info see: https://github.com/delvedor/find-my-way

### Remove already deprecated `next.ifError`

`next.ifError(err)` is not available anymore.

### Disable DTrace probes by default

DTrace probes comes with some performance impact that's fine for the sake of
observability but you may don't use it at all.

### Change in calling `next` multiple times

Earlier `restify` automatically prevented calling the `next()` more than once.
In the new version this behaviour is disabled by default, but you can activate
it with the `onceNext` property.

The behaviour of the `strictNext` option is unchanged.
Which means `strictNext` enforces `onceNext` option.

```js
var server = restify.createServer({ onceNext: true })
server.use(function (req, req, next) {
    next();
    next();
});
// -> fine

var server = restify.createServer({ strictNext: true })
server.use(function (req, req, next) {
    next();
    next();
});
// -> throws an Error
```

### Router versioning and content type

`accept-version` and `accept` based conditional routing moved to the
`conditionalHandler` plugin, see docs or example:

```js
var server = restify.createServer()

server.use(restify.plugins.conditionalHandler({
   contentType: 'application/json',
   version: '1.0.0'
   handler: function (req, res, next) {
       next();
   })
});

server.get('/hello/:name', restify.plugins.conditionalHandler([
  {
     version: '1.0.0',
     handler: function(req, res, next) { res.send('1.x') }
  },
  {
     version: ['1.5.0', '2.0.0'],
     handler: function(req, res, next) { res.send('1.5.x, 2.x') }
  },
  {
     version: '3.0.0',
     contentType: ['text/html', 'text/html']
     handler: function(req, res, next) { res.send('3.x, text') }
  },
  {
     version: '3.0.0',
     contentType: 'application/json'
     handler: function(req, res, next) { res.send('3.x, json') }
  }
]);

// 'accept-version': '^1.1.0' => 1.5.x, 2.x'
// 'accept-version': '3.x', accept: 'application/json' => '3.x, json'
```

### After event fires when both request is flushed and last handler is finished

In 7.x `after` event fires after both request is flushed
and last handler is finished.

### Metrics plugin latency

In 7.x Metrics plugin's `latency` is calculated when the request is
fully flushed. Earlier it was calculated when the last handler finished.

To address the previous use-cases, new timings were added to the metrics plugin:

 - `metrics.totalLatency` both request is flushed and all handlers finished
 - `metrics.preLatency` pre handlers latency
 - `metrics.useLatency` use handlers latency
 - `metrics.routeLatency` route handlers latency
