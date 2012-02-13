// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var Stream = require('stream').Stream;
var url = require('url');
var util = require('util');

var mime = require('mime');
var uuid = require('node-uuid');



///--- Helpers

/**
 * Cleans up sloppy URL paths, like /foo////bar/// to /foo/bar.
 *
 * @param {String} path the HTTP resource path.
 * @return {String} Cleaned up form of path.
 */
function sanitizePath(path) {
  assert.ok(path);

  // Be nice like apache and strip out any //my//foo//bar///blah
  path = path.replace(/\/\/+/g, '/');

  // Kill a trailing '/'
  if (path.lastIndexOf('/') === (path.length - 1) && path.length > 1)
    path = path.substr(0, path.length - 1);

  return path;
}


// The following three functions are courtesy of expressjs
// as is req.accepts(), and req.is() below.
//
// https://github.com/visionmedia/express
//

// Helpers for 'Accept'
// http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.1

function quality(str) {
  var parts = str.split(/ *; */);
  var val = parts[0];
  var q = parts[1] ? parseFloat(parts[1].split(/ *= */)[1]) : 1;

  return { value: val, quality: q };
}


function parseQuality(str) {
  /* JSSTYLED */
  return str.split(/ *, */).map(quality).filter(function (obj) {
    return obj.quality;
  }).sort(function (a, b) {
    return b.quality - a.quality;
  });
}


function parseAccept(str) {
  return parseQuality(str).map(function (obj) {
    var parts = obj.value.split('/');
    obj.type = parts[0];
    obj.subtype = parts[1];
    return obj;
  });
}



///--- API

/**
 * Request is a wrapper over node's http.IncomingMessage object.
 *
 * Previous versions of restify just extended the prototype, but that was
 * problemtic if used in conjunction with other modules that do this as well
 * (namely express).
 *
 * This object exposes all of the properties/events/methods of the standard
 * Request object, plus some extra goodies.
 *
 * @param {Object} options pass in bunyan instance and an http.IncomingMessage.
 * @throws {TypeError} on input error.
 */
function Request(options) {
  if (typeof (options) !== 'object')
    throw new TypeError('options (Object) required');
  if (typeof (options.log) !== 'object')
    throw new TypeError('options.log (Object) required');
  if (typeof (options.request) !== 'object')
    throw new TypeError('options.request (http.IncomingMessage) required');

  Stream.call(this);

  var id = uuid();

  this.req = options.request;
  this.log = options.log;

  var _url = url.parse(this.req.url, true);
  var path = sanitizePath(_url.pathname);
  var self = this;

  this.__defineGetter__('connection', function () {
    return self.req.connection;
  });

  this.__defineGetter__('contentLength', function () {
    return self.req.headers['content-length'];
  });

  this.__defineGetter__('contentType', function () {
    var type = self.req.headers['content-type'];

    // RFC2616 section 7.2.1
    if (!type)
      return 'application/octet-stream';

    var index = type.indexOf(';');
    if (index === -1)
      return type;

    return type.substring(0, index);
  });

  this.__defineGetter__('headers', function () {
    return self.req.headers;
  });

  this.__defineGetter__('httpVersion', function () {
    return self.req.httpVersion;
  });

  this.__defineGetter__('httpVersionMajor', function () {
    return self.req.httpVersionMajor;
  });

  this.__defineGetter__('httpVersionMinor', function () {
    return self.req.httpVersionMinor;
  });


  this.__defineGetter__('href', function () {
    return _url.href;
  });

  this.__defineGetter__('id', function () {
    return id;
  });

  this.__defineGetter__('method', function () {
    return self.req.method;
  });

  this.__defineGetter__('path', function () {
    return path;
  });

  this.__defineGetter__('pathname', function () {
    return path;
  });

  this.__defineGetter__('query', function () {
    return _url.query;
  });

  this.__defineGetter__('readable', function () {
    return self.req.readable;
  });

  this.__defineGetter__('requestId', function () {
    return id;
  });

  this.__defineGetter__('search', function () {
    return _url.search;
  });

  this.__defineGetter__('secure', function () {
    return self.req.connection.encrypted || false;
  });

  var now = new Date();
  this.__defineGetter__('time', function () {
    return now;
  });

  this.__defineGetter__('trailers', function () {
    return self.req.trailers || {};
  });

  this.__defineGetter__('url', function () {
    return self.req.url;
  });

  this.__defineSetter__('url', function (u) {
    _url = url.parse(u);
    path = sanitizePath(_url.pathname);
    self.req.url = u;
  });

  this.__defineGetter__('userAgent', function () {
    return self.req.headers['user-agent'];
  });

  this.__defineGetter__('version', function () {
    var headers = self.req.headers;
    return headers['accept-version'] || headers['x-api-version'] || '*';
  });

  this.req.on('aborted', function () {
    self.emit('aborted');
  });

  this.req.on('data', function (chunk) {
    self.emit('data', chunk);
  });

  this.req.on('end', function () {
    self.emit('end');
  });

  this.req.on('error', function (err) {
    self.emit('error', err);
  });

  this.req.on('close', function () {
    self.emit('close');
  });
}
util.inherits(Request, Stream);
module.exports = Request;


