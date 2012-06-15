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

var Response = http.ServerResponse;
var sprintf = util.format;

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
  'X-Request-Id'
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


function setContentLength(res, length) {
  if (res.getHeader('Content-Length') === undefined &&
      res.contentLength === undefined) {
    res.setHeader('Content-Length', length);
  }
}

function formatBinary(req, res, body) {
  if (!body) {
    setContentLength(res, 0);
    return null;
  }

  if (!Buffer.isBuffer(body))
    body = new Buffer(body.toString());

  setContentLength(res, body.length);
  return body;
}


function formatText(req, res, body) {
  if (!body) {
    setContentLength(res, 0);
    return null;
  }

  if (body instanceof Error) {
    body = body.message;
  } else if (typeof (body) === 'object') {
    body = JSON.stringify(body);
  } else {
    body = body.toString();
  }

  setContentLength(res, Buffer.byteLength(body));
  return body;
}


function formatJSON(req, res, body) {
  if (!body) {
    setContentLength(res, 0);
    return null;
  }

  if (body instanceof Error) {
    // snoop for RestError or HttpError, but don't rely on instanceof
    if ((body.restCode || body.httpCode) && body.body) {
      body = body.body;
    } else {
      body = {
        message: body.message
      };
    }
  }

  if (Buffer.isBuffer(body))
    body = body.toString('base64');

  var data = JSON.stringify(body);

  setContentLength(res, Buffer.byteLength(data));
  return data;
}


function ensureDefaultFormatters(res) {
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

  return res;
}


function extendResponse(options) {
  assert.ok(options instanceof Object);

  var req = options.request;
  var res = options.response;

  res.charSet = false;
  res.formatters = options.formatters;
  res.id = req.id;
  res.keepAlive = req.keepAlive;
  res.log = options.log;
  res._method = req.method;
  res.methods = [];

  res.responseTimeHeader = options.responseTimeHeader || 'X-Response-Time';
  if (typeof (options.responseTimeFormatter) === 'function') {
    res.responseTimeFormatter = options.responseTimeFormatter;
  } else {
    res.responseTimeFormatter = function defaultTimeFormatter(duration) {
      return duration;
    };
  }

  res.serverName = options.serverName || 'restify';
  res.req = req;

  ensureDefaultFormatters(res);
  res.types = Object.keys(res.formatters);

  return res;
}


///--- API

module.exports = {

  extendResponse: extendResponse,

  ACCEPTABLE: [
    'application/json',
    'text/plain',
    'application/octet-stream'
  ]

};

if (!Response.prototype.hasOwnProperty('_writeHead')) {
  Response.prototype._writeHead = Response.prototype.writeHead;
}
Response.prototype.writeHead = function restifyWriteHead() {
  if (this.code !== undefined)
    this.statusCode = this.code;

  if (this.statusCode === 204 || this.statusCode === 304) {
    this.removeHeader('Content-Length');
    this.removeHeader('Content-MD5');
    this.removeHeader('Content-Type');
  }

  this._writeHead.apply(this, arguments);
  this.emit('header');
};


Response.prototype.header = function header(name, value) {
  if (typeof (name) !== 'string')
    throw new TypeError('name (String) required');

  if (value === undefined)
    return this.getHeader(name);

  if (value instanceof Date)
    value = httpDate(value);

  // Support res.header('foo', 'bar %s', 'baz');
  if (arguments.length > 2)
    value = sprintf(value, Array.prototype.slice.call(arguments).slice(2));

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

  return this.setHeader('Cache-Control', type);
};


Response.prototype.link = function link(l, rel) {
  if (typeof (l) !== 'string')
    throw new TypeError('link (String) required');
  if (typeof (rel) !== 'string')
    throw new TypeError('rel (String) required');

  var _link = sprintf('<%s>; rel="%s"', l, rel);
  return this.setHeader('Link', _link);
};


Response.prototype.status = function status(code) {
  this.statusCode = code;
  return this;
};


