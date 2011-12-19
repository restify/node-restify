// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var http = require('http');
var https = require('https');
var url = require('url');
var util = require('util');

var EventEmitter = require('eventemitter2').EventEmitter2;

var errors = require('./errors');
var Request = require('./request');
var Response = require('./response');
var Route = require('./route');



///--- Globals

var BadRequestError = errors.BadRequestError;
var MethodNotAllowedError = errors.MethodNotAllowedError;
var NotFoundError = errors.NotFoundError;



///--- Helpers

function argsToChain() {
  assert.ok(arguments.length);

  var args = arguments[0];
  if (args.length < 0)
    throw new TypeError('handler (Function) required');

  var chain = [];

  function process(handlers) {
    handlers.forEach(function(h) {
      if (Array.isArray(h))
        return process(h);
      if (!typeof(h) === 'function')
        throw new TypeError('handlers must be Functions');

      return chain.push(h);
    });
  }
  process(Array.prototype.slice.call(args, 0));

  return chain;
}

function logRequest(req) {
  assert.ok(req);

  if (req.log.isTraceEnabled())
    req.log.trace('New Request:\n\n%s', req.toString());
}


function default404Handler(req, res) {
  res.send(new NotFoundError(req.url + ' not found'));
}


function default405Handler(req, res, methods) {
  res.header('Allow', methods.join(', '));
  if (req.method === 'OPTIONS') {
    res.send(200);
  } else {
    var msg = req.url + ' does not support ' + req.method;
    res.send(new MethodNotAllowedError(msg));
  }
}


function defaultBadVersionHandler(req, res, versions) {
  var msg = req.method + ' ' + req.url + ' supports versions: ' +
    versions.join(', ');

  res.send(new BadRequestError(msg));
}


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

  EventEmitter.call(this);

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

  this.__defineGetter__('acceptable', function() {
    var accept = Object.keys(self.formatters) || [];
    Response.ACCEPTABLE.forEach(function(a) {
      if (accept.indexOf(a) === -1)
        accept.push(a);
    });

    return accept;
  });

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


/**
 * Gets the server up and listening.
 *
 * You can call like:
 *  server.listen(80)
 *  server.listen(80, '127.0.0.1')
 *  server.listen('/tmp/server.sock')
 *
 * And pass in a callback to any of those forms.
 *
 * @param {Function} callback optionally get notified when listening.
 * @throws {TypeError} on bad input.
 */
Server.prototype.listen = function listen(port, hostname, callback) {
  if (typeof(port) === 'number') {
    switch (typeof(hostname)) {
    case 'function':
      callback = hostname;
      hostname = '0.0.0.0';
      break;
    case 'undefined':
      hostname = '0.0.0.0';
      break;
    case 'string':
      // NoOp
      break;
    default:
      throw new TypeError('hostname must be a string');
    }

    this.port = port;
    this.hostname = hostname;
    return this.server.listen(port, hostname, function() {
      return callback ? callback() : false;
    });
  } else if (typeof(port) === 'string') {
    switch (typeof(hostname)) {
    case 'function':
      callback = hostname;
      hostname = null;
      break;
    case 'undefined':
      break;
    default:
      throw new TypeError('callback must be a Function');
    }

    this.socketPath = port;
    return this.server.listen(port, function() {
      return callback ? callback() : false;
    });
  }

  throw new TypeError('port (number) required');
};


/**
 * Shuts down this server, and invokes callback (optionally) when done.
 *
 * @param {Function} callback optional callback to invoke when done.
 */
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


/**
 * Mounts a chain on the given path for 'DELETE'.
 *
 * @param {Object} options the URL to handle, at minimum.
 * @return {Route} the newly created route.
 */
Server.prototype.del = function del(options) {
  if (arguments.length < 2)
    throw new Error('At least one handler (Function) required');

  var path = options;
  var version = false;
  if (typeof(options) === 'object') {
    path = options.path;
    version = options.version;
  } else if (typeof(options) !== 'string') {
    throw new TypeError('path (String) required');
  }

  var args = Array.prototype.slice.call(arguments, 1);
  return this._addRoute('DELETE', path, version, args);
};


/**
 * Mounts a chain on the given path for 'GET'.
 *
 * @param {Object} options the URL to handle, at minimum.
 * @return {Route} the newly created route.
 */
