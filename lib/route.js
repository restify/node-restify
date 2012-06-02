// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var url = require('url');
var util = require('util');

var semver = require('semver');



///--- Helpers

function addProbes(dtrace, name) {
  if (!dtrace)
    return false;

  assert.ok(name);

  // id, requestid, user, user-agent, content-type, content-length
  dtrace.addProbe(name + '-start',
                  'int', 'char *', 'char *', 'char *', 'char *', 'int');

  // id, requestid, statusCode, content-type, content-length
  dtrace.addProbe(name + '-done',
                  'int', 'char *', 'int', 'char *', 'int', 'int');

  return true;
}


function fireProbeStart(dtrace, name, req) {
  if (!dtrace)
    return false;

  assert.ok(name);
  assert.ok(req);

  dtrace.fire(name + '-start', function probeStart() {
    return [
      req.connection.fd,
      req.id,
      (req.username || null),
      (req.userAgent || null),
      req.contentType,
      (req.contentLength || 0)
    ];
  });

  return true;
}


function fireProbeDone(dtrace, name, req, res) {
  if (!dtrace)
    return false;

  assert.ok(name);
  assert.ok(req);
  assert.ok(res);

  dtrace.fire(name + '-done', function probeDone() {
    return [
      req.connection.fd,
      req.id,
      res.code,
      (res.contentType || null),
      (res.contentLength || 0)
    ];
  });

  return true;
}



///--- API

/**
 * Constructor.
 *
 * Parameters accepted on the options object:
 *  -- Required:
 *    - log (Object) a bunyan instance.
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
  if (typeof (options) !== 'object')
    throw new TypeError('options (Object) required');
  if (typeof (options.log) !== 'object')
    throw new TypeError('options.log (Object) required');
  if (options.handlers) {
    if (!Array.isArray(options.handlers))
      throw new TypeError('options.handlers must be an Array of Functions');
    options.handlers.forEach(function (h) {
      if (typeof (h) !== 'function')
        throw new TypeError('options.handlers must be an Array of Functions');
    });
  }

  EventEmitter.call(this);

  this.chain = options.handlers || [];
  this.method = options.method || 'GET';
  this.methods = [this.method];
  this.version = options.version ? options.version : false;
  if (this.version) {
    if (!Array.isArray(this.version))
      this.version = [this.version];

    this.version.forEach(function (v) {
      if (!semver.valid(v))
        throw new Error(v + ' is not a valid semantic version');
    });

    this.version.sort();
  }

  var self = this;
  this.__defineGetter__('dtrace', function () {
    return options.dtrace || false;
  });

  this.__defineGetter__('name', function () {
    if (self._name)
      return self._name;

    var name = self.method + ' ' + self.url;
    if (self.version)
      name += ' (' + self.version + ')';

    self._name = name;
    return name;
  });

  this.__defineSetter__('name', function (n) {
    self._name = n;
  });

  this.__defineGetter__('probe', function () {
    if (self._probe)
      return self._probe;

    var n = self.name;
    self._probe = n.replace(/\s+/g, '-').replace(/\W+/g, '').toLowerCase();
    return self._probe;
  });

  this.__defineGetter__('url', function () {
    return self._url.toString();
  });

  this.__defineSetter__('url', function (u) {
    if (u instanceof RegExp) {
      self._url = u;
      self.pattern = u.source;
      self.flags = '';
      if (u.global)
        self.flags += 'g';
      if (u.ignoreCase)
        self.flags += 'i';
      if (u.multiline)
        self.flags += 'm';
      return;
    }
    if (typeof (u) !== 'string')
      throw new TypeError('url must be a String');

    self._url = url.parse(u).pathname;
    self.pattern = '^';
    self.flags = options.flags || '';
    self.params = [];
    self._url.split('/').forEach(function (fragment) {
      if (!fragment.length)
        return;

      self.pattern += '\\/+';
      if (fragment.charAt(0) === ':') {
        // Previously was gratuitous, but better to just be standard
        // self.pattern += '([a-zA-Z0-9-_~%!;@=+\\$\\*\\.]+)';
        //
        // See RFC3986, or this handy table:
        // http://en.wikipedia.org/wiki/Percent-encoding#Types_of_URI_characters
        self.pattern += '([a-zA-Z0-9-_~\\.%]+)';
        self.params.push(fragment.slice(1));
      } else {
        self.pattern += fragment;
      }
    });
    if (self.pattern === '^')
      self.pattern += '\\/';
    self.pattern += '$';
  });

  this.name = options.name || false;
  this.url = options.url || options.path;
  this.log = options.log.child({route: self.name}, true);

  // Setup DTrace probes, if applicable
  addProbes(this.dtrace, this.probe);
  for (var i = 0; i < this.chain.length; i++) {
    this.chain[i]._name = this.chain[i].name || (i + 1) + '';
    addProbes(this.dtrace, this.probe + '-' + this.chain[i]._name);
  }
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
  if (!this.version || req.version === '*')
    return true;

  if (!semver.maxSatisfying(this.version, req.version))
    return false;

  return true;
};


/**
 * Whether or not the route matches the given request's url.
 *
 * @param {Object} req an http request object.
 * @return {Object} parameters of the configured route -> url.
 * @throws {TypeError} on input error.
 */
