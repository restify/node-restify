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

server.get(path, function onRequest(req, res, next) {
    res.send('hello world');
    next();
});

if (require.main === module) {
    server.listen(port);
}
