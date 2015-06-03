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

Response.prototype.noCache = function noCache() {
    // HTTP 1.1
    this.header('Cache-Control', 'no-cache, no-store, must-revalidate');

    // HTTP 1.0
    this.header('Pragma', 'no-cache');

    // Proxies
    this.header('Expires', '0');

    return (this);
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

            return (null);
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

        if (!formatter) {
            log.warn({
                req: self.req
            }, 'no formatter found. Returning 500.');
            this.statusCode = 500;
            return (null);
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


Response.prototype.json = function json(code, object, headers) {
    if (!/application\/json/.test(this.header('content-type'))) {
        this.header('Content-Type', 'application/json');
    }

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

    // TODO: restify doesn't ship with any async formatters, but
    // presumably if an async formatter blows up, we should return a 500.
    function _cb(err, _body) { // eslint-disable-line handle-callback-err
        self._data = _body;
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

if (!Response.prototype.hasOwnProperty('_writeHead')) {
    Response.prototype._writeHead = Response.prototype.writeHead;
}


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


// I can't use slash star here for docs because the linter is confused by
// formatters[star slash star] earlier in the file. time to move to eslint?
// redirect is sugar method for redirecting. takes a few different signatures:
// 1) res.redirect(301, 'www.foo.com', next);
// 2) res.redirect('www.foo.com', next);
// 3) res.redirect({...}, next);
// @public
// @method redirect
// @return {void}
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
