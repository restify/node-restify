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