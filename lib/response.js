// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var crypto = require('crypto');
var http = require('http');
var Stream = require('stream').Stream;
var util = require('util');

var mime = require('mime');

var errors = require('./errors');
var Request = require('./request');



///--- Globals

var HttpError = errors.HttpError;
var RestError = errors.RestError;

var ALLOW_HEADERS = [
  'Accept',
  'Accept-Version',
  'Content-Length',
  'Content-MD5',
  'Content-Type',
  'Date',
  'X-Api-Version'
].join(', ');

var EXPOSE_HEADERS = [
  'X-Api-Version',
  'X-Request-Id',
  'X-Response-Time'
].join(', ');

var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

var MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
];



///--- Helpers

function httpDate(now) {
  if (!now)
    now = new Date();

  function pad(val) {
    if (parseInt(val, 10) < 10)
      val = '0' + val;
    return val;
  }

  return DAYS[now.getUTCDay()] + ', ' +
    pad(now.getUTCDate()) + ' ' +
    MONTHS[now.getUTCMonth()] + ' ' +
    now.getUTCFullYear() + ' ' +
    pad(now.getUTCHours()) + ':' +
    pad(now.getUTCMinutes()) + ':' +
    pad(now.getUTCSeconds()) + ' GMT';
}


function formatBinary(req, res, body) {
  if (!body)
    return null;

  if (!Buffer.isBuffer(body))
    body = new Buffer(body.toString());

  return body;
}


function formatText(req, res, body) {
  if (!body)
    return null;

  if (body instanceof Error) {
    body = body.message;
  } else if (typeof (body) === 'object') {
    body = JSON.stringify(body);
  } else {
    body = body.toString();
  }

  return body;
}


function formatJSON(req, res, body) {
  if (!body)
    return null;

  if (body instanceof Error) {
    if (body instanceof RestError) {
      body = body.body;
    } else {
      body = {
        message: body.message
      };
    }
  }

  if (Buffer.isBuffer(body))
    body = body.toString('base64');

  return JSON.stringify(body);
}


function ensureDefaultFormatters(res) {
  if (!res.formatters)
    res.formatters = {};

  //
  // We do this so that JSON formatters et al happen before custom ones,
  // like HTML (i.e., if your client is curl, accept defaults to * / *, and
  // v8 object keys are predictable, so we order them on the object such that
  // JSON goes first
  //

  var save = res.formatters || {};
  res.formatters = {};
  if (!save['application/json'])
    res.formatters['application/json'] = formatJSON;

  if (!save['text/plain'])
    res.formatters['text/plain'] = formatText;

  if (!save['application/octet-stream'])
    res.formatters['application/octet-stream'] = formatBinary;

  Object.keys(save).forEach(function (k) {
    if (!res.formatters[k])
      res.formatters[k] = save[k];
  });

  return this;
}



///--- API

/**
 * Response is a wrapper over node's http.OutgoingMessage object.
 *
 * Previous versions of restify just extended the prototype, but that was
 * problemtic if used in conjunction with other modules that do this as well
 * (namely express).
 *
 * This object exposes all of the properties/events/methods of the standard
 * Response object, plus some extra goodies.
 *
 * Note that at construct time, you pass in a map of mime type to formatter
 * functions. i.e:
 *
 * var res = new Response({
 *   formatters: {
 *     json: function (req, res, data, callback) {
 *       return callback(null, JSON.stringify(data));
 *     }
 *   }
 * });
 *
 * Note there is a special formatter called `error` which is invoked when
 * data is an error.
 *
 * @param {Object} options pass in bunyan handle, http.OutgoingMessage and a
 *                 Request.
 * @throws {TypeError} on input error.
 */
