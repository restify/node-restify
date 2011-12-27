var restify = require('../lib');
var log4js = require('../lib/log4js_stub');

log4js.setGlobalLogLevel('TRACE');

var log = log4js.getLogger('main');

var server = restify.createServer({
  name: 'exampleapp',
  log4js: log4js,
  formatters: {
    'application/foo': function(req, res, body) {
      if (body instanceof Error) {
        body = body.stack;
      } else if (Buffer.isBuffer(body)) {
        body = body.toString('base64');
      } else {
        switch (typeof(body)) {
        case 'boolean':
        case 'number':
        case 'string':
          body = body.toString();
          break;

        case 'undefined':
          body = '';
          break;

        default:
          body = body === null ? '' : JSON.stringify(body);
          break;
        }

      }
      return body;
    }
  }
});

server.use(restify.acceptParser(server.acceptable));
server.use(restify.authorizationParser());
server.use(restify.dateParser());
server.use(restify.queryParser());
server.use(restify.urlEncodedBodyParser());

server.use(function slowHandler(req, res, next) {
  setTimeout(function() { return next(); }, 250);
});

server.get({url: '/foo/:id', name: 'GetFoo'}, function (req, res, next) {
  return next();
}, function sendResult(req, res, next) {
  res.send({
    hello: req.params.id
  });
  return next();
});

server.head('/foo/:id', function (req, res, next) {
  res.send({
    hello: req.params.id
  });
  return next();
});

server.put('/foo/:id', function (req, res, next) {
  res.send({
    hello: req.params.id
  });
  return next();
});

server.post('/foo/:id', function (req, res, next) {
  res.json(201, req.params);
  return next();
});

server.del('/foo/:id', function (req, res, next) {
  res.send(204);
  return next();
});

server.on('after', function(req, res, name) {
  req.log.info('%s just finished: %d.', name, res.code);
});

server.on('NotFound', function(req, res) {
  res.send(404, req.url + ' was not found');
});

// server.on('MethodNotAllowed', function(req, res) {
//   res.send(405);
// });


server.listen(9080, function() {
  log.info('listening: %s', server.url);
});



///--- DTracing
//
// Listing DTrace probes for this script now would show something like:
// $ sudo dtrace -l -P exampleapp*
// Password:
//    ID   PROVIDER        MODULE       FUNCTION NAME
// 22415 exampleapp38717        module           func getfoo-start
// 22416 exampleapp38717        module           func getfoo-done
// 22417 exampleapp38717        module           func getfoo-parseAccept-start
// 22418 exampleapp38717        module           func getfoo-parseAccept-done
// 22420 exampleapp38717        module           func getfoo-parseAuthorization-done
// 22421 exampleapp38717        module           func getfoo-parseDate-start
// 22423 exampleapp38717        module           func getfoo-parseQueryString-start
// 22424 exampleapp38717        module           func getfoo-parseQueryString-done
// 22425 exampleapp38717        module           func getfoo-slowHandler-start
// 22426 exampleapp38717        module           func getfoo-slowHandler-done
// 22427 exampleapp38717        module           func getfoo-6-start
// 22428 exampleapp38717        module           func getfoo-6-done
// 22429 exampleapp38717        module           func getfoo-sendResult-start
// 22430 exampleapp38717        module           func getfoo-sendResult-done
//
// So now you could use the handler-timing.d in this directory to watch
// for timing results for each handler. Or whatever else you want.
// The DTrace signatures look like:
//
// $route-start and $route-$handler-start
// id, url, user-agent, user, content-type, content-length
//
// $route-done and $route-$handler-done
// id, code, content-type, content-length
//
//
// There's an example D script here to showcase a "slow" handler where it's
// wildcard'd by the route name.  In "real life" you'd probably start with a
// d script that breaks down the route -start and -done, and then you'd want
// to see which handler is taking longest from there.
//
// $ node demo.js
// $ curl localhost:9080/foo/bar
// $ sudo ./handler-timing.d
// ^C
//   getfoo-6
//            value  ------------- Distribution ------------- count
//               -1 |                                         0
//                0 |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ 6
//                1 |                                         0
//
//   getfoo-parseAccept
//            value  ------------- Distribution ------------- count
//               -1 |                                         0
//                0 |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ 6
//                1 |                                         0
//
//   getfoo-parseAuthorization
//            value  ------------- Distribution ------------- count
//               -1 |                                         0
//                0 |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ 6
//                1 |                                         0
//
//   getfoo-parseDate
//            value  ------------- Distribution ------------- count
//               -1 |                                         0
//                0 |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ 6
//                1 |                                         0
//
//   getfoo-parseQueryString
//            value  ------------- Distribution ------------- count
//               -1 |                                         0
//                0 |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ 6
//                1 |                                         0
//
//   getfoo-sendResult
//            value  ------------- Distribution ------------- count
//               -1 |                                         0
//                0 |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ 6
//                1 |                                         0
//
//   getfoo-slowHandler
//            value  ------------- Distribution ------------- count
//               64 |                                         0
//              128 |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ 6
//              256 |                                         0
