---
title: restify 8.x to 9.x migration guide
permalink: /docs/8to9/
---

## Introduction

restify `9.x` comes with `async/await` support!

## Breaking Changes

### Drops support for Node.js `8.x`

Restify requires Node.js version `>=10.0.0`. 

### Async/await support

`async/await` basic support for `.pre()`, `.use()` and route handlers.

#### Example

```js
const restify = require('restify');

const server = restify.createServer({});

server.use(async (req, res) => {
  req.something = await doSomethingAsync();
});

server.get('/params', async (req, res) => {
  const value = await asyncOperation(req.something);
   res.send(value);
});
```

#### Middleware API (`.pre()` and `.use()`)

```js
server.use(async (req, res) => {
  req.something = await doSomethingAsync();
});
```
- `fn.length === 2` (arity 2);
- `fn instanceof AsyncFunction`;
- if the async function resolves, it calls `next()`;
- any value returned by the async function will be discarded;
- if it rejects with an `Error` instance it calls `next(err)`;
- if it rejects with anything else it wraps in a `AsyncError` and calls `next(err)`;

#### Route handler API

```js
server.get('/something', async (req, res) => {
  const someData = await fetchSomeDataAsync();
  res.send({ data: someData });
});
```
- `fn.length === 2` (arity 2);
- `fn instanceof AsyncFunction`;
- if the async function resolves without a value, it calls `next()`;
- if the async function resolves with a string value, it calls `next(string)` (re-routes*);
- if the async function resolves with a value other than string, it calls `next(any)`;
- if it rejects with an `Error` instance it calls `next(err)`;
- if it rejects with anything else it wraps in a `AsyncError` and calls `next(err)` (error-handing**);

##### (*) Note about re-routing:
The `8.x` API allows re-routing when calling `next()` with a string value. If the string matches a valid route,
it will re-route to the given handler. The same is valid for resolving a async function. If the value returned by
the async function is a string, it will try to re-route to the given handler.

##### (**) Note about error handling:
Although it is recommended to always reject with an instance of Error, in a async function it is possible to
throw or reject without returning an `Error` instance or even anything at all. In such cases, the value rejected
will be wrapped on a `AsyncError`.

### Handler arity check
Handlers expecting 2 or fewer parameters added to a `.pre()`, `.use()` or route chain must be async functions, as:

```js
server.use(async (req, res) => {
  req.something = await doSomethingAsync();
});
```

Handlers expecting more than 2 parameters shouldn't be async functions, as:

````js
// This middleware will be rejected and restify will throw
server.use(async (req, res, next) => {
  doSomethingAsync(function callback(val) {
    req.something = val;
    next();
  });
});
````