function Response(options) {
  if (typeof (options) !== 'object')
    throw new TypeError('options (Object) required');
  if (typeof (options.log) !== 'object')
    throw new TypeError('options.log (Object) required');
  if (typeof (options.response) !== 'object')
    throw new TypeError('options.response (http.OutgoingMessage) required');
  if (!(options.request instanceof Request))
    throw new TypeError('options.request (Request) required');
  if (options.version && typeof (options.version) !== 'string')
    throw new TypeError('options.version (String) required');

  var self = this;

  Stream.call(this);

  this.charSet = false;
  this._contentType = false;
  this._continueSent = false;
  this.formatters = {};
  this.log = options.request.log;
  this.methods = options.methods || [];
  this.req = options.request;
  this.res = options.response;
  this.serverName = options.serverName || 'restify';
  this.version = options.version || false;

  // Generate the formatters
  if (options.formatters) {
    Object.keys(options.formatters).forEach(function (k) {
      if (k.indexOf('/') === -1)
        k = mime.lookup(k);

      self.formatters[k] = options.formatters[k];
    });
  }
  ensureDefaultFormatters(this);

  this.__defineSetter__('code', function (c) {
    if (typeof (c) !== 'number')
      throw new TypeError('code (Number) required');
    if (c < 100 || c > 599)
      throw new TypeError('code is not a valid HTTP status code');

    self.res.statusCode = c;
  });

  this.__defineGetter__('code', function () {
    return self.res.statusCode || 200;
  });

  this.__defineSetter__('contentLength', function (len) {
    if (typeof (len) !== 'number')
      throw new TypeError('contentLength must be Number');

    self.header('Content-Length', len);
  });

  this.__defineGetter__('contentLength', function () {
    return self.res.getHeader('Content-Length');
  });

  this.__defineSetter__('contentType', function (type) {
    if (typeof (type) !== 'string')
      throw new TypeError('contentType must be String');

    if (type.indexOf('/') === -1)
      type = mime.lookup(type);

    if (!self.charSet)
      self.charSet = mime.charsets.lookup(type, self.charSet);

    self._contentType = type;
  });

  this.__defineGetter__('contentType', function () {
    return self._contentType;
  });

  this.__defineGetter__('etag', function () {
    return self.get('etag');
  });

  this.__defineSetter__('etag', function (val) {
    return self.set('etag', val);
  });

  this.__defineGetter__('headers', function () {
    return self.res._headers || {};
  });

  this.__defineGetter__('id', function () {
    return self.req.requestId;
  });

  this.__defineGetter__('requestId', function () {
    return self.req.requestId;
  });

  this.__defineGetter__('statusCode', function () {
    return self.code;
  });

  this.__defineSetter__('statusCode', function (code) {
    self.code = code;
  });

  var types = Object.keys(this.formatters);
  this.__defineGetter__('types', function () {
    return types;
  });

  this.__defineGetter__('writable', function () {
    return self.res.writable;
  });

  this.__defineGetter__('writeable', function () {
    return self.res.writable;
  });

  ///--- Events
  this.res.on('drain', function () {
    return self.emit('drain');
  });

  this.res.on('error', function (err) {
    return self.emit('error', err);
  });

  this.res.on('close', function () {
    return self.emit('close');
  });

  this.res.on('pipe', function (src) {
    return self.emit('pipe', src);
  });

  // Finally write the default headers in
  this.defaultHeaders();
}
util.inherits(Response, Stream);
module.exports = Response;

Response.ACCEPTABLE = [
  'application/json',
  'text/plain',
  'application/octet-stream'
];



///--- Set up pass-throughs for all the APIs

Object.keys(http.OutgoingMessage.prototype).forEach(function (m) {
  Response.prototype[m] = function () {
    return this.res[m].apply(this.res, arguments);
  };
});



///--- http.OutgoingMessage APIs

Response.prototype.writeHead = function writeHead() {
  if (this.statusCode === 204 || this.statusCode === 304) {
    this.removeHeader('Content-Length');
    this.removeHeader('Content-MD5');
    this.removeHeader('Content-Type');
  }

  this.res.writeHead.apply(this.res, arguments);
  this.emit('header');
};


Response.prototype.writeContinue = function writeContinue() {
  return this.res.writeContinue.apply(this.res, arguments);
};



///-- Express APIs (that we want)

Response.prototype.header = function header(name, value) {
  if (typeof (name) !== 'string')
    throw new TypeError('name (String) required');

  if (value === undefined)
    return this.getHeader(name);

  if (value instanceof Date)
    value = httpDate(value);

  this.setHeader(name, value);
  return value;
};


Response.prototype.get = function get(name) {
  return this.getHeader(name);
};


Response.prototype.set = function set(name, val) {
  if (arguments.length === 2) {
    if (typeof (name) !== 'string')
      throw new TypeError('name (String) required');
    this.header(name, val);
  } else {
    if (typeof (name) !== 'object')
      throw new TypeError('Object required for argument 1');

    var self = this;
    Object.keys(name).forEach(function (k) {
      self.header(k, name[k]);
    });
  }

  return this;
};


