'use strict';

var restify = process.argv.includes('version=head')
    ? require('../../lib')
    : require('restify');

var server = restify.createServer();

server.get('/', function onRequest(req, res) {
    res.send({ hello: 'world' });
});

server.listen(3000);
