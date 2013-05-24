// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var crypto = require('crypto');
var http = require('http');
var sprintf = require('util').format;

var assert = require('assert-plus');
var mime = require('mime');
var once = require('once');

var errors = require('./errors');
var httpDate = require('./http_date');



///--- Globals

var HttpError = errors.HttpError;
var RestError = errors.RestError;

var Response = http.ServerResponse;



///--- API

Response.prototype.cache = function cache(type, options) {
        if (typeof (type) !== 'string') {
                options = type;
                type = 'public';
        }

        if (options && options.maxAge !== undefined) {
                assert.number(options.maxAge, 'options.maxAge');
                type += ', max-age=' + options.maxAge;
        }

        return (this.header('Cache-Control', type));
};


Response.prototype.charSet = function charSet(type) {
        assert.string(type, 'charset');

        this._charSet = type;

        return (this);
};


Response.prototype.format = function format(body, cb) {
        var log = this.log;
        var formatter;
        var type = this.contentType || this.getHeader('Content-Type');
        var self = this;

        if (type && type.indexOf(';') !== '-1')
                type = type.split(';')[0];

        if (!(formatter = this.formatters[type])) {
                if (!type) {
                        for (var i = 0; i < this.acceptable.length; i++) {
                                if (this.req.accepts(this.acceptable[i])) {
                                        type = this.acceptable[i];
                                        break;
                                }
                        }
                } else {
                        if (type.indexOf('/') === -1)
                                type = mime.lookup(type);

                        if (this.acceptable.indexOf(type) === -1)
                                type = 'application/octet-stream';
                }

                formatter = this.formatters[type] || this.formatters['*/*'];
                if (!formatter) {
                        log.warn({
                                req: self.req
                        }, 'no formatter found. Returning 500.');
                        this.statusCode = 500;
                        return (null);
                }
                this.setHeader('Content-Type', type);
        }

        if (this._charSet) {
                type = type + '; charset=' + this._charSet;
                this.setHeader('Content-Type', type);
        }

        if (body instanceof Error && body.statusCode !== undefined)
                this.statusCode = body.statusCode;
        return (formatter.call(this, this.req, this, body, cb));
};


Response.prototype.get = function get(name) {
        assert.string(name, 'name');

        return (this.getHeader(name));
};


Response.prototype.getHeaders = function getHeaders() {
        return (this._headers || {});
};
Response.prototype.headers = Response.prototype.getHeaders;


Response.prototype.header = function header(name, value) {
        assert.string(name, 'name');

        if (value === undefined)
                return (this.getHeader(name));

        if (value instanceof Date) {
                value = httpDate(value);
        } else if (arguments.length > 2) {
                // Support res.header('foo', 'bar %s', 'baz');
                var arg = Array.prototype.slice.call(arguments).slice(2);
                value = sprintf(value, arg);
        }

        this.setHeader(name, value);
        return (value);
};


Response.prototype.json = function json(code, object, headers) {
        if (!/application\/json/.test(this.header('content-type')))
                this.header('Content-Type', 'application/json');

        return (this.send(code, object, headers));
};


Response.prototype.link = function link(l, rel) {
        assert.string(l, 'link');
        assert.string(rel, 'rel');

        var _link = sprintf('<%s>; rel="%s"', l, rel);
        return (this.header('Link', _link));
};


Response.prototype.send = function send(code, body, headers) {
        var isHead = (this.req.method === 'HEAD');
        var log = this.log;
        var self = this;

        if (code === undefined) {
                this.statusCode = 200;
        } else if (code.constructor.name === 'Number') {
                this.statusCode = code;
        } else {
                headers = body;
                body = code;
                code = null;
        }

        headers = headers || {};

        if (log.trace()) {
                var _props = {
                        code: self.statusCode,
                        headers: headers
                };
                if (body instanceof Error) {
                        _props.err = body;
                } else {
                        _props.body = body;
                }
                log.trace(_props, 'response::send entered');
        }

        this._body = body;

        function _cb(err, _body) {
                self._data = _body;
                Object.keys(headers).forEach(function (k) {
                        self.setHeader(k, headers[k]);
                });

                self.writeHead(self.statusCode);

                if (self._data && !(isHead || code === 204 || code === 304))
                        self.write(self._data);

                self.end();

                if (log.trace())
                        log.trace({res: self}, 'response sent');
        }

        if (body) {
                var ret = this.format(body, _cb);
                if (!(ret instanceof Response)) {
                        _cb(null, ret);
                }
        } else {
                _cb(null, null);
        }

        return (this);
};


Response.prototype.set = function set(name, val) {
        var self = this;

        if (arguments.length === 2) {
                assert.string(name, 'name');
                this.header(name, val);
        } else {
                assert.object(name, 'object');
                Object.keys(name).forEach(function (k) {
                        self.header(k, name[k]);
                });
        }

        return (this);
};


Response.prototype.status = function status(code) {
        assert.number(code, 'code');

        this.statusCode = code;
        return (code);
};


Response.prototype.toString = function toString() {
        var headers = this.getHeaders();
        var headerString = '';
        var str;

        Object.keys(headers).forEach(function (k) {
                headerString += k + ': ' + headers[k] + '\n';
        });
        str = sprintf('HTTP/1.1 %s %s\n%s',
                      this.statusCode,
                      http.STATUS_CODES[this.statusCode],
                      headerString);

        return (str);
};

if (!Response.prototype.hasOwnProperty('_writeHead'))
        Response.prototype._writeHead = Response.prototype.writeHead;


Response.prototype.writeHead = function restifyWriteHead() {
        this.emit('header');

        if (this.statusCode === 204 || this.statusCode === 304) {
                this.removeHeader('Content-Length');
                this.removeHeader('Content-MD5');
                this.removeHeader('Content-Type');
        }

        this._writeHead.apply(this, arguments);
};