Server.prototype.get = function get(options) {
  if (arguments.length < 2)
    throw new Error('At least one handler (Function) required');

  var path = options;
  var version = false;
  if (typeof(options) === 'object') {
    path = options.path;
    version = options.version;
  } else if (typeof(options) !== 'string') {
    throw new TypeError('path (String) required');
  }

  var args = Array.prototype.slice.call(arguments, 1);
  return this._addRoute('GET', path, version, args);
};


/**
 * Mounts a chain on the given path for 'HEAD'.
 *
 * @param {Object} options the URL to handle, at minimum.
 * @return {Route} the newly created route.
 */
Server.prototype.head = function head(options) {
  if (arguments.length < 2)
    throw new Error('At least one handler (Function) required');

  var path = options;
  var version = false;
  if (typeof(options) === 'object') {
    path = options.path;
    version = options.version;
  } else if (typeof(options) !== 'string') {
    throw new TypeError('path (String) required');
  }

  var args = Array.prototype.slice.call(arguments, 1);
  return this._addRoute('HEAD', path, version, args);
};


/**
 * Mounts a chain on the given path for 'POST'.
 *
 * @param {Object} options the URL to handle, at minimum.
 * @return {Route} the newly created route.
 */
Server.prototype.post = function post(options) {
  if (arguments.length < 2)
    throw new Error('At least one handler (Function) required');

  var path = options;
  var version = false;
  if (typeof(options) === 'object') {
    path = options.path;
    version = options.version;
  } else if (typeof(options) !== 'string') {
    throw new TypeError('path (String) required');
  }

  var args = Array.prototype.slice.call(arguments, 1);
  return this._addRoute('POST', path, version, args);
};


/**
 * Mounts a chain on the given path for 'PUT'.
 *
 * @param {Object} options the URL to handle, at minimum.
 * @return {Route} the newly created route.
 */
Server.prototype.put = function put(options) {
  if (arguments.length < 2)
    throw new Error('At least one handler (Function) required');

  var path = options;
  var version = false;
  if (typeof(options) === 'object') {
    path = options.path;
    version = options.version;
  } else if (typeof(options) !== 'string') {
    throw new TypeError('path (String) required');
  }

  var args = Array.prototype.slice.call(arguments, 1);
  return this._addRoute('PUT', path, version, args);
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
  var chain = argsToChain(arguments);

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

Server.prototype._addRoute = function _addRoute(method,
                                                path,
                                                version,
                                                handlers) {
  var self = this;

  var chain = this.chain.slice(0);
  argsToChain(handlers).forEach(function(h) {
    chain.push(h);
  });

  var route = new Route({
    log4js: self.log4js,
    method: method,
    url: path,
    handlers: chain,
    version: version
  });
  route.on('error', function(err) {
    self.emit('error', err);
  });
  route.on('done', function(req, res) {
    self.emit('after', req, res, route.name);
  });

  this.routes.forEach(function(r) {
    if (r.matchesUrl({ url: path })) {
      if (r.methods.indexOf(method) === -1)
        r.methods.push(method);
    }
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

  logRequest(request);

  var route = this._findRoute(request, response);
  if (!route)
    return false;

  return route.run(request, response);
};


Server.prototype._findRoute = function _findRoute(req, res) {
  assert.ok(req);
  assert.ok(res);

  var params;
  var route;
  var methods = [];
  var versions = [];

  for (var i = 0; i < this.routes.length; i++) {
    var r = this.routes[i];

    if ((params = r.matchesUrl(req))) {
      if (r.matchesMethod(req)) {
        if (r.matchesVersion(req)) {
          route = r;
          break;
        } else {
          if (r.version && !~versions.indexOf(r.version))
            versions.push(r.version);
        }
      } else {
        if (!~methods.indexOf(r.method))
          methods.push(r.method);
      }
    }
  }

  if (route) {
    req.params = params || {};
    res.methods = route.methods;
    res.version = route.version;
  } else {
    res.methods = methods;
    res.versions = versions;

    if (versions.length) {
      if (!this.listeners('VersionNotAllowed').length)
        this.once('VersionNotAllowed', defaultBadVersionHandler);

      this.emit('VersionNotAllowed', req, res, versions);
    } else if (methods.length) {
      if (!this.listeners('MethodNotAllowed').length)
        this.once('MethodNotAllowed', default405Handler);

      this.emit('MethodNotAllowed', req, res, methods);
    } else {
      if (!this.listeners('NotFound').length)
        this.once('NotFound', default404Handler);

      this.emit('NotFound', req, res);
    }
  }

  return route || false;
};



