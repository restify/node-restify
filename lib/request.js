// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var http = require('http');
var url = require('url');
var util = require('util');

var mime = require('mime');
var qs = require('qs');
var uuid = require('node-uuid');

var sanitizePath = require('./utils').sanitizePath;


///--- Globals

var Request = http.IncomingMessage;



///--- Helpers

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


function parseContentType(req) {
  var type = req.headers['content-type'];
  // RFC2616 section 7.2.1
  if (!type)
    return 'application/octet-stream';

  var index = type.indexOf(';');
  if (index === -1)
    return type;

  return type.substring(0, index);
}


function parseKeepAlive(req) {
  if (req.headers.connection)
    return /keep-alive/i.test(req.headers.connection);

  return req.httpVersion === '1.0' ? false : true;
}

function parseContentLength(req) {
    var length = req.headers['content-length'];
    return (length === undefined) ? null : parseInt(length, 10);
}

///--- API

module.exports = {

  extendRequest: function extendRequest(req) {
    var _url = url.parse(req.url);

    req.chunked = req.headers['transfer-encoding'] === 'chunked';
    req.contentLength = parseContentLength(req); 
    req.contentType = parseContentType(req);
    req.href = _url.href;
    req.id = req.headers['x-request-id'] || uuid();
    req.keepAlive = parseKeepAlive(req);
    req.path = sanitizePath(_url.pathname);
    req.query = _url.query;
    req.secure = req.connection.encrypted ? true : false;
    req.time = new Date();
    req.trailers = req.trailers || {};
    req.version = req.headers['accept-version'] ||
      req.headers['x-api-version'] || '*';

    return req;
  },


  setRequestLogger: function setRequestLogger(req, log, name) {
    req.log = log.child({route: name, req_id: req.id}, true);
    return req;
  }


};



///--- Patches

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


Request.prototype.toString = function toString() {
  var self = this;
  var str = '';
  Object.keys(this.headers).forEach(function (k) {
    str += k + ': ' + self.headers[k] + '\n';
  });
  return this.method + ' ' + this.url + ' HTTP/' + this.httpVersion + '\n' +
    str;
};


Request.prototype.absoluteUri = function absoluteUri(relativePath) {
  var protocol = this.secure ? 'https://' : 'http://';
  var hostname = this.header('Host');
  return url.resolve(protocol + hostname + this.path + '/', relativePath);
};
