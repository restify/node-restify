// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var crypto = require('crypto');
var http = require('http');
var Stream = require('stream').Stream;
var util = require('util');

var mime = require('mime');

var errors = require('./errors');
var Request = require('./request');



///--- Globals

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


function startHeaders(res) {
  assert.ok(res);

  if (!res.header('Access-Control-Allow-Origin'))
    res.header('Access-Control-Allow-Origin', '*');

  if (!res.header('Access-Control-Allow-Methods') && res.methods.length)
    res.header('Access-Control-Allow-Methods', res.methods.join());

  if (!res.header('Access-Control-Allow-Headers'))
    res.header('Access-Control-Allow-Headers', ALLOW_HEADERS);

  if (!res.header('Access-Control-Expose-Headers'))
    res.header('Access-Control-Expose-Headers', EXPOSE_HEADERS);

  if (!res.header('Connection') && !res.keepAlive)
    res.header('Connection', 'end');
}


function finishHeaders(res, data) {
  assert.ok(res);

  if (!data) {
    res.contentLength = 0;
  } else {
    res.contentLength =
      Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data);
    var hash = crypto.createHash('md5');
    hash.update(data);
    res.header('Content-MD5', hash.digest('base64'));
  }

  var now = new Date();
  if (!res.header('Date'))
    res.header('Date', httpDate(now));

  if (!res.header('Server'))
    res.header('Server', 'restify');

  if (!res.header('X-Api-Version') && res.version)
    res.header('X-Api-Version', res.version);

  if (!res.header('X-Request-Id'))
    res.header('X-Request-Id', res.requestId);

  if (!res.header('X-Response-Time'))
    res.header('X-Response-Time', now.getTime() - res.req.time.getTime());
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
  } else if (typeof(body) === 'object') {
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
    res.formattes = res;

  if (!res.formatters['application/json'])
    res.formatters['application/json'] = formatJSON;

  if (!res.formatters['text/plain'])
    res.formatters['text/plain'] = formatText;

  if (!res.formatters['application/octet-stream'])
    res.formatters['application/octet-stream'] = formatBinary;
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
 *     json: function(req, res, data, callback) {
 *       return callback(null, JSON.stringify(data));
 *     }
 *   }
 * });
 *
 * Note there is a special formatter called `error` which is invoked when
 * data is an error.
 *
 * @param {Object} options pass in log4js handle, http.OutgoingMessage and a
 *                 Request.
 * @throws {TypeError} on input error.
 */
function Response(options) {
  if (typeof(options) !== 'object')
    throw new TypeError('options (Object) required');
  if (typeof(options.log4js) !== 'object')
    throw new TypeError('options.log4js (Object) required');
  if (typeof(options.response) !== 'object')
    throw new TypeError('options.response (http.OutgoingMessage) required');
  if (!(options.request instanceof Request))
    throw new TypeError('options.request (Request) required');
  if (options.version && typeof(options.version) !== 'string')
    throw new TypeError('options.version (String) required');

  var self = this;

  Stream.call(this);

  this.formatters = {};
  this.log4js = options.log4js;
  this.log = this.log4js.getLogger('Response');
  this.methods = options.methods || [];
  this.req = options.request;
  this.res = options.response;
  this.version = options.version || false;

  // Generate the formatters
  if (options.formatters) {
    Object.keys(options.formatters).forEach(function(k) {
      if (k.indexOf('/') === -1)
        k = mime.lookup(k);

      self.formatters[k] = options.formatters[k];
    });
  }
  ensureDefaultFormatters(this);

  this.__defineSetter__('code', function(c) {
    if (typeof(c) !== 'number')
      throw new TypeError('code (Number) required');
    if (c < 100 || c > 599)
      throw new TypeError('code is not a valid HTTP status code');

    self.res.statusCode = c;
  });

  this.__defineGetter__('code', function() {
    return self.res.statusCode || 200;
  });

  this.__defineSetter__('contentLength', function(len) {
    if (typeof(len) !== 'number')
      throw new TypeError('contentLength must be Number');

    self.res.setHeader('Content-Length', len);
  });

  this.__defineGetter__('contentLength', function() {
    return self.res.getHeader('Content-Length');
  });

  this.__defineSetter__('contentType', function(type) {
    if (typeof(type) !== 'string')
      throw new TypeError('contentType must be String');

    if (type.indexOf('/') === -1)
      type = mime.lookup(type);

    self.res.setHeader('Content-Type', type);
  });

  this.__defineGetter__('contentType', function() {
    return self.res.getHeader('Content-Type');
  });

  this.__defineGetter__('headers', function() {
    return self.res._headers || {};
  });

  this.__defineGetter__('id', function() {
    return self.req.requestId;
  });

  this.__defineGetter__('requestId', function() {
    return self.req.requestId;
  });

  this.__defineGetter__('statusCode', function() {
    return self.code;
  });

  this.__defineSetter__('statusCode', function(code) {
    self.code = code;
  });

  var types = Object.keys(this.formatters);
  this.__defineGetter__('types', function() {
    return types;
  });

  this.__defineGetter__('writeable', function() {
    return self.res.writable;
  });

  ///--- Events
  this.res.on('drain', function() {
    return self.emit('drain');
  });

  this.res.on('error', function(err) {
    return self.emit('error', err);
  });

  this.res.on('close', function() {
    return self.emit('close');
  });

  this.res.on('pipe', function(src) {
    return self.emit('pipe', src);
  });
}
util.inherits(Response, Stream);
module.exports = Response;

