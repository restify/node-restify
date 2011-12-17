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

server.on('404', function(req, res) {
  res.send(new errors.RestError(404, 'ResourceNotFound', 'foo'));
  res.end();
});


server.on('405', function(req, res) {
  res.writeHead(405);
  res.end();
});

server.use(function(req, res, next) {
  console.log('hello!');
  return next();
});


server.get('/foo/:bar', function(req, res, next) {
  return next();
}, function(req, res, next) {
  console.log('%j', req.params);
  res.send({
    hello: 'world'
  });
  return next();
}).name = 'GetFoo';

server.use(function(req, res, next) {
  console.log('world!');
  return next();
});

server.on('after', function(req, res, name) {
  console.log(name + ' -> just ran');
});

server.listen(9080, function() {
  console.log('listening: %s', server.url);
});

