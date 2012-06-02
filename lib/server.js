// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var http = require('http');
var https = require('https');
var url = require('url');
var util = require('util');

var async = require('async');
var mime = require('mime');

var errors = require('./errors');
var extendRequest = require('./request').extendRequest;
var setRequestLogger = require('./request').setRequestLogger;
var extendResponse = require('./response').extendResponse;
var Route = require('./route');



///--- Globals

var BadMethodError = errors.BadMethodError;
var InvalidVersionError = errors.InvalidVersionError;
var ResourceNotFoundError = errors.ResourceNotFoundError;



///--- Helpers

function argsToChain() {
  assert.ok(arguments.length);

  var args = arguments[0];
  if (args.length < 0)
    throw new TypeError('handler (Function) required');

  var chain = [];

  function process(handlers) {
    handlers.forEach(function (h) {
      if (Array.isArray(h))
        return process(h);
      if (!typeof (h) === 'function')
        throw new TypeError('handlers must be Functions');

      return chain.push(h);
    });
  }
  process(Array.prototype.slice.call(args, 0));

  return chain;
}


function default404Handler(req, res, server) {
  res.send(new ResourceNotFoundError(req.url + ' not found'));
  server.emit('after', req, res, null);
}


function default405Handler(req, res, methods, server) {
  res.header('Allow', methods.join(', '));
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', methods.join(', '));
    res.send(200);
  } else {
    var msg = req.url + ' does not support ' + req.method;
    res.send(new BadMethodError(msg));
  }

  server.emit('after', req, res, null);
}


function defaultBadVersionHandler(req, res, versions, server) {
  var msg = req.method + ' ' + req.url + ' supports versions: ' +
    versions.join(', ');

  res.send(new InvalidVersionError(msg));
  server.emit('after', req, res, null);
}


function toPort(x) {
  x = parseInt(x, 10);
  return (x  >= 0 ? x : false);
}


function isPipeName(s) {
  return (typeof (s) === 'string' && toPort(s) === false);
}



///--- API

/**
 * Constructor. Creates a REST API Server.
 *
 * - options {Object} construction arguments. (bunyan instance required).
 */
function Server(options) {
  if (typeof (options) !== 'object')
    throw new TypeError('options (Object) required');
  if (typeof (options.dtrace) !== 'object')
    throw new TypeError('options.dtrace (Object) required');
  if (typeof (options.log) !== 'object')
    throw new TypeError('options.log (Object) required');

  EventEmitter.call(this);

  this.chain = [];
  this.formatters = {};
  this.log = options.log;
  this.name = options.name || 'restify';
  this.preChain = [];
  this.routes = [];
  this.version = options.version || false;
  this.responseTimeHeader = options.responseTimeHeader || 'X-Response-Time';
  this.responseTimeFormatter = options.responseTimeFormatter;

  var secure = false;
  var self = this;

  if (options.formatters) {
    Object.keys(options.formatters).forEach(function (k) {
      if (k.indexOf('/') === -1)
        k = mime.lookup(k);

      self.formatters[k] = options.formatters[k];
    });
  }

  if (options.certificate && options.key) {
    secure = true;
    var httpsOptions = { cert: options.certificate, key: options.key };
    if (options.ca)
      httpsOptions.ca = options.ca;

    this.server = https.createServer(httpsOptions);
  } else {
    this.server = http.createServer();
  }

  this.server.on('error', function (err) {
    self.log.trace({err: err}, 'error');
    self.emit('error', err);
  });

  this.server.on('clientError', function (err) {
    self.log.trace({err: err}, 'clentError');
    self.emit('clientError', err);
  });

  this.server.on('close', function () {
    if (self.listeners('close').length > 0)
      self.emit('close');
  });

  this.server.on('connection', function (socket) {
    if (self.listeners('connection').length > 0)
      self.emit('connection', socket);
  });

  this.server.on('listening', function () {
    if (self.listeners('listening').length > 0)
      self.emit('listening');
  });

  this.server.on('upgrade', function (request, socket, headPacket) {
    if (self.listeners('upgrade').length > 0)
      self.emit('upgrade', request, socket, headPacket);
  });

  this.server.on('request', function onRequest(req, res) {
    return self._request(req, res);
  });


  this.server.on('checkContinue', function (req, res) {
    if (self.listeners('checkContinue').length > 0)
      return self.emit('checkContinue', req, res);

    return self._request(req, res, true);
  });

  this.__defineGetter__('acceptable', function () {
    var accept = Object.keys(self.formatters) || [];
    require('./response').ACCEPTABLE.forEach(function (a) {
      if (accept.indexOf(a) === -1)
        accept.push(a);
    });

    return accept;
  });

  this.__defineGetter__('name', function () {
    return options.name || 'restify';
  });

  this.__defineGetter__('dtrace', function () {
    return options.dtrace;
  });

  this.__defineGetter__('url', function () {
    if (self.socketPath)
      return 'http://' + self.socketPath;

    var str = secure ? 'https://' : 'http://';
    str += self.address().address;
    str += ':';
    str += self.address().port;
    return str;
  });

  this.__defineGetter__('responseTimeHeader', function () {
    return options.responseTimeHeader || 'X-Response-Time';
  });

}
util.inherits(Server, EventEmitter);
module.exports = Server;


