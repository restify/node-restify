// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var errors = require('./errors');
var plugins = require('./plugins');
var Server = require('./server');



///--- Exported API

module.exports = {

  createServer: function createServer(options) {
    return new Server(options || {});
  }

};

Object.keys(errors).forEach(function(k) {
  module.exports[k] = errors[k];
});

Object.keys(plugins).forEach(function(k) {
  module.exports[k] = plugins[k];
});

