---
title: Dtrace
permalink: /docs/dtrace/
---

One of the coolest features of restify is that it automatically
creates DTrace probes for you whenever you add a new route/handler.
To use DTrace you need to pass `dtrace` option to the server
`restify.createServer({ dtrace: true })`.
The easiest way to explain this is with an example:

```js
var restify = require('restify');

var server = restify.createServer({
  name: 'helloworld',
  dtrace: true
});

server.use(restify.plugins.acceptParser(server.acceptable));
server.use(restify.plugins.authorizationParser());
server.use(restify.plugins.dateParser());
server.use(restify.plugins.queryParser());
server.use(restify.plugins.urlEncodedBodyParser());

server.use(function slowHandler(req, res, next) {
  setTimeout(function() {
    return next();
  }, 250);
});

server.get({path: '/hello/:name', name: 'GetFoo'}, function respond(req, res, next) {
  res.send({
    hello: req.params.name
  });
  return next();
});

server.listen(8080, function() {
  console.log('listening: %s', server.url);
});
```

So we've got our typical "hello world" server now, with a slight twist; we
introduced an artificial 250ms lag.  Also, note that we named our server, our
routes, and all of our handlers (functions); while that's optional, it
does make DTrace much more usable.  So, if you started that server,
then looked for DTrace probes, you'd see something like this:

```sh
$ dtrace -l -P restify*
ID   PROVIDER            MODULE                          FUNCTION NAME
24   restify38789        mod-88f3f88                     route-start route-start
25   restify38789        mod-88f3f88                     handler-start handler-start
26   restify38789        mod-88f3f88                     handler-done handler-done
27   restify38789        mod-88f3f88                     route-done route-done
```

## route-start

|Field|Type|Description|
|-----|----|-----------|
|server name|char *|name of the restify server that fired|
|route name|char *|name of the route that fired|
|id|int|unique id for this request|
|method|char *|HTTP request method|
|url|char *|(full) HTTP URL|
|headers|char *|JSON encoded map of all request headers|

## handler-start

|Field|Type|Description|
|-----|----|-----------|
|server name|char *|name of the restify server that fired|
|route name|char *|name of the route that fired|
|handler name|char *|name of the function that just entered|
|id|int|unique id for this request|

## route-done

|Field|Type|Description|
|-----|----|-----------|
|server name|char *|name of the restify server that fired|
|route name|char *|name of the route that fired|
|id|int|unique id for this request|
|statusCode|int|HTTP response code|
|headers|char *|JSON encoded map of response headers|

## handler-done

|Field|Type|Description|
|-----|----|-----------|
|server name|char *|name of the restify server that fired|
|route name|char *|name of the route that fired|
|handler name|char *|name of the function that just entered|
|id|int|unique id for this request|

## Example D Script

Now, if you wanted to say get a breakdown of latency by handler, you
could do something like this:

```
#!/usr/sbin/dtrace -s
#pragma D option quiet

restify*:::route-start
{
   track[arg2] = timestamp;
}

restify*:::handler-start
/track[arg3]/
{
   h[arg3, copyinstr(arg2)] = timestamp;
}

restify*:::handler-done
/track[arg3] && h[arg3, copyinstr(arg2)]/
{
   @[copyinstr(arg2)] = quantize((timestamp - h[arg3, copyinstr(arg2)]) / 1000000);
   h[arg3, copyinstr(arg2)] = 0;
}

restify*:::route-done
/track[arg2]/
{
   @[copyinstr(arg1)] = quantize((timestamp - track[arg2]) / 1000000);
   track[arg2] = 0;
}
```

So running the server in one terminal:

```sh
$ node helloworld.js
```

The D script in another:

```sh
$ ./helloworld.d
```

Hit the server a few times with curl:

```sh
$ for i in {1..10} ; do curl -is http://127.0.0.1:8080/hello/mark ; done
```

Then Ctrl-C the D script, and you'll see the "slowHandler" at the
bottom of the stack, bucketized that it's the vast majority of latency
in this pipeline

```sh
handler-6
value  ------------- Distribution ------------- count
-1 |                                         0
0  |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ 10
1  |                                         0

parseAccept
value  ------------- Distribution ------------- count
-1 |                                         0
0  |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ 10
1  |                                         0

parseAuthorization
value  ------------- Distribution ------------- count
-1 |                                         0
0  |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ 10
1  |                                         0

parseDate
value  ------------- Distribution ------------- count
-1 |                                         0
0  |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ 10
1  |                                         0

parseQueryString
value  ------------- Distribution ------------- count
-1 |                                         0
0  |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ 10
1  |                                         0

parseUrlEncodedBody
value  ------------- Distribution ------------- count
-1 |                                         0
0  |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ 10
1  |                                         0

respond
value  ------------- Distribution ------------- count
1  |                                         0
2  |@@@@                                     1
4  |                                         0
8  |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@     9
16 |                                         0

slowHandler
value  ------------- Distribution ------------- count
64  |                                         0
128 |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@     9
256 |@@@@                                     1
512 |                                         0

getfoo
value  ------------- Distribution ------------- count
64  |                                         0
128 |@@@@                                     1
256 |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@     9
512 |
```
