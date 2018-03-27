'use strict';

var restify = require('../lib');
var server = restify.createServer();

server.pre(function pre(req, res, next) {
    console.log('pre');
    next();
});

server.use(function use(req, res, next) {
    console.log('use');
    next();
});

server.on('after', function(req, res, route, err) {
    console.log('after');
});

server.get(
    '/:userId',
    function onRequest(req, res, next) {
        console.log(req.url, '1');
        next();
    },
    function onRequest(req, res, next) {
        console.log(req.url, '2');
        res.send({ hello: 'world' });
        next();
    }
);

server.listen(3001);
