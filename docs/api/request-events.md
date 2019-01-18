### restifyDone

After request has been fully serviced, an `restifyDone` event is fired.
restify considers a request to be fully serviced when either:

1) The handler chain for a route has been fully completed
2) An error was returned to `next()`, and the corresponding error events have
   been fired for that error type

The signature for the `restifyDone` event is as follows:

```js
function(route, error) { }
```

* `route` - the route object that serviced the request
* `error` - the error passed to `next()`, if applicable

Note that when the server automatically responds with a
`NotFound`/`MethodNotAllowed`/`VersionNotAllowed`, this event will still be
fired.