Response.prototype.cache = function cache(type, options) {
  if (typeof (type) !== 'string') {
    options = type;
    type = 'public';
  }

  if (options && options.maxAge) {
    if (typeof (options.maxAge) !== 'number')
      throw new TypeError('options.maxAge (Number) required');
    type += ', max-age=' + (options.maxAge / 1000);
  }

  return this.header('Cache-Control', type);
};


Response.prototype.status = function status(code) {
  this.code = code;
  return this;
};


Response.prototype.defaultHeaders = function defaultHeaders() {
  this.header('Access-Control-Allow-Origin', '*');
  this.header('Access-Control-Allow-Headers', ALLOW_HEADERS);

  if (this.methods.length)
    this.header('Access-Control-Allow-Methods', this.methods.join());

  this.header('Access-Control-Expose-Headers', EXPOSE_HEADERS);
  this.header('Server', this.serverName);

  if (this.version)
    this.header('X-Api-Version', this.version);

  this.header('X-Request-Id', this.id);
};

Response.prototype.finishHeaders = function finishHeaders(data) {
  var now = new Date();

  if (!this.header('Connection') && !this.keepAlive)
    this.header('Connection', 'close');

  if (!this.header('Content-Length') && data) {
    if (Buffer.isBuffer(data)) {
      this.header('Content-Length', data.length);
    } else {
      this.header('Content-Length', Buffer.byteLength(data));
    }
  } else {
    this.header('Content-Length', 0);
  }

  if (!this.header('Content-MD5') && data) {
    var hash = crypto.createHash('md5');
    hash.update(data);
    this.header('Content-MD5', hash.digest('base64'));
  }

  if (!this.header('Content-Type') && data && this.contentType) {
    var type = this.contentType;
    if (this.charSet)
      type += '; charset=' + this.charSet;
    this.header('Content-Type', type);
  }

  if (!this.header('Date'))
    this.header('Date', httpDate(now));

  if (!this.header('X-Response-Time'))
    this.header('X-Response-Time', now.getTime() - this.req.time.getTime());
};


Response.prototype.send = function send(body) {
  assert.ok(this.methods);

  var head = (this.req.method === 'HEAD');

  switch (arguments.length) {
  case 0:
    body = null;
    break;

  case 1:
    if (typeof (body) === 'number') {
      this.statusCode = body;
      body = null;
    } else if (body && body instanceof HttpError) {
      this.statusCode = body.statusCode;
    }
    break;

  default:
    this.statusCode = body;
    body = arguments[1];
    break;
  }

  // the formatter might tack in Content- headers, so fill in headers after
  // serialization
  var data = body ? this.format(body) : null;
  this.finishHeaders(data);

  this.writeHead(this.statusCode);
  if (data && !head && this.statusCode !== 204 && this.statusCode !== 304)
    this.write(data);
  this.end();

  var self = this;
  this.log.trace({res: self}, 'response sent');
  return this;
};


Response.prototype.json = function json(obj) {
  if (arguments.length === 2) {
    this.code = obj;
    obj = arguments[1];
  }

  if (typeof (obj) !== 'object')
    throw new TypeError('object (Object) required');

  this.contentType = 'application/json';
  return this.send(obj);
};



Response.prototype.format = function format(body) {
  var log = this.log;

  log.trace('format entered(type=%s)', this.contentType);

  if (!this.contentType) {
    for (var i = 0; i < this.types.length; i++) {
      if (this.req.accepts(this.types[i])) {
        this.contentType = this.types[i];
        break;
      }
    }
  }

  if (this.types.indexOf(this.contentType) === -1) {
    this.contentType = 'application/octet-stream';
    log.trace('format content-type overriden: %s', this.contentType);
  }

  assert.ok(this.formatters[this.contentType]);

  if (body instanceof Error)
    this.code = (body instanceof errors.HttpError) ? body.statusCode : 500;

  var data = this.formatters[this.contentType](this.req, this, body);

  log.trace('format returing: %s', data);

  return data;
};


Response.prototype.toString = function toString() {
  var headers = '';
  var self = this;
  Object.keys(this.headers).forEach(function (k) {
    headers += k + ': ' + self.headers[k] + '\n';
  });
  return 'HTTP/1.1 ' + this.code + ' ' + http.STATUS_CODES[this.code] + '\n' +
    headers;
};
