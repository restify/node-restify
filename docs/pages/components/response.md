# Response API

Wraps all of the node
[ServerResponse](http://nodejs.org/docs/latest/api/http.html#http.ServerResponse)
APIs, events and properties, plus the following.


## cache([type], [options])

* `type` {String} the type, either 'public' | 'private'. defaults to 'public'
* `options.maxAge` {Number} an options object

Sets the cache-control header.


## noCache()

Turns off all cache related headers.


## charSet(type)

* `type` {String} a charset header value

Appends the provided character set to the response's `Content-Type`.

```js
res.charSet('utf-8');
```


## header([key] [, value])

* `key` {String} name of the header
* `value` {String} value of the header

__Returns__ {String} the retrieved value or the value that was set

If only key is specified, return the value of the header. If both key and value
are specified, set the response header.

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

`header()` can also be used to automatically chain header values when
applicable:

```js
res.header('x-foo', 'a');
res.header('x-foo', 'b');
// => { 'x-foo': ['a', 'b'] }
```

Note that certain headers like set-cookie and content-type do not support
multiple values, so calling `header()` twice for those headers will overwrite
the existing value.


## headers()

__Returns__ {Object}

Retrieves all headers off the response in an object of key/val pairs.


## link(key, value)

* `key` {String} - the link key
* `value` {String} - the link value

__Returns__ {String} the final value of the header

Sets the link header.

## redirect(code, url, next)
## redirect([url | options], next)

* `code` {Number} http redirect status code
* `url` {String} a url to redirect to
* `next` {Function} a callback function
* `options` {Object} an options object to configure a redirect

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


## status(code)

* `code` {Number} an http status code

Sets the response statusCode.

```js
res.status(201);
```


## send([code] [, body] [, headers] [, callback])

* `code` {Number} an http status code
* `body` {String | Object | Array | Buffer} the payload to send
* `[headers]` {Object} an optional object of headers (key/val pairs)
  formatters

You can use `send()` to wrap up all the usual `writeHead()`, `write()`, `end()`
calls on the HTTP API of node. You can pass send either a code and body, or
just a body. `body` can be an Object, a Buffer, or an Error.  When you call
`send()`, restify figures out how to format the response based on the
content-type.

```js
res.send({hello: 'world'});
res.send(201, {hello: 'world'});
res.send(new BadRequestError('meh'));
```


## sendRaw([code] [, body] [, headers])

Like `res.send()`, but skips formatting. This can be useful when the payload
has already been preformatted.


## set(headers)

* `headers` {Object} an object of header names => header values

Sets multiple header(s) on the response. Uses `header()` underneath the hood,
enabling multi-value headers.

```js
res.header('x-foo', 'a');
res.set({
    'x-foo', 'b',
    'content-type': 'application/json'
});
// =>
// {
//    'x-foo': [ 'a', 'b' ],
//    'content-type': 'application/json'
// }
```


## json([code] [, body] [, headers])

Same signature as `res.send()`. Syntatic sugar for:

```js
res.header('content-type', 'json');
res.send({hello: 'world'});
```
