// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var url = require('url');
var util = require('util');

var EventEmitter = require('eventemitter2').EventEmitter2;
var semver = require('semver');

var HttpError = require('./errors/http_error').HttpError;
var utils = require('./utils');


///--- API

/**
 * Constructor.
 *
 * Parameters accepted on the options object:
 *  -- Required:
 *    - log4js (Object) a log4js handle.
 *    - url (String|RegExp) the url to match against with ':' params.
 *  -- Optional:
 *    - version (String) defaults to null.
 *    - method (String) defaults to GET.
 *    - name (String) defaults to :method_:url.
 *    - handlers ([Function]) an array of f(req, res, next).
 *
 * @param {Object} options parameterization object.
 * @throws {TypeError} on input error
 */
function Route(options) {
  if (typeof(options) !== 'object')
    throw new TypeError('options (Object) required');
  if (typeof(options.log4js) !== 'object')
    throw new TypeError('options.log4js (Object) required');
  if (!(options.url instanceof RegExp) && typeof(options.url) !== 'string')
    throw new TypeError('options.url (String) required');
  if (options.version && typeof(options.version) !== 'string')
    throw new TypeError('options.version must be a String');
  if (options.handlers) {
    if (!Array.isArray(options.handlers))
      throw new TypeError('options.handlers must be an Array of Functions');
    options.handlers.forEach(function(h) {
      if (typeof(h) !== 'function')
        throw new TypeError('options.handlers must be an Array of Functions');
    });
  }

  EventEmitter.call(this);

  this.chain = options.handlers || [];
  this.log4js = options.log4js;
  this.log = this.log4js.getLogger('Route');
  this.method = options.method || 'GET';
  this.methods = [this.method];
  this.version = semver.valid(options.version) ? options.version : false;

  var self = this;
  this.__defineGetter__('url', function() {
    return self._url.toString();
  });
  this.__defineSetter__('url', function(u) {
    if (u instanceof RegExp) {
      self._url = u;
      self.pattern = u.source;
      return;
    }
    if (typeof(u) !== 'string')
      throw new TypeError('url must be a String');

    self._url = url.parse(u).pathname;
    self.pattern = '^';
    self.params = [];
    self._url.split('/').forEach(function(fragment) {
      if (!fragment.length)
        return;

      self.pattern += '\\/';
      if (fragment.charAt(0) === ':') {
        self.pattern += '(\\w+)';
        self.params.push(fragment.slice(1));
      } else {
        self.pattern += fragment;
      }
    });
    self.pattern += '$';
  });

  this.__defineGetter__('name', function() {
    if (self._name)
      return self._name;

    var name = self.method + ' ' + self.url;
    if (self.version)
      name += ' (' + self.version + ')';

    return name;
  });
  this.__defineSetter__('name', function(n) {
    self._name = n;
  });

  this.name = options.name || false;
  this.url = options.url;
}
util.inherits(Route, EventEmitter);
module.exports = Route;


/**
 * Checks if the given HTTP request object matches this route.
 *
 * Checks against method, URL and optionally version. If there is a match, an
 * object is returned with a set of key/value pairs that match the route's URL.
 *
 * For example, a route of /foo/:pet against a requested URL of /foo/dog would
 * return { pet: 'dog' }.  If the original URL in the route was a regex, you'll
 * just get back an array of regex matched params.
 *
 * @param {Object} req a node HTTP request object.
 * @return {Object} parameters parsed from the URL.
 * @throws {TypeError} on input error
 */
Route.prototype.matches = function matches(req) {
  if (!this.matchesMethod(req))
    return false;
  if (!this.matchesVersion(req))
    return false;

  return this.matchesUrl(req);
};


/**
 * Whether or not the route matches the given request's method.
 *
 * @param {Object} req an http request object.
 * @return {Boolean} if matches method.
 * @throws {TypeError} on input error.
 */
Route.prototype.matchesMethod = function matchesMethod(req) {
  if (typeof(req) !== 'object')
    throw new TypeError('request (Object) required');

  return req.method === this.method;
};


/**
 * Whether or not the route matches the given request's version (if this route
 * has versioning on).
 *
 * @param {Object} req an http request object.
 * @return {Boolean} if matches method.
 * @throws {TypeError} on input error.
 */
Route.prototype.matchesVersion = function matchesVersion(req) {
  if (typeof(req) !== 'object')
    throw new TypeError('request (Object) required');

  if (!this.version || req.version === '*')
    return true;

  return semver.satisfies(this.version, req.version);
};


/**
 * Whether or not the route matches the given request's url.
 *
 * @param {Object} req an http request object.
 * @return {Object} parameters of the configured route -> url.
 * @throws {TypeError} on input error.
 */
Route.prototype.matchesUrl = function matchesURL(req) {
  if (typeof(req) !== 'object')
    throw new TypeError('request (Object) required');

  var re = new RegExp(this.pattern);
  var result = re.exec(req.url);
  if (!result)
    return false;

  var params = {};
  var i = 0;
  if (this.params && this.params.length) {
    this.params.forEach(function(p) {
      if (++i < result.length)
        params[p] = result[i];
    });
  } else {
    if (this._url instanceof RegExp)
      params = ((result.length > 1) ? result.slice(1) : []);
  }

  return params;
};


/**
 * Runs the set of handlers registered to this route in order, and emits
 * a 'done(req, res)' when the route is finished (or request ended).
 *
 * @param {Object} req http.Request.
 * @param {Object} res http.Response.
 */
Route.prototype.run = function run(req, res) {
  assert.ok(req);
  assert.ok(res);

  var chain = this.chain;
  var i = 0;
  var log = this.log;
  var self = this;

  function next(err) {
    if (err) {
      if (log.isTraceEnabled())
        log.trace('%s next(err), sending error: %s', req.requestId, err.stack);

      res.send(err);
    } else {
      if (chain[i]) {
        if (log.isTraceEnabled()) {
          log.trace('%s running %s', req.requestId,
                    (chain[i].name ? chain[i].name : (i + '')));
        }

        return chain[i++].call(self, req, res, next);
      }
    }

    return self.emit('done', req, res);
  }

  if (log.isTraceEnabled())
    log.trace('%s handling %s %s', req.requestId, req.method, req.url);
  return next();
};


/**
 * Installs a list of handlers to run _before_ the "normal" handlers.
 *
 * @param {Array} chain an array of Function(req, res, next);
 * @throws {TypeError} on input error.
 */
Route.prototype.use = function use(chain) {
  if (!Array.isArray(chain))
    throw new TypeError('chain ([Function]) required');

  var self = this;

  if (chain.length) {
    chain.forEach(function(h) {
      self.chain.push(h);
    });
  }

  return this;
};


/**
 * Returns a string representation of this route for debugging.
 *
 * Returned string is :name: :method :url (version=:version)
 * Note name and version may not be present if they were not specified at
 * construction time.
 *
 * @return {String} in the form indicated above.
 */
Route.prototype.toString = function toString() {
  assert.ok(this.method);
  assert.ok(this.url);

  var str = this.method + ' ' + this.url;
  var opts = [];
  if (this._name)
    opts.push('name=' + this._name);
  if (this.version)
    opts.push('version=' + this.version);
  if (opts.length)
    str += ' (' + opts.join(', ') + ')';

  return str;
};

