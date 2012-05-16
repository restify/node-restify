// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var crypto = require('crypto');
var http = require('http');
var sprintf = require('util').format;

var mime = require('mime');

var args = require('./args');
var errors = require('./errors');
var httpDate = require('./http_date');



///--- Globals

var assertNumber = args.assertNumber;
var assertObject = args.assertObject;
var assertString = args.assertString;

var HttpError = errors.HttpError;
var RestError = errors.RestError;

var Response = http.ServerResponse;



///--- API

Response.prototype.cache = function cache(type, options) {
        if (typeof (type) !== 'string') {
                options = type;
                type = 'public';
        }

        if (options && options.maxAge) {
                assertNumber('options.maxAge', options.maxAge);
                type += ', max-age=' + (options.maxAge / 1000);
        }

        return (this.header('Cache-Control', type));
};


Response.prototype.format = function format(body) {
        var log = this.log;
        var type = this.contentType || this.getHeader('Content-Type');
        var formatter = this.formatters[type];
        var self = this;

        if (!formatter) {
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

                formatter = this.formatters[type];
                if (!formatter) {
                        log.warn({
                                req: self.req
                        }, 'no formatter found. Returning 500.');
                        this.statusCode = 500;
                        return (null);
                }
                this.setHeader('Content-Type', type);
        }

        if (body instanceof Error && body.statusCode !== undefined)
                this.statusCode = body.statusCode;

        return (formatter(this.req, this, body));
};


Response.prototype.get = function get(name) {
        assertString('name', name);

        return (this.getHeader(name));
};


Response.prototype.getHeaders = function getHeaders() {
        return (this._headers || {});
};


Response.prototype.header = function header(name, value) {
        assertString('name', name);

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
        this.setHeader('Content-Type', 'application/json');
        return (this.send(code, object, headers));
};


Response.prototype.link = function link(l, rel) {
        assertString('link', l);
        assertString('rel', rel);

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

        headers = headers || this.getHeaders();

        if (log.trace()) {
                log.trace({
                        code: self.statusCode,
                        body: body,
                        headers: headers,
                        res: self
                }, 'response::send entered');
        }

        this._body = body;

        this._data = body ? this.format(body) : null;

        this.writeHead(this.statusCode, headers);
        if (isHead || code === 204 || code === 304)
                this._data = null;

        if (this._data)
                this.write(this._data);
        this.end();

        if (log.trace())
                log.trace({res: self}, 'response sent');

        return (this);
};


Response.prototype.set = function set(name, val) {
        var self = this;

        if (arguments.length === 2) {
                assertString('name', name);
                this.header(name, val);
        } else {
                assertObject('object', name);
                Object.keys(name).forEach(function (k) {
                        self.header(k, name[k]);
                });
        }

        return (this);
};


Response.prototype.status = function status(code) {
        assertNumber('code', code);

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

        if (this.etag && !this.getHeader('etag'))
                this.setHeader('Etag', this.etag);

        this._writeHead.apply(this, arguments);
};
