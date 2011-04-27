// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.
var assert = require('assert');
var crypto = require('crypto');
var http = require('http');
var path = require('path');
var querystring = require('querystring');
var url = require('url');

var uuid = require('node-uuid');

var Constants = require('./constants');
var HttpCodes = require('./http_codes');
var log = require('./log');

function _pad(val) {
  if (parseInt(val, 10) < 10) {
    val = '0' + val;
  }
  return val;
}

function _rfc822(date) {
  var months = ['Jan',
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
                'Dec'];
  var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[date.getUTCDay()] + ', ' +
    _pad(date.getUTCDate()) + ' ' +
    months[date.getUTCMonth()] + ' ' +
    date.getUTCFullYear() + ' ' +
    _pad(date.getUTCHours()) + ':' +
    _pad(date.getUTCMinutes()) + ':' +
    _pad(date.getUTCSeconds()) +
    ' GMT';
}

function _mergeFnArgs() {
  var _handlers = [];

  var _args = arguments[0];
  var i = 1;
  do {
    if (_args[i] instanceof Array) {
      var _arr = _args[i];
      for (var j = 0; j < _arr.length; j++) {
        if (!(_arr[j] instanceof Function)) {
          throw new Error('Invalid argument type: ' + typeof(_arr[j]));
        }
        _handlers.push(_arr[j]);
      }
    } else if (_args[i] instanceof Function) {
      _handlers.push(_args[i]);
    } else {
      throw new Error('Invalid argument type: ' + typeof(_args[i]));
    }
  } while (++i < _args.length);

  return _handlers;
}

////////////////////////
// Prototype extensions
////////////////////////

http.IncomingMessage.prototype.contentType = function contentType() {
  var type = this.headers['content-type'];
  var ndx;

  // RFC2616 section 7.2.1
  if (!type) return 'application/octet-stream';

  ndx = type.indexOf(';');
  if (ndx === -1) return type;

  return type.substring(0, ndx);
};


http.ServerResponse.prototype.send = function(code, body, headers) {
  var data;
  var now = new Date();

  this._code = code;
  this._time = now.getTime() - this.startTime;

  if (!headers) headers = {};

  // These headers allow strict clients (i.e. Google Chrome) to know that
  // this server does allow itself to be invoked from pages that aren't
  // part of the same origin policy.
  headers['Access-Control-Allow-Origin'] = '*';
  headers['Access-Control-Allow-Methods'] =
    ['HEAD', 'GET', 'POST', 'PUT', 'DELETE'].join(', ');

  headers.Server = this._serverName;
  headers.Connection = 'close';
  headers.Date = _rfc822(now);
  headers[Constants.XApiVersion] = this._apiVersion;
  headers[Constants.XRequestId] = this.requestId;
  headers[Constants.XResponseTime] = this._time;

  if (body) {
    headers['Content-Type'] = this._accept;
    switch (this._accept) {
    case Constants.ContentTypeJson:
      data = JSON.stringify(body);
      break;
    case Constants.ContentTypeXml:
      throw new Error('XML not yet supported');
    default:
      throw new Error('Somehow response.send has an unknown accept type: ' +
                      this._accept);
    }
  }

  this._bytes = 0;
  if (data) {
    data = data + '\n';
    this._bytes = data.length;
    headers['Content-Length'] = data.length;
    var hash = crypto.createHash('md5');
    hash.update(data);
    headers['Content-MD5'] = hash.digest(encoding = 'base64');
  } else {
    headers['Content-Length'] = 0;
  }

  if (log.trace()) {
    log.trace('response.send: code=%d, headers=%o, body=%s',
              code, headers, data);
  }

  this.writeHead(code, headers);
  this.end(data);
};

http.ServerResponse.prototype.sendError = function sendError(error) {
  if (!error || !error.restCode || !error.message || !error.httpCode) {
    log.warn('Unknown error being returned: %s', error);
    return this.send(HttpCodes.InternalError);
  }
  this.sentError = error;
  return this.send(error.httpCode, {
    code: error.restCode,
    message: error.message
  });

};


http.Server.prototype._mount = function _mount(method, url, handlers) {
  if (!this.routes) this.routes = {};
  if (!this.routes[method]) this.routes[method] = [];
  // reverse index
  if (!this.routes.urls) this.routes.urls = {};
  if (!this.routes.urls[url]) this.routes.urls[url] = [];

  var _handlers = [];
  if (handlers instanceof Function) {
    _handlers.push(handlers);
  } else {
    handlers.forEach(function(h) {
      if (h instanceof Function) {
        _handlers.push(h);
      } else {
        log.warn('Non-function passed to mount: %s', h);
      }
    });
  }


  var r = {
    method: method,
    url: url,
    handlers: _handlers,
    urlComponents: url.split('/').slice(1)
  };
  this.routes[method].push(r);
  this.routes.urls[url].push(r);
};

http.Server.prototype.del = function(url) {
  if (!url) throw new Error('url is required');

  return this._mount('DELETE', url, _mergeFnArgs(arguments));
};

http.Server.prototype.get = function(url) {
  if (!url) throw new Error('url is required');

  return this._mount('GET', url, _mergeFnArgs(arguments));
};

http.Server.prototype.head = function(url, handlers) {
  if (!url) throw new Error('url is required');

  return this._mount('HEAD', url, _mergeFnArgs(arguments));
};

http.Server.prototype.post = function(url, handlers) {
  if (!url) throw new Error('url is required');

  return this._mount('POST', url, _mergeFnArgs(arguments));
};

http.Server.prototype.put = function(url, handlers) {
  if (!url) throw new Error('url is required');

  return this._mount('PUT', url, _mergeFnArgs(arguments));
};
