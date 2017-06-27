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
 * @param    {Number} [code] http status code
 * @param    {Object | Buffer | Error} [body] the content to send
 * @param    {Object} [headers]  any add'l headers to set
 * @returns  {Object} the response object
 */
Response.prototype.send = function send(code, body, headers) {
    var self = this;
    var args = Array.prototype.slice.call(arguments);
    args.push(true); // Append format = true to __send invocation
    return self.__send.apply(self, args);
};


/**
 * sends the response object. pass through to internal __send that skips
 * formatters entirely and sends the content as is.
 * @public
 * @function sendRaw
 * @param    {Number} [code] http status code
 * @param    {Object | Buffer | Error} [body] the content to send
 * @param    {Object} [headers]  any add'l headers to set
 * @returns  {Object} the response object
 */
Response.prototype.sendRaw = function sendRaw(code, body, headers) {
    var self = this;
    var args = Array.prototype.slice.call(arguments);
    args.push(false); // Append format = false to __send invocation
    return self.__send.apply(self, args);
};


/**
 * internal implementation of send. convenience method that handles:
 * writeHead(), write(), end().
 *
 * Both body and headers are optional, but you MUST provide body if you are
 * providing headers.
 *
 * @private
 * @private
 * @param    {Number} [code] http status code
 * @param    {Object | Buffer | String | Error} [body] the content to send
 * @param    {Object} [headers] any add'l headers to set
 * @param    {Boolean} [format] When false, skip formatting
 * @returns  {Object} returns the response object
 */
Response.prototype.__send = function __send() {
    var self = this;
    var isHead = (self.req.method === 'HEAD');
    var log = self.log;
    var code, body, headers, format;

    // derive arguments from types, one by one
    var index = 0;
    // Check to see if the first argument is a status code
    if (typeof arguments[index] === 'number') {
        code = arguments[index++];
    }

    // Check to see if the next argument is a body
    if (typeof arguments[index] === 'object' ||
        typeof arguments[index] === 'string') {
        body = arguments[index++];
    }

    // Check to see if the next argument is a collection of headers
    if (typeof arguments[index] === 'object') {
        headers = arguments[index++];
    }

    // Check to see if the next argument is the format boolean
    if (typeof arguments[index] === 'boolean') {
        format = arguments[index++];
    }

    // Ensure the function was provided with arguments of the proper types,
    // if we reach this line and there are still arguments, either one of the
    // optional arguments was of an invalid type or we were provided with
    // too many arguments
    assert(arguments[index] === undefined,
      'Unknown argument: ' + arguments[index] + '\nProvided: ' + arguments);

    // Now lets try to derive values for optional arguments that we were not
    // provided, otherwise we choose sane defaults.

    // If the body is an error object and we were not given a status code, try
    // to derive it from the error object, otherwise default to 500
    if (!code && body instanceof Error) {
        code = body.statusCode || 500;
    }

    // Set sane defaults for optional arguments if they were not provided and
    // we failed to derive their values
    code = code || 200;
    headers = headers || {};

    // Populate our response object with the derived arguments
    self.statusCode = code;
    self._body = body;
    Object.keys(headers).forEach(function (k) {
        self.setHeader(k, headers[k]);
    });

    // If log level is set to trace, output our constructed response object
    if (log.trace()) {
        var _props = {
            code: self.statusCode,
            headers: self._headers
        };

        if (body instanceof Error) {
            _props.err = self._body;
        } else {
            _props.body = self._body;
        }
        log.trace(_props, 'response::send entered');
    }

    // Flush takes our constructed response object and sends it to the client
    function _flush(formattedBody) {
        self._data = formattedBody;

        // Flush headers
        self.writeHead(self.statusCode);

        // Send body if it was provided
        if (self._data) {
            self.write(self._data);
        }

        // Finish request
        self.end();

        // If log level is set to trace, log the entire response object
        if (log.trace()) {
            log.trace({res: self}, 'response sent');
        }

        // Return the response object back out to the caller of __send
        return self;
    }

    // 204 = No Content and 304 = Not Modified, we don't want to send the
    // body in these cases. HEAD never provides a body.
    if (isHead || code === 204 || code === 304) {
        return _flush();
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
    if (body === undefined || (body instanceof Error && body.domain)) {
        return _flush();
    }

    // At this point we know we have a body that needs to be formatted, so lets
    // derive the formatter based on the response object's properties

    // _formatterError is used to handle any case where we were unable to
    // properly format the provided body
    function _formatterError(err) {
        // If the user provided a non-success error code, we don't want to mess
        // with it since their error is probably more important than our
        // inability to format their message.
        if (self.statusCode >= 200 && self.statusCode < 300) {
            self.statusCode = err.statusCode;
        }

        log.warn({
            req: self.req,
            err: err
        }, 'error retrieving formatter');

        return _flush();
    }

    var formatter;
    var type = self.contentType || self.getHeader('Content-Type');

    // Check to see if we can find a valid formatter
    if (!type && !self.req.accepts(self.acceptable)) {
        return _formatterError(new errors.NotAcceptableError({
            message: 'could not find suitable formatter'
        }));
    }

    // Derive type if not provided by the user
    if (!type) {
        type = self.req.accepts(self.acceptable);
    }

    type = type.split(';')[0];

    if (!self.formatters[type] && type.indexOf('/') === -1) {
        type = mime.lookup(type);
    }

    // If we were unable to derive a valid type, default to treating it as
    // arbitrary binary data per RFC 2046 Section 4.5.1
    if (!self.formatters[type] && self.acceptable.indexOf(type) === -1) {
        type = 'application/octet-stream';
    }

    formatter = self.formatters[type] || self.formatters['*/*'];

    // If after the above attempts we were still unable to derive a formatter,
    // provide a meaningful error message
    if (!formatter) {
        return _formatterError(new errors.InternalServerError({
            message: 'could not find formatter for application/octet-stream'
        }));
    }

    if (self._charSet) {
        type = type + '; charset=' + self._charSet;
    }

    // Update header to the derived content type for our formatter
    self.setHeader('Content-Type', type);

    // Finally, invoke the formatter and flush the request with it's results
    return _flush(formatter(self.req, self, body));
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

    redirectLocation = url.format(finalUri);

    self.emit('redirect', redirectLocation);

    // now we're done constructing url, send the res
    self.send(statusCode, null, {
        Location: redirectLocation
    });

    // tell server to stop processing the handler stack.
    return (next(false));
};
