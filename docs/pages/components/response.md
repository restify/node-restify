# Response API

Wraps all of the node
[ServerResponse](http://nodejs.org/docs/latest/api/http.html#http.ServerResponse)
APIs, events and properties, plus the following.

## header(key, value)

Get or set the response header key.

```js
res.header('Content-Length');
    // => undefined

    res.header('Content-Length', 123);
    // => 123

    res.header('Content-Length');
    // => 123

    res.header('foo', new Date());
    // => Fri, 03 Feb 2012 20:09:58 GMT
```

## charSet(type)

Appends the provided character set to the response's `Content-Type`.

```js
res.charSet('utf-8');
```

Will change the normal json Content-Type to `application/json; charset=utf-8`.

## cache([type], [options])

Sets the cache-control header.  `type` defaults to _public_, and
options currently only takes `maxAge`.

```js
res.cache();
```

## status(code)

Sets the response statusCode.

```js
res.status(201);
```

## send([status], body)

You can use `send()` to wrap up all the usual `writeHead()`,
`write()`, `end()` calls on the HTTP API of node.  You can pass send
either a code and body, or just a body.  `body` can be an Object, a
Buffer, or an Error.  When you call `send()`, restify figures out how
to format the response (see content-negotiation, above), and does
that.

```js
res.send({hello: 'world'});
res.send(201, {hello: 'world'});
res.send(new BadRequestError('meh'));
```

## redirect(status, url, next)
## redirect([url | options], next)

A convenience method for 301/302 redirects. Using this method will
tell restify to stop execution of your handler chain. You can also
use an options object. `next` is required.

```js
res.redirect('/foo', next);
res.redirect('http://www.foo.com', next);
res.redirect(301, '/foo', next);
res.redirect({
  hostname: 'www.foo.com',
  pathname: '/bar',
  port: 80,                 // defaults to 80
  secure: true,             // sets https
  permanent: true,
  query: {
    a: 1
  }
}, next);  // => redirects to 301 https://www.foo.com/bar?a=1
```

## json([status], body)

Short-hand for:

```js
res.contentType = 'json';
res.send({hello: 'world'});
```

## Properties

|Name|Type|Description|
|----|----|-----------|
|code|Number|HTTP status code|
|contentLength|Number|short hand for the header content-length|
|contentType|String|short hand for the header content-type|
|headers|Object|response headers|
|id|String|A unique request id (x-request-id)|