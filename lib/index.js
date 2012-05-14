// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var http = require('http');

var Logger = require('bunyan');
var mime = require('mime');

var clients = require('./clients');
var errors = require('./errors');
var plugins = require('./plugins');

var sanitizePath = require('./utils').sanitizePath;


///--- Globals

var DTRACE;

var HttpClient = clients.HttpClient;
var JsonClient = clients.JsonClient;
var StringClient = clients.StringClient;



///--- Helpers

function bunyanResponseSerializer(res) {
  return {
    statusCode: res ? res.statusCode : false,
    headers: res ? res.headers : false
  };
}


function bunyanClientRequestSerializer(req) {

  var host = false;
  if (req.host) {
    try {
      host = req.host.split(':')[0];
    } catch (e) {}
  }

  return {
    method: req ? req.method : false,
    url: req ? req.path : false,
    address: req ? host : false,
    port: req ? req.port : false,
    headers: req ? req.headers : false
  };
}


function logger(log, name) {
  if (log) {
    return log.child({
      serializers: {
        err: Logger.stdSerializers.err,
        req: Logger.stdSerializers.req,
        res: bunyanResponseSerializer,
        client_req: bunyanClientRequestSerializer
      }
    });
  }

  return new Logger({
    level: 'warn',
    name: name,
    stream: process.stderr,
    serializers: {
      err: Logger.stdSerializers.err,
      req: Logger.stdSerializers.req,
      res: bunyanResponseSerializer,
      client_req: bunyanClientRequestSerializer
    }
  });
}


function defaultDTrace(name) {
  // see https://github.com/mcavage/node-restify/issues/80 and
  // https://github.com/mcavage/node-restify/issues/100
  if (!DTRACE) {
    try {
      var d = require('dtrace-provider');
      DTRACE = d.createDTraceProvider(name.replace(/\W+/g, '-'));
    } catch (e) {
      DTRACE = {
        addProbe: function addProbe() {},
        enable: function enable() {},
        fire: function fire() {}
      };
    }
  }

  return DTRACE;
}


///--- Exported API

module.exports = {

  bunyan: {
    serializers: {
      response: bunyanResponseSerializer
    }
  },

  createServer: function createServer(options) {
    if (!options)
      options = {};
    if (!options.name)
      options.name = 'restify';
    if (!options.dtrace)
      options.dtrace = defaultDTrace(options.name);

    options.log = logger(options.log, options.name);

    // Ensure these are loaded
    require('./request');
    require('./response');
    var Server = require('./server');

    return new Server(options);
  },


  createClient: function createClient(options) {
    if (typeof (options) !== 'object')
      throw new TypeError('options (Object) required');

    if (!options.name)
      options.name = 'restify';
    if (!options.type)
      options.type = 'application/octet-stream';
    if (!options.dtrace)
      options.dtrace = defaultDTrace(options.name);

    options.log = logger(options.log, options.name);

    var client;
    switch (options.type) {
    case 'json':
      client = new JsonClient(options);
      break;

    case 'string':
      client = new StringClient(options);
      break;

    case 'http':
    default:
      client = new HttpClient(options);
      break;
    }

    return client;
  },


  createJsonClient: function createJsonClient(options) {
    if (typeof (options) !== 'object')
      throw new TypeError('options (Object) required');

    options.type = 'json';
    return module.exports.createClient(options);
  },


  createStringClient: function createStringClient(options) {
    if (typeof (options) !== 'object')
      throw new TypeError('options (Object) required');

    options.type = 'string';
    return module.exports.createClient(options);
  },


  /**
   * Returns a string representation of a URL pattern , with its parameters
   * filled in by the passed hash.
   *
   * If a key is not found in the hash for a param, it is left alone.
   *
   * @param {Object} a hash of parameter names to values for substitution.
   */
  realizeUrl: function realizeUrl(pattern, params) {
    return sanitizePath(pattern.replace(/\/:([^/]+)/g, function (match, key) {
      return params.hasOwnProperty(key) ? '/' + params[key] : match;
    }));
  },


  HttpClient: HttpClient,
  JsonClient: JsonClient,
  StringClient: StringClient
};


Object.keys(errors).forEach(function (k) {
  module.exports[k] = errors[k];
});

Object.keys(plugins).forEach(function (k) {
  module.exports[k] = plugins[k];
});

module.exports.__defineSetter__('defaultResponseHeaders', function (f) {
  if (f === false || f === null || f === undefined) {
    f = function () {};
  } else if (f === true) {
    return;
  } else if (typeof (f) !== 'function') {
    throw new TypeError('defaultResponseHeaders must be a function');
  }

  http.ServerResponse.prototype.defaultResponseHeaders = f;
});
