// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var http = require('http');
var sprintf = require('util').format;
var url = require('url');

var assert = require('assert-plus');
var mime = require('mime');

var httpDate = require('./http_date');
var utils = require('./utils');
var errors = require('./errors');

///--- Globals

var InternalServerError = errors.InternalServerError;

var Response = http.ServerResponse;


///--- API

/**
 * sets the cache-control header. `type` defaults to _public_,
 * and options currently only takes maxAge.
 * @public
 * @function cache
 * @param    {String} type    value of the header
 * @param    {Object} options an options object
 * @returns  {String}         the value set to the header
 */
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


/**
 * turns off all cache related headers.
 * @public
 * @function noCache
 * @returns  {Object} self, the response object
 */
Response.prototype.noCache = function noCache() {
    // HTTP 1.1
    this.header('Cache-Control', 'no-cache, no-store, must-revalidate');

    // HTTP 1.0
    this.header('Pragma', 'no-cache');

    // Proxies
    this.header('Expires', '0');

    return (this);
};


/**
 * Appends the provided character set to the response's Content-Type.
 * e.g., res.charSet('utf-8');
 * @public
 * @function charSet
 * @param    {String} type char-set value
 * @returns  {Object} self, the response object
 */
Response.prototype.charSet = function charSet(type) {
    assert.string(type, 'charset');

    this._charSet = type;

    return (this);
};


/**
 * the response formatter. formats the response in preparation to send it off.
 * callback only used in async formatters. restify does not ship with any
 * async formatters currently.
 * @public
 * @function format
 * @param    {Object | String} body the response body to format
 * @param    {Function}        cb   callback function
 * @returns  {undefined}
 */
Response.prototype.format = function format(body, cb) {
    var log = this.log;
    var formatter;
    var type = this.contentType || this.getHeader('Content-Type');
    var self = this;

    if (!type) {
        if (this.req.accepts(this.acceptable)) {
            type = this.req.accepts(this.acceptable);
        }

        if (!type) {
            // The importance of a status code outside of the
            // 2xx range probably outweighs that of unable being to
            // format the response body
            if (this.statusCode >= 200 && this.statusCode < 300) {
                this.statusCode = 406;
            }

            return cb(null);
        }
    } else if (type.indexOf(';') !== '-1') {
        type = type.split(';')[0];
    }

    if (!(formatter = this.formatters[type])) {
        if (type.indexOf('/') === -1) {
            type = mime.lookup(type);
        }

        if (this.acceptable.indexOf(type) === -1) {
            type = 'application/octet-stream';
        }

        formatter = this.formatters[type] || this.formatters['*/*'];

        // this is a catastrophic case - should always fall back on octet-stream
        // but if for some reason that's gone, return a 500.
        if (!formatter) {
            log.warn({
                req: self.req
            }, 'no formatter found. Returning 500.');
            this.statusCode = 500;
            return cb(null);
        }
    }

    if (this._charSet) {
        type = type + '; charset=' + this._charSet;
    }

    this.setHeader('Content-Type', type);

    if (body instanceof Error && body.statusCode !== undefined) {
        this.statusCode = body.statusCode;
    }
    return (formatter.call(this, this.req, this, body, cb));
};


/**
 * retrieves a header off the response.
 * @public
 * @function get
 * @param    {Object} name the header name
 * @returns  {String}
 */
Response.prototype.get = function get(name) {
    assert.string(name, 'name');

    return (this.getHeader(name));
};


/**
 * retrieves all headers off the response.
 * @public
 * @function getHeaders
 * @returns  {Object}
 */
Response.prototype.getHeaders = function getHeaders() {
    return (this._headers || {});
};
Response.prototype.headers = Response.prototype.getHeaders;


/**
 * sets headers on the response.
 * @public
 * @function header
 * @param    {String} name  the name of the header
 * @param    {String} value the value of the header
 * @returns  {Object}
 */