Server.prototype.address = function address() {
  return this.server.address();
};

/**
 * Gets the server up and listening.
 *
 * You can call like:
 *  server.listen(80)
 *  server.listen(80, '127.0.0.1')
 *  server.listen('/tmp/server.sock')
 *
 * And pass in a callback to any of those forms.  Also, by default, invoking
 * this method will trigger DTrace probes to be enabled; to not do that, pass
 * in 'false' as the second to last parameter.
 *
 * @param {Function} callback optionally get notified when listening.
 * @throws {TypeError} on bad input.
 */
Server.prototype.listen = function listen() {
  var callback = false;
  var dtrace = true;
  var self = this;

  function listenCallback() {
    if (dtrace)
      self.dtrace.enable();

    return callback ? callback.call(self) : false;
  }

  if (!arguments.length)
    return this.server.listen(listenCallback);

  callback = arguments[arguments.length - 1];
  if (typeof (callback) !== 'function')
    callback = false;

  if (arguments.length >= 2 && arguments[arguments.length - 2] === false)
    dtrace = false;

  if (!isNaN(arguments[0]))
    arguments[0] = Number(arguments[0]);

  switch (typeof (arguments[0])) {
  case 'function':
    return this.server.listen(listenCallback);

  case 'string':
    if (isPipeName(arguments[0]))
      return this.server.listen(arguments[0], listenCallback);

    throw new TypeError(arguments[0] + ' is not a named pipe');

  case 'number':
    var host = arguments[1];
    return this.server.listen(arguments[0],
                              typeof (host) === 'string' ? host : '0.0.0.0',
                              listenCallback);

  default:
    throw new TypeError('port (Number) required');
  }

};


/**
 * Shuts down this server, and invokes callback (optionally) when done.
 *
 * @param {Function} callback optional callback to invoke when done.
 */
Server.prototype.close = function close(callback) {
  if (callback) {
    if (typeof (callback) !== 'function')
      throw new TypeError('callback must be a function');

    this.server.once('close', function () {
      return callback();
    });
  }

  return this.server.close();
};


// Register all the routing methods
['del', 'get', 'head', 'post', 'put', 'patch'].forEach(function (method) {

  /**
   * Mounts a chain on the given path against this HTTP verb
   *
   * @param {Object} options the URL to handle, at minimum.
   * @return {Route} the newly created route.
   */
  Server.prototype[method] = function (options) {
    if (arguments.length < 2)
      throw new Error('At least one handler (Function) required');

    if (typeof (options) !== 'object' && typeof (options) !== 'string')
      throw new TypeError('path (String) required');

    var args = Array.prototype.slice.call(arguments, 1);

    if (method === 'del')
      method = 'DELETE';

    return this._addRoute(method.toUpperCase(), options, args);
  };
});


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
  if (typeof (name) !== 'string' && !(name instanceof Route))
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
    chain.forEach(function (h) {
      self.chain.push(h);
    });

    this.routes.forEach(function (r) {
      r.use(chain);
    });
  }

  return this;
};


/**
 * Gives you hooks to run _before_ any routes are located.  This gives you
 * a chance to intercept the request and change headers, etc., that routing
 * depends on.  Note that req.params will _not_ be set yet.
 */
Server.prototype.pre = function pre() {
  var self = this;

  return argsToChain(arguments).forEach(function (h) {
    self.preChain.push(h);
  });
};



///--- Private methods

