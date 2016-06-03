// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var http = require('http');
var sprintf = require('util').format;
var url = require('url');

var assert = require('assert-plus');
var mime = require('mime');
var errors = require('restify-errors');

var httpDate = require('./http_date');
var utils = require('./utils');

///--- Globals

var InternalServerError = errors.InternalServerError;
// make custom error constructors
errors.makeConstructor('FormatterError');

var Response = http.ServerResponse;

/**
 * Headers that cannot be multi-values.
 * @see #779, don't use comma separated values for set-cookie
 * @see #986, don't use comma separated values for content-type
 * @see http://tools.ietf.org/html/rfc6265#section-3
 */
var HEADER_ARRAY_BLACKLIST = {
    'set-cookie': true,
    'content-type': true
};


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
 * finds a formatter that is both acceptable and works for the content-type
 * specified on the response. Can return two errors:
 *      NotAcceptableError - couldn't find a suitable formatter
 *      InternalServerError - couldn't find a fallback formatter
 * @public
 * @function _findFormatter
 * @param    {Function} callback a callback fn
 * @returns  {undefined}
 */
Response.prototype._findFormatter = function _findFormatter(callback) {

    var formatter;
    var type = this.contentType || this.getHeader('Content-Type');

    if (!type) {
        if (this.req.accepts(this.acceptable)) {
            type = this.req.accepts(this.acceptable);
        }

        if (!type) {
            return callback(new errors.NotAcceptableError({
                message: 'could not find suitable formatter'
            }));
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

        // this is a catastrophic case - should always fall back on
        // octet-stream but if for some reason that's gone, return a 500.
        if (!formatter) {
            return callback(new errors.InternalServerError({
                message: 'could not find formatter for application/octet-stream'
            }));
        }
    }

    if (this._charSet) {
        type = type + '; charset=' + this._charSet;
    }

    this.setHeader('Content-Type', type);

    return callback(null, formatter, type);
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

    // Check the header blacklist before changing a header to an array
    var nameLc = name.toLowerCase();

    if (current && !(nameLc in HEADER_ARRAY_BLACKLIST)) {

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
 * @param    {Number} [code]    http status code
 * @param    {Object} object    value to json.stringify
 * @param    {Object} [headers] headers to set on the response
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
 * sends the response object. pass through to internal __send that uses a
 * formatter based on the content-type header.
 * @public
 * @function send
 * @param    {Number} code http status code
 * @param    {Object | Buffer | Error} body the content to send
 * @param    {Object} headers  any add'l headers to set
 * @param    {Function} callback a callback for use with async formatters
 * @returns  {Object | undefined} when async formatter in use, returns null,
 * otherwise returns the response object
 */
Response.prototype.send = function send(code, body, headers, callback) {
    var self = this;
    return self.__send(code, body, headers, callback, true);
};


/**
 * sends the response object. pass through to internal __send that skips
 * formatters entirely and sends the content as is.
 * @public
 * @function sendRaw
 * @param    {Number} code http status code
 * @param    {Object | Buffer | Error} body the content to send
 * @param    {Object} headers  any add'l headers to set
 * @param    {Function} callback a callback for use with async formatters
 * @returns  {Object | undefined} when async formatter in use, returns null,
 * otherwise returns the response object
 */
Response.prototype.sendRaw = function sendRaw(code, body, headers, callback) {
    var self = this;
    return self.__send(code, body, headers, callback, false);
};


/**
 * internal implementation of send. convenience method that handles:
 * writeHead(), write(), end().
 * @private
 * @private
 * @param    {Number} [maybeCode] http status code
 * @param    {Object | Buffer | Error} [maybeBody] the content to send
 * @param    {Object} [maybeHeaders] any add'l headers to set
 * @param    {Function} [maybeCallback] optional callback for async formatters
 * @param    {Function} format when false, skip formatting
 * @returns  {Object} returns the response object
 */
Response.prototype.__send =
function __send(maybeCode, maybeBody, maybeHeaders, maybeCallback, format) {

    var self = this;
    var isHead = (self.req.method === 'HEAD');
    var log = self.log;
    var code;
    var body;
    var headers;
    var callback;

    // normalize variadic args.
    if (typeof maybeCode === 'number') {
        // if status code was passed in, then signature should look like jsdoc
        // signature and we only need to figure out headers/callback variation.
        code = maybeCode;

        // signature should look like jsdoc signature
        body = maybeBody;

        if (typeof maybeHeaders === 'function') {
            callback = maybeHeaders;
        } else {
            callback = maybeCallback;
            headers = maybeHeaders;
        }
    } else {
        // if status code was omitted, then first arg must be body.
        body = maybeCode;

        // now figure out headers/callback variation
        if (typeof maybeBody === 'function') {
            callback = maybeBody;
        } else {
            callback = maybeHeaders;
            headers = maybeBody;
        }
    }

    // if an error object is being sent and a status code isn't explicitly set,
    // infer one from the error object itself.
    if (!code && body instanceof Error) {
        self.statusCode = body.statusCode || 500;
    } else {
        self.statusCode = code || 200;
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

    self._body = body;

    function _flush(formattedBody) {
        self._data = formattedBody;

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

    // if no formatting, assert that the value to be written is a string
    // or a buffer, then send it.
    if (format === false) {
        assert.ok(typeof body === 'string' || Buffer.isBuffer(body),
                  'res.sendRaw() accepts only strings or buffers');
        return _flush(body);
    }

    // if no body, then no need to format. if this was an error caught by a
    // domain, don't send the domain error either.
    if (body === null ||
        body === undefined ||
        (body instanceof Error && body.domain)) {
        return _flush();
    }

    // otherwise, try to find a formatter
    self._findFormatter(
    function foundFormatter(findErr, formatter, contentType) {

        // handle missing formatters
        if (findErr) {
            // if user set a status code outside of the 2xx range, it probably
            // outweighs being unable to format the response. set a status code
            // then flush empty response.
            if (self.statusCode >= 200 && self.statusCode < 300) {
                self.statusCode = findErr.statusCode;
            }
            log.warn({
                req: self.req,
                err: findErr
            }, 'error retrieving formatter');
            return _flush();
        }

        // if we have formatter, happy path.
        var asyncFormat = (formatter && formatter.length === 4) ? true : false;

        if (asyncFormat === true) {

            assert.func(callback, 'async formatter for ' + contentType +
                                  ' requires callback to res.send()');

            // if async formatter error, propagate error back up to
            // res.send() caller, most likely a handler.
            return formatter.call(self, self.req, self, body,
            function _formatDone(formatErr, formattedBody) {

                if (formatErr) {

                    return callback(new errors.FormatterError(formatErr, {
                        message: 'unable to format response for ' +
                                    self.header('content-type'),
                        context: {
                            rawBody: body
                        }
                    }));
                }
                return _flush(formattedBody);
            });
        }
        // for sync formatters, invoke formatter and send response body.
        else {
            _flush(formatter.call(self, self.req, self, body), body);
            // users can always opt to pass in next, even when formatter is not
            // async. invoke callback in that case. return null when no
            // callback because eslint wants consistent-return.
            return (callback) ? callback() : null;
        }
    });

    return self;
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
        assert.string(name, 'res.set(name, val) requires name to be a string');
        this.header(name, val);
    } else {
        assert.object(name,
            'res.set(headers) requires headers to be an object');
        Object.keys(name).forEach(function (k) {
            self.set(k, name[k]);
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
 * @emits    header
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
 * @emits    redirect
 * @function redirect
 * @return   {undefined}
 */
Response.prototype.redirect = function redirect(arg1, arg2, arg3) {

    var self = this;
    var statusCode = 302;
    var finalUri;
    var redirectLocation;
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

    redirectLocation = url.format(finalUri);

    self.emit('redirect', redirectLocation);

    // now we're done constructing url, send the res
    self.send(statusCode, null, {
        Location: redirectLocation
    });

    // tell server to stop processing the handler stack.
    return (next(false));
};
