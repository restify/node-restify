'use strict';

var restify = process.argv.includes('version=head')
    ? require('../../lib')
    : require('restify');

var server = restify.createServer();
var path = '/';
var port = 3000;

module.exports = {
    url: 'http://localhost:' + port + path
};

function handler(req, res, next) {
    next();
}

for (var i = 0; i < 10; i++) {
    server.pre(handler);
}

for (var j = 0; j < 10; j++) {
    server.use(handler);
}

server.get(path, function get(req, res) {
    res.send('hello world');
});

if (!module.parent) {
    server.listen(port);
}