Server.prototype._addRoute = function _addRoute(method, options, handlers) {
  var self = this;

  var chain = this.chain.slice(0);
  argsToChain(handlers).forEach(function (h) {
    chain.push(h);
  });

  if (typeof (options) !== 'object' || options instanceof RegExp)
    options = { url: options };

  var route = new Route({
    log: self.log,
    method: method,
    url: options.path || options.url,
    flags: options.flags,
    handlers: chain,
    name: options.name,
    version: options.version || self.version,
    dtrace: self.dtrace
  });
  route.on('error', function (err) {
    self.emit('error', err);
  });
  route.on('done', function (req, res) {
    self.emit('after', req, res, route);
  });
  route.on('uncaughtException', function (req, res, route, err) {
    if (self.listeners('uncaughtException').length) {
      self.emit('uncaughtException', req, res, route, err);
    } else {
      self.log.warn({
        err: err,
        route_name: route.name
      }, 'uncaughtException (not handled)');
      res.send(err);
    }
  });

  this.routes.forEach(function (r) {
    if (r.matchesUrl({ url: options.url })) {
      if (r.methods.indexOf(method) === -1)
        r.methods.push(method);
    }
  });

  this.routes.push(route);
  return route;
};


Server.prototype._request = function _request(request, response, expect100) {
  var self = this;

  var req = extendRequest(request);
  var res = extendResponse({
    formatters: self.formatters,
    log: self.log,
    request: req,
    response: response,
    responseTimeHeader: self.responseTimeHeader,
    responseTimeFormatter: self.responseTimeFormatter,
    serverName: self.name
  });

  if (this.log.trace())
    this.log.trace('New Request:\n\n%s', req.toString());

  function run(err) {
    if (err)
      return res.send(err);

    var route = self._findRoute(req, res);
    if (!route)
      return false;

    setRequestLogger(req, self.log, route.name);
    res.log = req.log;

    if (expect100) {
      if (self.listeners('expectContinue').length)
        return self.emit('expectContinue', req, res, route);

      res.writeContinue();
    }

    return route.run(req, res);
  }

  if (this.preChain.length > 0) {
    var before = [];
    this.preChain.forEach(function (h) {
      before.push(function (callback) {
        return h(req, res, callback);
      });
    });
    return async.series(before, run);
  }

  return run();
};


Server.prototype._findRoute = function _findRoute(req, res) {
  var params;
  var route;
  var methods = [];
  var versions = [];

  try {
    for (var i = 0; i < this.routes.length; i++) {
      var r = this.routes[i];

      if ((params = r.matchesUrl(req))) {
        if (r.matchesMethod(req)) {
          if (r.matchesVersion(req)) {
            route = r;
            break;
          } else {
            if (r.version && versions.indexOf(r.version) === -1)
              versions.push(r.version);
          }
        } else {
          if (methods.indexOf(r.method) === -1)
            methods.push(r.method);
        }
      }
    }
  } catch (e) {
    // It's possible this is really a 500, but for most purposes, the things
    // that will throw from the code above are decodeURIComponent
    res.send(new errors.BadRequestError(e.message));
    return false;
  }

  if (route) {
    req.params = params || {};
    res.methods = route.methods;
    res.version = route.version[route.version.length - 1];
  } else {
    res.methods = methods;
    res.versions = versions;

    if (versions.length > 0) {
      if (this.listeners('VersionNotAllowed').length === 0)
        this.once('VersionNotAllowed', defaultBadVersionHandler);

      this.emit('VersionNotAllowed', req, res, versions, this);
    } else if (methods.length > 0) {
      if (this.listeners('MethodNotAllowed').length === 0)
        this.once('MethodNotAllowed', default405Handler);

      this.emit('MethodNotAllowed', req, res, methods, this);
    } else {
      if (this.listeners('NotFound').length === 0)
        this.once('NotFound', default404Handler);

      this.emit('NotFound', req, res, this);
    }
  }

  return route || false;
};


/**
 * Minimal port of the functionality offered by Express.js Route Param
 * Pre-conditions
 * @link http://expressjs.com/guide.html#route-param%20pre-conditions
 *
 * This basically piggy-backs on the `server.use` method. It attaches a
 * new middleware function that only fires if the specified parameter exists
 * in req.params
 *
 * Exposes an API:
 *   server.param("user", function (req, res, next) {
 *     // load the user's information here, always making sure to call next()
 *   });
 *
 * @param {String} The name of the URL param to respond to
 * @param {Function} The middleware function to execute
 */
Server.prototype.param = function param(name, fn) {
  return this.use(function (req, res, next) {
    if (req.params && req.params[name])
      return fn.apply(this, arguments);

    return next();
  });
};