Response.prototype.header = function header(name, value) {
    assert.string(name, 'name');

    if (value === undefined) {
        return (this.getHeader(name));
    }

    if (value instanceof Date) {
        value = httpDate(value);
    } else if (arguments.length > 2) {
        // Support res.header('foo', 'bar %s', 'baz');
        var arg = Array.prototype.slice.call(arguments).slice(2);
        value = sprintf(value, arg);
    }

    var current = this.getHeader(name);

    // #779, don't use comma separated values for set-cookie, see
    // http://tools.ietf.org/html/rfc6265#section-3
    if (current && name.toLowerCase() !== 'set-cookie') {
        if (Array.isArray(current)) {
            current.push(value);
            value = current;
        } else {
            value = [current, value];
        }
    }

    this.setHeader(name, value);
    return (value);
};


/**
 * short hand method for:
 *     res.contentType = 'json';
 *     res.send({hello: 'world'});
 * @public
 * @function json
 * @param    {Number} code    http status code
 * @param    {Object} object  value to json.stringify
 * @param    {Object} headers headers to set on the response
 * @returns  {Object}
 */
Response.prototype.json = function json(code, object, headers) {
    if (!/application\/json/.test(this.header('content-type'))) {
        this.header('Content-Type', 'application/json');
    }

    return (this.send(code, object, headers));
};


/**
 * sets the link heaader.
 * @public
 * @function link
 * @param    {String} l   the link key
 * @param    {String} rel the link value
 * @returns  {String}     the header value set to res
 */
Response.prototype.link = function link(l, rel) {
    assert.string(l, 'link');
    assert.string(rel, 'rel');

    var _link = sprintf('<%s>; rel="%s"', l, rel);
    return (this.header('Link', _link));
};


/**
 * sends the response object. convenience method that handles:
 *     writeHead(), write(), end()
 * @public
 * @function send
 * @param    {Number} code                      http status code
 * @param    {Object | Buffer | Error} body     the content to send
 * @param    {Object}                  headers  any add'l headers to set
 * @returns  {Object}                           self, the response object
 */
Response.prototype.send = function send(code, body, headers) {
    var isHead = (this.req.method === 'HEAD');
    var log = this.log;
    var self = this;

    if (code === undefined) {
        this.statusCode = 200;
    } else if (code.constructor.name === 'Number') {
        this.statusCode = code;

        if (body instanceof Error) {
            body.statusCode = this.statusCode;
        }
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
        // the problem here is that if the formatter throws an error, we can't
        // actually format the error again, since the formatter already failed.
        // So all we can do is send back a 500 with no body, since we don't
        // know at this point what format to send the error as. Additionally,
        // the current 'after' event is emitted _before_ we send the response,
        // so there's no way to re-emit the error here. TODO: clean up 'after'
        // even emitter so we pick up the error here.
        if (err) {
            self._data = null;
            self.statusCode = 500;
            log.error(err, 'unable to format response');
        } else {
            self._data = _body;
        }
        Object.keys(headers).forEach(function (k) {
            self.setHeader(k, headers[k]);
        });

        self.writeHead(self.statusCode);

        if (self._data && !(isHead || code === 204 || code === 304)) {
            self.write(self._data);
        }

        self.end();

        if (log.trace()) {
            log.trace({res: self}, 'response sent');
        }
    }

    if (body !== undefined) {
        this.format(body, _cb);
    } else {
        _cb(null, null);
    }

    return (this);
};


/**
 * sets a header on the response.
 * @public
 * @function set
 * @param    {String} name name of the header
 * @param    {String} val  value of the header
 * @returns  {Object}      self, the response object
 */
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


/**
 * sets the http status code on the response.
 * @public
 * @function status
 * @param    {Number} code http status code
 * @returns  {Number}     the status code passed in
 */
Response.prototype.status = function status(code) {
    assert.number(code, 'code');

    this.statusCode = code;
    return (code);
};


/**
 * toString() serialization.
 * @public
 * @function toString
 * @returns  {String}
 */
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

if (!Response.prototype.hasOwnProperty('_writeHead')) {
    Response.prototype._writeHead = Response.prototype.writeHead;
}


