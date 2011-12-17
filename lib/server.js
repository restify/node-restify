// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var http = require('http');
var https = require('https');
var url = require('url');
var util = require('util');

var EventEmitter = require('eventemitter2').EventEmitter2;

var parsers = require('./parsers');
var Request = require('./request');
var Response = require('./response');
var Route = require('./route');
var utils = require('./utils');



///--- API

/**
 * Constructor. Creates a REST API Server.
 *
 * - options {Object} construction arguments.
 */
function Server(options) {
  if (typeof(options) !== 'object')
    throw new TypeError('options (Object) required');
  if (typeof(options.log4js) !== 'object')
    throw new TypeError('options.log4js (Object) required');

  EventEmitter.call(this, {
    wildcard: true
  });

  this.chain = [];
  this.formatters = options.formatters || {};
  this.log4js = options.log4js;
  this.log = this.log4js.getLogger('Server');
  this.routes = [];

  var secure = false;
  if (options.certificate && options.key) {
    secure = true;
    this.server = https.createServer({
      cert: options.certificate,
      key: options.key
    });
  } else {
    this.server = http.createServer();
  }

  var self = this;
  this.server.on('connection', function(socket) {
    self.emit('connection', socket);
  });
  this.server.on('close', function() {
    self.emit('close');
  });
  this.server.on('request', function(req, res) {
    return self._request(req, res);
  });

  // Finally register the "standard helpers"
  if (!options.noParsers) {
    var accept = Object.keys(this.formatters);
    this.use(parsers.getAcceptParser(accept.length ? accept : 'json'));
    this.use(parsers.getDateParser(300));
    this.use(parsers.getAuthorizationParser());
    this.use(parsers.getQueryParser());
  }

  this.__defineGetter__('url', function() {
    if (self.socketPath)
      return 'http://' + self.socketPath;

    var str = secure ? 'https://' : 'http://';
    str += self.hostname || 'localhost';
    str += ':';
    str += self.port || 0;
    return str;
  });
}
util.inherits(Server, EventEmitter);
module.exports = Server;


Server.prototype.listen = function listen(port, hostname, callback) {
  if (typeof(port) === 'number') {
    if (typeof(hostname) === 'function') {
      callback = hostname;
      hostname = '0.0.0.0';
    } else if (typeof(hostname) === 'undefined') {
      hostname = '0.0.0.0';
    } else if (typeof(hostname) === 'string') {
      // NoOp
    } else {
      throw new TypeError('hostname must be a string');
    }

    this.port = port;
    this.hostname = hostname;
    return this.server.listen(port, hostname, function() {
      if (callback)
        return callback();
    });
  } else if (typeof(port) === 'string') {
    if (typeof(hostname) === 'function') {
      callback = hostname;
      hostname = null;
    } else if (typeof(hostname) === 'undefined') {
      // NoOp
    } else {
      throw new TypeError('callback must be a Function');
    }

    this.socketPath = port;
    return this.server.listen(port, function() {
      if (callback)
        return callback();
    });
  }

  throw new TypeError('port (number) required');
};


Server.prototype.close = function close(callback) {
  if (callback) {
    if (typeof(callback) !== 'function')
      throw new TypeError('callback must be a function');

    this.server.once('close', function() {
      return callback();
    });
  }

  return this.server.close();
};


Server.prototype.get = function get(path) {
  if (typeof(path) !== 'string')
    throw new TypeError('path (String) required');
  if (arguments.length < 2)
    throw new Error('At least one handler (Function) required');

  return this._addRoute('GET', path, Array.prototype.slice.call(arguments, 1));
};


/**
 * Removes a route from the server.
 *
 * You can either pass in the route name or the route object as `name`.
 *
 * @param {String} name the route name.
 * @return {Boolean} true if route was removed, false if not.
 * @throws {TypeError} on bad input.
 */
Server.prototype.rm = function rm(name) {
  if (typeof(name) !== 'string' && !(name instanceof Route))
    throw new TypeError('name (String) required');

  for (var i = 0; i < this.routes.length; i++) {
    if (this.routes[i].name === name || this.routes[i] === name) {
      this.routes.splice(i, 1);
      return true;
    }
  }

  return false;
};


/**
 * Installs a list of handlers to run _before_ the "normal" handlers of all
 * routes.
 *
 * You can pass in any combination of functions or array of functions.
 *
 * @throws {TypeError} on input error.
 */
Server.prototype.use = function use() {
  var chain = utils.argsToChain(arguments);

  if (chain.length) {
    var self = this;
    chain.forEach(function(h) {
      self.chain.push(h);
    });

    this.routes.forEach(function(r) {
      r.use(chain);
    });
  }

  return this;
};



///--- Private methods

Server.prototype._addRoute = function _addRoute(method, path, handlers) {
  var self = this;

  var chain = this.chain.slice(0);
  utils.argsToChain(handlers).forEach(function(h) {
    chain.push(h);
  });

  var route = new Route({
    log4js: self.log4js,
    method: method,
    url: path,
    handlers: chain
  });
  route.on('error', function(err) {
    self.emit('error', err);
  });
  route.on('done', function(req, res) {
    self.emit('after', req, res, route.name);
  });
  this.routes.push(route);

  return route;
};


Server.prototype._request = function _request(req, res) {
  var self = this;

  var request = new Request({
    log4js: self.log4js,
    request: req
  });
  var response = new Response({
    log4js: self.log4js,
    request: request,
    response: res,
    formatters: self.formatters
  });
  this._logRequest(request);

  var route = this._findRoute(request, response);
  if (!route)
    return false;

  return route.run(request, response);
};


Server.prototype._findRoute = function _findRoute(req, res) {
  assert.ok(req);
  assert.ok(res);

  var notFound = true;
  var notMethod = true;
  var notVersion = true;
  var methods = [];
  var route;
  var params;
  var tmp;

  // O(n) sucks, but for now, meh.
  // Wow - rewrite this
  for (var i = 0; i < this.routes.length; i++) {
    tmp = this.routes[i];
    var matched = false;
    if((params = tmp.matchesUrl(req))) {
      if (~methods.indexOf(tmp.method))
        methods.push(tmp.method);

      notFound = false;
      matched = true;
    }
    if (tmp.matchesMethod(req)) {
      notMethod = false;
      matched &= true;
    }
    if (tmp.matchesVersion(req)) {
      notVersion = false;
      matched &= true;
    }
    if (matched)
      route = tmp;
  }

  // Tack on the necessary params
  req.params = params;
  res.methods = methods;
  res.version = route ? route.version : false;

  if (notFound) {
    this.emit('404', req, res);
    return false;
  } else if (notMethod) {
    this.emit('405', req, res);
    return false;
  } else if (notVersion) {
    this.emit('449', req, res);
    return false;
  }

  return route;
};


Server.prototype._logRequest = function _logRequest(req) {
  assert.ok(req);

  if (this.log.isTraceEnabled())
    this.log.trace('request received:\n\n%s', req.toString());
};