Response.ACCEPTABLE = [
  'application/json',
  'text/plain',
  'application/octet-stream'
];


///--- Writable Stream APIs

Response.prototype.write = function write() {
  return this.res.write.apply(this.res, arguments);
};


Response.prototype.end = function end() {
  return this.res.end.apply(this.res, arguments);
};


Response.prototype.destroy = function destroy() {
  return this.res.destroy.apply(this.res, arguments);
};


Response.prototype.destroySoon = function destroySoon() {
  return this.res.destroySoon.apply(this.res, arguments);
};


///--- http.OutgoingMessage APIs

Response.prototype.writeHead = function writeHead() {
  return this.res.writeHead.apply(this.res, arguments);
};


Response.prototype.writeContinue = function writeContinue() {
  return this.res.writeContinue.apply(this.res, arguments);
};


Response.prototype.addTrailers = function addTrailers() {
  return this.res.addTrailers.apply(this.res, arguments);
};


Response.prototype.setHeader = function setHeader() {
  return this.res.setHeader.apply(this.res, arguments);
};


Response.prototype.getHeader = function getHeader() {
  return this.res.getHeader.apply(this.res, arguments);
};


Response.prototype.removeHeader = function removeHeader() {
  return this.res.removeHeader.apply(this.res, arguments);
};


///-- Express APIs (that we want)

Response.prototype.header = function header(name, value) {
  if (typeof(name) !== 'string')
    throw new TypeError('name (String) required');

  if (value === undefined)
    return this.getHeader(name);

  this.setHeader(name, value);
  return value;
};


Response.prototype.get = function get(name) {
  return this.getHeader(name);
};


Response.prototype.set = function set(name, val) {
  if (arguments.length === 2) {
    if (typeof(name) !== 'string')
      throw new TypeError('name (String) required');
    this.setHeader(name, val);
  } else {
    if (typeof(name) !== 'object')
      throw new TypeError('Object required for argument 1');

    var self = this;
    Object.keys(name).forEach(function(k) {
      self.setHeader(k, name[k]);
    });
  }

  return this;
};


Response.prototype.cache = function cache(type, options) {
  if (typeof(type) !== 'string') {
    options = type;
    type = 'public';
  }

  if (options && options.maxAge) {
    if (typeof(options.maxAge) !== 'number')
      throw new TypeError('options.maxAge (Number) required');
    type += ', max-age=' + (options.maxAge / 1000);
  }

  return this.setHeader('Cache-Control', type);
};


Response.prototype.status = function status(code) {
  this.code = code;
  return this;
};


Response.prototype.send = function send(body) {
  assert.ok(this.methods);

  var head = (this.req.method === 'HEAD');

  // allow status / body
  if (arguments.length === 2) {
    this.statusCode = body;
    body = arguments[1];
  }


  startHeaders(this);
  // the formatter likely tacks in Content- headers
  var data = body ? this.format(body) : null;
  finishHeaders(this, data);

  if (this.statusCode === 204 || this.statusCode === 304) {
    this.removeHeader('Content-Length');
    this.removeHeader('Content-MD5');
    this.removeHeader('Content-Type');
    body = false;
  }

  this.end((!head && body ?  data : null));
  if (this.log.isTraceEnabled())
    this.log.trace('%s sent response:\n%s', this.id, this.toString());
  return this;
};


Response.prototype.json = function json(obj) {
  if (arguments.length === 2) {
    this.code = obj;
    obj = arguments[1];
  }

  if (typeof(obj) !== 'object')
    throw new TypeError('object (Object) required');

  this.contentType = 'application/json';
  return this.send(obj);
};



Response.prototype.format = function format(body) {
  var log = this.log;

  if (log.isTraceEnabled())
    log.trace('%s format entered(type=%s).', this.requestId, this.contentType);

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

    if (log.isTraceEnabled()) {
      log.trace('%s format content-type overriden: %s',
                this.requestId, this.contentType);
    }
  }

  assert.ok(this.formatters[this.contentType]);

  if (body instanceof Error)
    this.code = (body instanceof errors.HttpError) ? body.statusCode : 500;

  var data = this.formatters[this.contentType](this.req, this, body);

  if (log.isTraceEnabled())
    log.trace('%s format returing: %s', this.requestId, data);

  return data;
};


Response.prototype.toString = function toString() {
  var headers = '';
  var self = this;
  Object.keys(this.headers).forEach(function(k) {
    headers += k + ': ' + self.headers[k] + '\n';
  });
  return 'HTTP/1.1 ' + this.code + ' ' + http.STATUS_CODES[this.code] + '\n' +
    headers;
};