Request.prototype.destroy = function destroy() {
  return this.req.destroy.apply(this.req, arguments);
};


Request.prototype.destroySoon = function destroySoon() {
  return this.req.destroySoon.apply(this.req, arguments);
};


Request.prototype.pipe = function pipe() {
  return this.req.pipe.apply(this.req, arguments);
};


Request.prototype.pause = function pause() {
  return this.req.pause.apply(this.req, arguments);
};


Request.prototype.resume = function resume() {
  return this.req.resume.apply(this.req, arguments);
};


Request.prototype.setEncoding = function setEncoding() {
  return this.req.setEncoding.apply(this.req, arguments);
};


Request.prototype.accepts = function accepts(type) {
  if (typeof (type) !== 'string')
    throw new TypeError('type (String) required');

  if (!this.accept) {
    if (!this.headers.accept)
      this.headers.accept = '*/*';

    this.accept = parseAccept(this.headers.accept);
    assert.ok(this.accept);
  }

  if (type.indexOf('/') === -1)
    type = mime.lookup(type);

  type = type.split('/');

  for (var i = 0; i < this.accept.length; i++) {
    var obj = this.accept[i];
    if ((obj.type === type[0] || obj.type === '*') &&
        (obj.subtype === type[1] || obj.subtype === '*'))
      return true;
  }

  return false;
};


Request.prototype.header = function header(name, value) {
  if (typeof (name) !== 'string')
    throw new TypeError('name (String) required');

  name = name.toLowerCase();

  if (name === 'referer' || name === 'referrer')
    return this.headers.referer || value;

  return this.headers[name] || value;
};


Request.prototype.is = function is(type) {
  if (typeof (type) !== 'string')
    throw new TypeError('type (String) required');

  var contentType = this.contentType;
  if (!contentType)
    return false;

  if (type.indexOf('/') === -1)
    type = mime.lookup(type);

  if (type.indexOf('*') >= 0) {
    type = type.split('/');
    contentType = contentType.split('/');
    if (type[0] === '*' && type[1] === contentType[1])
      return true;
    if (type[1] === '*' && type[0] === contentType[0])
      return true;
  }
  return contentType === type;
};


Request.prototype.getLogger = function getLogger(component) {
  if (typeof (component) !== 'string')
    throw new TypeError('component (String) required');

  return this.log.child({component: component}, true);
};


// Called by route only to force request to get a child logger
// with route name and requestid set
Request.prototype._setLogger = function _setLogger(log, name) {
  assert.ok(log);
  assert.ok(log);

  var self = this;
  this.log = log.child({route: name, req_id: self.id}, true);
  return this.log;
};

Request.prototype.toString = function toString() {
  var self = this;
  var headers = '';
  Object.keys(this.req.headers).forEach(function (k) {
    headers += k + ': ' + self.req.headers[k] + '\n';
  });
  return this.method + ' ' + this.url + ' HTTP/' + this.httpVersion + '\n' +
    headers;
};
