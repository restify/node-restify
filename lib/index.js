// Copyright 2011 Mark Cavage, Inc.  All rights reserved.


var Server = require('./server');



///--- Exported API

module.exports = {

  createServer: function createServer(options) {
    return new Server(options || {});
  }

};


///--- Shitty test for now

var log4js = require('./log4js_stub');
var errors = require('./err');
var http = require('http');

log4js.setGlobalLogLevel('Trace');

var server = new Server({
  log4js: log4js,
  formatters: {
    'application/foo': function(req, res, body) {
      return body.toString().toUpperCase();
    }
  }
});

server.use(function empty(req, res, next) {
  return next();
});

server.get('/foo/:bar', function empty2(req, res, next) {
  return next();
}, function(req, res, next) {
  res.send({
    hello: 'world'
  });
  return next();
}).name = 'GetFoo';

server.on('after', function(req, res, name) {
  console.log(name + ' -> just ran');
});

// server.on('NotFound', function(req, res) {
//   res.send(404);
// });

// server.on('MethodNotAllowed', function(req, res) {
//   res.send(405);
// });

// server.on('VersionNotAllowed', function(req, res) {
//   res.send(409);
// });

server.listen(9080, function() {
  console.log('listening: %s', server.url);
});