Route.prototype.matchesUrl = function matchesUrl(req) {
  var re = new RegExp(this.pattern, this.flags);
  var result = re.exec(req.path);
  if (!result)
    return false;

  var params = {};
  var i = 0;
  if (this.params && this.params.length) {
    this.params.forEach(function (p) {
      if (++i < result.length)
        params[p] = decodeURIComponent(result[i]);
    });
  } else {
    if (this._url instanceof RegExp) {
      // Don't return an array, as we want to enable all the downstream
      // plugins to append in other params
      for (i = 0; i < result.length; i++) {
        if (i === 0) // capture groups start at 1
          continue;

        params[(i - 1)] = result[i];
      }
    }
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
  var i = -1;
  //var log = this.log.child({ req_id: req.id }, true);
  var log = this.log;
  var self = this;

  function next(err) {
    // The goofy checks here are to make sure we fire the DTrace probes after
    // an error might have been sent, as in a handler return next(new Error)
    // is basically shorthand for sending an error via res.send(), so we
    // do that before firing the dtrace probe (namely so the status codes
    // get updated in the response).
    var done = false;
    if (err) {
      log.debug({err: err}, 'next(err=%s)', err.name);

      res.send(err);
      done = true;
    }

    // Callers can stop the chain from proceding if they do return next(false);
    // This is useful for non-errors, but where a response was sent and you
    // don't want the chain to keep going
    if (err === false)
      done = true;

    // Fire DTrace done for the "sub runner".
    if ((i + 1) > 0 && chain[i])
      fireProbeDone(self.dtrace, self.probe + '-' + chain[i]._name, req, res);

    if (!done && chain[++i]) {
        log.trace('running %s', chain[i].name);

      fireProbeStart(self.dtrace, self.probe + '-' + chain[i]._name, req);
      try {
        return chain[i].call(self, req, res, next);
      } catch (e) {
        log.debug({err: e}, 'uncaught exception(e=%s)', e.name);
        return self.emit('uncaughtException', req, res, self, e);
      }
    }

    // This is the route -done dtrace probe
    fireProbeDone(self.dtrace, self.probe, req, res);

    return self.emit('done', req, res);
  }

  log.trace({req: req}, 'starting request chain');

  // DTrace start for the route
  fireProbeStart(this.dtrace, this.probe, req);
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
  chain.forEach(function (h) {
    self.chain.push(h);
    h._name = h.name || self.chain.length + '';
    addProbes(self.dtrace, self.probe + '-' + h._name);
  });

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
  if (this.version)
    opts.push('version=' + this.version);
  if (opts.length)
    str += ' (' + opts.join(', ') + ')';

  return str;
};
