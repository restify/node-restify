// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var util = require('util');

var EventEmitter = require('eventemitter2').EventEmitter2;
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



///--- Request Extension

function Request(options) {
  if (typeof(options) !== 'object')
    throw new TypeError('options (Object) required');
  if (typeof(options.log4js) !== 'object')
    throw new TypeError('options.log4js (Object) required');
  if (typeof(options.request) !== 'object')
    throw new TypeError('options.request (http.IncomingMessage) required');

  EventEmitter.call(this, {wildcard: true});

  this.req = options.request;
  this.log4js = options.log4js;
  this.log = this.log4js.getLogger('Request');

  var id = uuid();
  var path = sanitizePath(this.req.url);
  var self = this;

  this.__defineGetter__('connection', function() {
    return self.req.connection;
  });

  this.__defineGetter__('contentType', function() {
    var type = self.req.headers['content-type'];

    // RFC2616 section 7.2.1
    if (!type)
      return 'application/octet-stream';

    var index = type.indexOf(';');
    if (index === -1)
      return type;

    return type.substring(0, index);
  });

  this.__defineGetter__('headers', function() {
    return self.req.headers;
  });

  this.__defineGetter__('httpVersion', function() {
    return self.req.httpVersion;
  });

  this.__defineGetter__('httpVersionMajor', function() {
    return self.req.httpVersionMajor;
  });

  this.__defineGetter__('httpVersionMinor', function() {
    return self.req.httpVersionMinor;
  });

  this.__defineGetter__('id', function() {
    return id;
  });

  this.__defineGetter__('method', function() {
    return self.req.method;
  });

  this.__defineGetter__('path', function() {
    return path;
  });

  this.__defineGetter__('readable', function() {
    return self.req.readable;
  });

  this.__defineGetter__('requestId', function() {
    return id;
  });

  this.__defineGetter__('secure', function(){
    return self.req.connection.encrypted;
  });

  this.__defineGetter__('trailers', function(){
    return self.req.trailers || {};
  });

  this.__defineGetter__('url', function() {
    return path;
  });


  this.req.on('close', function() {
    self.emit('close');
  });

  this.req.on('data', function(chunk) {
    self.emit('data', chunk);
  });

  this.req.on('end', function() {
    self.emit('end');
  });

  this.req.on('error', function(err) {
    self.emit('error', err);
  });
}
util.inherits(Request, EventEmitter);
module.exports = Request;


Request.prototype.accepts = function accepts(type) {
  if (typeof(type) !== 'string')
    throw new TypeError('type (String) required');

  if (!this.accept)
    return true;

  if (!~type.indexOf('/'))
    type = mime.lookup(type);

  type = type.split('/');

  var obj;
  for (var i = 0; i < this.accept.length; i++) {
    obj = this.accept[i];
    if ((type[0] === obj.type || '*' === obj.type) &&
        (type[1] === obj.subtype || '*' === obj.subtype))
      return true;
  }

  return false;
};


Request.prototype.destroy = function destroy() {
  return this.req.destroy();
};


Request.prototype.destroySoon = function destroySoon() {
  return this.req.destroySoon();
};

Request.prototype.header = function header(name, value) {
  if (typeof(name) !== 'string')
    throw new TypeError('name (String) required');

  name = name.toLowerCase();

  if (name === 'referer' || name === 'referrer')
    return this.headers.referer || value;

  return this.headers[key] || value;
};


Request.prototype.is = function is(type) {
  if (typeof(type) !== 'string')
    throw new TypeError('type (String) required');

  var contentType = this.contentType;
  if (!contentType)
    return false;

  if (!~type.indexOf('/'))
    type = mime.lookup(type);

  if (~type.indexOf('*')) {
    type = type.split('/');
    contentType = contentType.split('/');
    if (type[0] === '*' && type[1] === contentType[1])
      return true;
    if (type[1] === '*' && type[0] === contentType[0])
      return true;
  }

  return !! ~contentType.indexOf(type);
};


Request.prototype.pipe = function pipe(destination, options) {
  return this.req.pipe(destination, options);
};


Request.prototype.pause = function pause() {
  return this.req.pause();
};


Request.prototype.resume = function resume() {
  return this.req.resume();
};


Request.prototype.setEncoding = function setEncoding(encoding) {
  return this.req.setEncoding(encoding);
};


Request.prototype.toString = function toString() {
  var self = this;
  var headers = '';
  Object.keys(this.req.headers).forEach(function(k) {
    headers += k + ': ' + self.req.headers[k] + '\n';
  });
  return this.method + ' ' + this.url + ' HTTP/1.1\n' + headers;
};
