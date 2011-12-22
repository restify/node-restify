// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var d = require('dtrace-provider');

var errors = require('./errors');
var log4js = require('./log4js_stub');
var plugins = require('./plugins');
var Server = require('./server');



///--- Exported API

module.exports = {

  createServer: function createServer(options) {
    if (!options)
      options = {};
    if (!options.log4js)
      options.log4js = log4js;
    if (!options.name)
      options.name = 'restify';
    if (!options.dtrace)
      options.dtrace = d.createDTraceProvider(options.name);

    return new Server(options);
  }

};

Object.keys(errors).forEach(function(k) {
  module.exports[k] = errors[k];
});

Object.keys(plugins).forEach(function(k) {
  module.exports[k] = plugins[k];
});