Response.prototype.defaultResponseHeaders = function defaultHeaders(data) {
  this.setHeader('Access-Control-Allow-Origin', '*');
  this.setHeader('Access-Control-Allow-Headers', ALLOW_HEADERS);

  if (this.methods.length)
    this.setHeader('Access-Control-Allow-Methods', this.methods.join(', '));

  this.setHeader('Access-Control-Expose-Headers',
                 EXPOSE_HEADERS + ', ' + this.responseTimeHeader);

  if (!this.getHeader('Connection'))
    this.setHeader('Connection', this.keepAlive ? 'Keep-Alive' : 'close');

  if (!this.getHeader('Content-Length')) {
    if (this.contentLength !== undefined) {
      this.setHeader('Content-Length', this.contentLength);
    } else if (data) {
      if (Buffer.isBuffer(data)) {
        this.setHeader('Content-Length', data.length);
      } else {
        this.setHeader('Content-Length', Buffer.byteLength(data));
      }
    }
  }

  if (!this.getHeader('Content-MD5') && data) {
    var hash = crypto.createHash('md5');
    hash.update(data);
    this.setHeader('Content-MD5', hash.digest('base64'));
  }

  if (this.header('Content-Type') || this.contentType) {
    var type = this.header('Content-Type') || this.contentType;
    if (this.charSet)
      type += '; charset=' + this.charSet;
    this.setHeader('Content-Type', type);
  }


  var now = new Date();
  if (!this.getHeader('Date'))
    this.setHeader('Date', httpDate(now));

  if (this.etag && !this.getHeader('Etag'))
    this.setHeader('Etag', this.etag);

  this.setHeader('Server', this.serverName);
  if (this.version)
    this.setHeader('X-Api-Version', this.version);

  this.setHeader('X-Request-Id', this.id);

  if (!this.getHeader(this.responseTimeHeader))
    this.setHeader(this.responseTimeHeader,
                   this.responseTimeFormatter(now.getTime() -
                                              this.req.time.getTime()));
};


Response.prototype.send = function send(body) {
  var head = (this._method === 'HEAD');

  switch (arguments.length) {
  case 0:
    body = null;
    break;

  case 1:
    if (typeof (body) === 'number') {
      this.statusCode = body;
      body = null;
    } else if (body instanceof Error) {
      this.statusCode = body.statusCode || 500;
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
  this.emit('beforeSend', data);

  this.defaultResponseHeaders(data);
  this.writeHead(this.statusCode, this.headers);
  if (data && !head && this.statusCode !== 204 && this.statusCode !== 304) {
    this.write(data);
    this._body = data;
  }
  this.end();

  var self = this;
  this.log.trace({res: self}, 'response sent');
  return this;
};


Response.prototype.json = function json(obj) {
  if (arguments.length === 2) {
    this.statusCode = obj;
    obj = arguments[1];
  }

  if (typeof (obj) !== 'object')
    throw new TypeError('object (Object) required');

  this.contentType = 'application/json';
  return this.send(obj);
};


Response.prototype.format = function format(body) {
  var log = this.log;
  var type = this.contentType || this.getHeader('Content-Type');

  log.trace('format entered(type=%s)', type);

  if (!type) {
    for (var i = 0; i < this.types.length; i++) {
      if (this.req.accepts(this.types[i])) {
        type = this.types[i];
        break;
      }
    }
  } else if (type.indexOf('/') === -1) {
    type = mime.lookup(type);
  }

  if (this.types.indexOf(type) === -1) {
    type = 'application/octet-stream';
    log.trace('format content-type overriden: %s', type);
  }

  assert.ok(this.formatters[type]);

  this.setHeader('Content-Type', type);
  var data = this.formatters[type](this.req, this, body);

  log.trace('format(%s) returning: %s', type, data);
  return data;
};


Response.prototype.toString = function toString() {
  var headers = '';
  var self = this;
  Object.keys(this.headers).forEach(function (k) {
    headers += k + ': ' + self.headers[k] + '\n';
  });
  return 'HTTP/1.1 ' + this.statusCode + ' ' +
    http.STATUS_CODES[this.statusCode] + '\n' + headers;
};
