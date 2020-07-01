'use strict';

// There's an example D script here to showcase a "slow" handler where it's
// wildcard'd by the route name.  In "real life" you'd probably start with a
// d script that breaks down the route -start and -done, and then you'd want
// to see which handler is taking longest from there.
//
// $ node demo.js
// $ curl localhost:9080/foo/bar
// $ sudo ./handler-timing.d
// ^C
//
//   handler-6
//            value  ------------- Distribution ------------- count
//               -1 |                                         0
//                0 |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ 10
//                1 |                                         0
//
//   parseAccept
//            value  ------------- Distribution ------------- count
//               -1 |                                         0
//                0 |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ 10
//                1 |                                         0
//
//   parseAuthorization
//            value  ------------- Distribution ------------- count
//               -1 |                                         0
//                0 |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ 10
//                1 |                                         0
//
//   parseDate
//            value  ------------- Distribution ------------- count
//               -1 |                                         0
//                0 |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ 10
//                1 |                                         0
//
//   parseQueryString
//            value  ------------- Distribution ------------- count
//               -1 |                                         0
//                0 |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ 10
//                1 |                                         0
//
//   parseUrlEncodedBody
//            value  ------------- Distribution ------------- count
//               -1 |                                         0
//                0 |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ 10
//                1 |                                         0
//
//   sendResult
//            value  ------------- Distribution ------------- count
//                1 |                                         0
//                2 |@@@@                                     1
//                4 |                                         0
//                8 |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@     9
//               16 |                                         0
//
//   slowHandler
//            value  ------------- Distribution ------------- count
//               64 |                                         0
//              128 |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@     9
//              256 |@@@@                                     1
//              512 |                                         0
//
//   getfoo
//            value  ------------- Distribution ------------- count
//               64 |                                         0
//              128 |@@@@                                     1
//              256 |@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@     9
//              512 |                                         0

var restify = require('../../lib');
var Logger = require('pino');

///--- Globals

var NAME = 'exampleapp';

///--- Mainline

var log = new Logger({
    name: NAME,
    level: 'trace',
    base: { service: NAME },
    serializers: restify.bunyan.serializers
});

var server = restify.createServer({
    name: NAME,
    Logger: log,
    dtrace: true,
    formatters: {
        'application/foo': function(req, res, body) {
            if (body instanceof Error) {
                body = body.stack;
            } else if (Buffer.isBuffer(body)) {
                body = body.toString('base64');
            } else {
                switch (typeof body) {
                    case 'boolean':
                    case 'number':
                    case 'string':
                        body = body.toString();
                        break;

                    case 'undefined':
                        body = '';
                        break;

                    default:
                        body =
                            body === null
                                ? ''
                                : 'Demoing application/foo formatter; ' +
                                  JSON.stringify(body);
                        break;
                }
            }
            return body;
        }
    }
});

server.use(restify.plugins.acceptParser(server.acceptable));
server.use(restify.plugins.authorizationParser());
server.use(restify.plugins.dateParser());
server.use(restify.plugins.queryParser());
server.use(restify.plugins.urlEncodedBodyParser());

server.use(function slowHandler(req, res, next) {
    setTimeout(function() {
        next();
    }, 250);
});

server.get(
    { url: '/foo/:id', name: 'GetFoo' },
    function(req, res, next) {
        next();
    },
    function sendResult(req, res, next) {
        res.contentType = 'application/foo';
        res.send({
            hello: req.params.id
        });
        next();
    }
);

server.head('/foo/:id', function(req, res, next) {
    res.send({
        hello: req.params.id
    });
    next();
});

server.put('/foo/:id', function(req, res, next) {
    res.send({
        hello: req.params.id
    });
    next();
});

server.post('/foo/:id', function(req, res, next) {
    res.json(201, req.params);
    next();
});

server.del('/foo/:id', function(req, res, next) {
    res.send(204);
    next();
});

server.on('after', function(req, res, name) {
    req.log.info('%s just finished: %d.', name, res.code);
});

server.on('NotFound', function(req, res) {
    res.send(404, req.url + ' was not found');
});

server.listen(9080, function() {
    log.info('listening: %s', server.url);
});
