Feature Requests
================

While the maintainers of restify work hard to provide the best possible
framwork for building REST services, there is more work to go around than there
are hours in the day. This document contains a set of features that have been
requested by the community. If you are looking to contribute, the items on
this list -- along with the open bugs on the issues tab -- are a great place to
start!

> The features here are not sorted in any particular order. Each feature links
> to the original GitHub issue requesting it. While feature requests are
> generally closed and moved to this document, discussion around the feature
> still takes place on the original issue. Even if there has been a discussion
> on the issue already, it is still worth declaring your intent to open a PR
> before investing time in writing code.

## Code

* [Support `server.use(route, handler)` and `server.all`][289]
* [Support asynchronous callbacks for throttle][381]
* [Streaming multipart parser without needing temporary files][474]
* [Default client to http protocol][790]
* [Exponential backoff and retry][633]
* [Arbitrary HTTP methods][576]
* [Detect route conflicts][909]
* [Improve upon `next.ifError`][875]
* [Benchmark suite][860]
* [HTTP/2 support][853]
* [Improve performance of route lookup][850]
* [Support HTTP_PROXY][813]
* [IE9 support for `bodyParser`][801]
* [Multipart Client Support][921]
* [Remove `next(err)`][1019]
* [Support `RegExp` for `route.render`][632]
* [Run internal handlers on `NotFound`][708]
* [Support multiple apps on the same port][1035]
* [Multiple versions for routes][1134]
* [sysdig support][1323]
* [Migrate routing DSL to `path-to-regexp][1292]

## Documentation

* [Socket.io support][717]
* [`uncaughtException` handler when opting into domains][829]
* [Forward `req_id`][1101]
* [Document `bodyParser` headers][989]
* [Improve signRequest documentation][737]
* [Better documentation for `client.close`][859]
* [Document all client options][1326]
* [Client tunneling vs. proxying][1327]
* [Explain why Restify is great!][927]
* [`BasicAut` examples][1099]
* [Document `next` behaviour][1068]
* [Remove defaultResponseHeaders][1040]
* [Properly document req.accepts][957]
* [Plugin custom errors][948]
* [`findByPath` on `Router`][1136]
* [Multiple route handlers][1183]
* [Update new `HttpError` codes][1206]
* [v4 res.headers][1286]
* [Document RegExp DSL for routing][1065]

[289]: https://github.com/restify/node-restify/issues/289
[381]: https://github.com/restify/node-restify/issues/381
[474]: https://github.com/restify/node-restify/issues/474
[575]: https://github.com/restify/node-restify/issues/575
[790]: https://github.com/restify/node-restify/issues/790
[633]: https://github.com/restify/node-restify/issues/663
[717]: https://github.com/restify/node-restify/issues/717#issuecomment-296531086
[576]: https://github.com/restify/node-restify/issues/576
[576]: https://github.com/restify/node-restify/issues/576
[909]: https://github.com/restify/node-restify/issues/909
[875]: https://github.com/restify/node-restify/issues/875
[860]: https://github.com/restify/node-restify/issues/860
[853]: https://github.com/restify/node-restify/issues/853
[850]: https://github.com/restify/node-restify/issues/850
[829]: https://github.com/restify/node-restify/issues/829
[813]: https://github.com/restify/node-restify/issues/813
[801]: https://github.com/restify/node-restify/issues/801
[921]: https://github.com/restify/node-restify/issues/921
[1101]: https://github.com/restify/node-restify/issues/1101
[1019]: https://github.com/restify/node-restify/issues/1019
[989]: https://github.com/restify/node-restify/issues/989
[632]: https://github.com/restify/node-restify/issues/632
[708]: https://github.com/restify/node-restify/issues/708
[737]: https://github.com/restify/node-restify/issues/737
[859]: https://github.com/restify/node-restify/issues/859
[1326]: https://github.com/restify/node-restify/issues/1326
[1327]: https://github.com/restify/node-restify/issues/1327
[927]: https://github.com/restify/node-restify/issues/927
[1099]: https://github.com/restify/node-restify/issues/1099
[1068]: https://github.com/restify/node-restify/issues/1068
[1040]: https://github.com/restify/node-restify/issues/1040
[1035]: https://github.com/restify/node-restify/issues/1035
[957]: https://github.com/restify/node-restify/issues/957
[948]: https://github.com/restify/node-restify/issues/948
[1134]: https://github.com/restify/node-restify/issues/1134
[1136]: https://github.com/restify/node-restify/issues/1136
[1183]: https://github.com/restify/node-restify/issues/1183
[1206]: https://github.com/restify/node-restify/issues/1206
[1286]: https://github.com/restify/node-restify/issues/1286
[1323]: https://github.com/restify/node-restify/issues/1323
[1292]: https://github.com/restify/node-restify/issues/1292
[1065]: https://github.com/restify/node-restify/pull/1065