/**
 * pass through to native response.writeHead()
 * @public
 * @function writeHead
 * @returns  {undefined}
 */
Response.prototype.writeHead = function restifyWriteHead() {
    this.emit('header');

    if (this.statusCode === 204 || this.statusCode === 304) {
        this.removeHeader('Content-Length');
        this.removeHeader('Content-MD5');
        this.removeHeader('Content-Type');
        this.removeHeader('Content-Encoding');
    }

    this._writeHead.apply(this, arguments);
};


/*
 * redirect is sugar method for redirecting. takes a few different signatures:
 * 1) res.redirect(301, 'www.foo.com', next);
 * 2) res.redirect('www.foo.com', next);
 * 3) res.redirect({...}, next);
 * `next` is mandatory, to complete the response and trigger audit logger.
 * @public
 * @param    {Number | String}   arg1 the status code or url to direct to
 * @param    {String | Function} arg2 the url to redirect to, or `next` fn
 * @param    {Function}          arg3 `next` fn
 * @function redirect
 * @return   {undefined}
 */
Response.prototype.redirect = function redirect(arg1, arg2, arg3) {

    var self = this;
    var statusCode = 302;
    var finalUri;
    var next;

    // 1) this is signature 1, where an explicit status code is passed in.
    //    MUST guard against null here, passing null is likely indicative
    //    of an attempt to call res.redirect(null, next);
    //    as a way to do a reload of the current page.
    if (arg1 && !isNaN(arg1)) {
        statusCode = arg1;
        finalUri = arg2;
        next = arg3;
    }

    // 2) this is signaure number 2
    else if (typeof (arg1) === 'string') {
        // otherwise, it's a string, and use it directly
        finalUri = arg1;
        next = arg2;
    }

    // 3) signature number 3, using an options object.
    else if (typeof (arg1) === 'object') {

        // set next, then go to work.
        next = arg2;

        var req = self.req;
        var opt = arg1 || {};
        var currentFullPath = req.href();
        var secure = (opt.hasOwnProperty('secure')) ?
                        opt.secure :
                        req.isSecure();

        // if hostname is passed in, use that as the base,
        // otherwise fall back on current url.
        var parsedUri = url.parse(opt.hostname || currentFullPath, true);

        // create the object we'll use to format for the final uri.
        // this object will eventually get passed to url.format().
        // can't use parsedUri to seed it, as it confuses the url module
        // with some existing parsed state. instead, we'll pick the things
        // we want and use that as a starting point.
        finalUri = {
            port: parsedUri.port,
            hostname: parsedUri.hostname,
            query: parsedUri.query,
            pathname: parsedUri.pathname
        };

        // start building url based on options.
        // first, set protocol.
        finalUri.protocol = (secure === true) ? 'https' : 'http';

        // then set host
        if (opt.hostname) {
            finalUri.hostname = opt.hostname;
        }

        // then set current path after the host
        if (opt.pathname) {
            finalUri.pathname = opt.pathname;
        }

        // then set port
        if (opt.port) {
            finalUri.port = opt.port;
        }

        // then add query params
        if (opt.query) {
            if (opt.overrideQuery === true) {
                finalUri.query = opt.query;
            } else {
                finalUri.query = utils.mergeQs(opt.query, finalUri.query);
            }
        }

        // change status code to 301 permanent if specified
        if (opt.permanent) {
            statusCode = 301;
        }
    }

    // if we're missing a next we should probably throw. if user wanted
    // to redirect but we were unable to do so, we should not continue
    // down the handler stack.
    assert.func(next, 'res.redirect() requires a next param');

    // if we are missing a finalized uri
    // by this point, pass an error to next.
    if (!finalUri) {
        return (next(new InternalServerError('could not construct url')));
    }

    // now we're done constructing url, send the res
    self.send(statusCode, null, {
        location: url.format(finalUri)
    });

    // tell server to stop processing the handler stack.
    return (next(false));
};
