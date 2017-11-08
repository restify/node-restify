// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var http = require('http');
var sprintf = require('util').format;
var url = require('url');
var util = require('util');

var assert = require('assert-plus');
var mime = require('mime');
var errors = require('restify-errors');

var httpDate = require('./http_date');
var utils = require('./utils');

///--- Globals

var InternalServerError = errors.InternalServerError;

/**
 * @private
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
 * Patch Response object and extends with extra functionalities
 *
 * @private
 * @function patch
 * @param    {http.ServerResponse|http2.Http2ServerResponse} Response -
 *                                                           Server Response
 * @returns  {undefined} No return value
 */
function patch(Response) {
    /**
     * Wraps all of the node
     * [http.ServerResponse](https://nodejs.org/docs/latest/api/http.html)
     * APIs, events and properties, plus the following.
     * @class Response
     * @extends http.ServerResponse
     */

    /**
     * Sets the `cache-control` header.
     *
     * @public
     * @memberof Response
     * @instance
     * @function cache
     * @param    {String} [type="public"] - value of the header
     *                                    (`"public"` or `"private"`)
     * @param    {Object} [options] - an options object
     * @param    {Number} options.maxAge - max-age in seconds
     * @returns  {String}         the value set to the header
     */
    Response.prototype.cache = function cache(type, options) {
        if (typeof type !== 'string') {
            options = type;
            type = 'public';
        }

        if (options && options.maxAge !== undefined) {
            assert.number(options.maxAge, 'options.maxAge');
            type += ', max-age=' + options.maxAge;
        }

        return this.setHeader('Cache-Control', type);
    };

    /**
     * Turns off all cache related headers.
     *
     * @public
     * @memberof Response
     * @instance
     * @function noCache
     * @returns  {Response} self, the response object
     */
    Response.prototype.noCache = function noCache() {
        // HTTP 1.1
        this.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

        // HTTP 1.0
        this.setHeader('Pragma', 'no-cache');

        // Proxies
        this.setHeader('Expires', '0');

        return this;
    };

    /**
     * Appends the provided character set to the response's `Content-Type`.
     *
     * @public
     * @memberof Response
     * @instance
     * @function charSet
     * @param    {String} type - char-set value
     * @returns  {Response} self, the response object
     * @example
     * res.charSet('utf-8');
     */
    Response.prototype.charSet = function charSet(type) {
        assert.string(type, 'charset');

        this._charSet = type;

        return this;
    };

    /**
     * Retrieves a header off the response.
     *
     * @private
     * @memberof Response
     * @instance
     * @function get
     * @param    {Object} name - the header name
     * @returns  {String} header value
     */
    Response.prototype.get = function get(name) {
        assert.string(name, 'name');

        return this.getHeader(name);
    };

    // If getHeaders is not provided by the Node platform, monkey patch our own.
    // This is needed since versions of Node <7 did not come with a getHeaders.
    // For more see GH-1408
    if (typeof Response.prototype.getHeaders !== 'function') {
        /**
         * Retrieves all headers off the response.
         *
         * @private
         * @memberof Response
         * @instance
         * @function getHeaders
         * @returns  {Object} headers
         */
        Response.prototype.getHeaders = function getHeaders() {
            return this._headers || {};
        };
    }

    /**
     * Sets headers on the response.
     *
     * @public
     * @memberof Response
     * @instance
     * @function header
     * @param    {String} key - the name of the header
     * @param    {String} value - the value of the header
     * @returns  {Object} the retrieved value or the value that was set
     * @example
     * <caption>
     * If only key is specified, return the value of the header.
     * If both key and value are specified, set the response header.
     * </caption>
     * res.header('Content-Length');
     * // => undefined
     *
     * res.header('Content-Length', 123);
     * // => 123
     *
     * res.header('Content-Length');
     * // => 123
     *
     * res.header('foo', new Date());
     * // => Fri, 03 Feb 2012 20:09:58 GMT
     * @example
     * <caption>
     * `header()` can also be used to automatically chain header values
     * when applicable:
     * </caption>
     * res.header('x-foo', 'a');
     * res.header('x-foo', 'b');
     * // => { 'x-foo': ['a', 'b'] }
     * @example
     * <caption>
     * Note that certain headers like `set-cookie` and `content-type`
     * do not support multiple values, so calling `header()`
     * twice for those headers will
     * overwrite the existing value.
     * </caption>
     */
    Response.prototype.header = function header(key, value) {
        assert.string(key, 'name');

        if (value === undefined) {
            return this.getHeader(key);
        }

        if (value instanceof Date) {
            value = httpDate(value);
        } else if (arguments.length > 2) {
            // Support res.header('foo', 'bar %s', 'baz');
            var arg = Array.prototype.slice.call(arguments).slice(2);
            value = sprintf(value, arg);
        }

        var current = this.getHeader(key);

        // Check the header blacklist before changing a header to an array
        var keyLc = key.toLowerCase();

        if (current && !(keyLc in HEADER_ARRAY_BLACKLIST)) {
            if (Array.isArray(current)) {
                current.push(value);
                value = current;
            } else {
                value = [current, value];
            }
        }

        this.setHeader(key, value);
        return value;
    };

    /**
     * Syntatic sugar for:
     * ```js
     * res.contentType = 'json';
     * res.send({hello: 'world'});
     * ```
     *
     * @public
     * @memberof Response
     * @instance
     * @function json
     * @param    {Number} [code] -    http status code
     * @param    {Object} [body] -    value to json.stringify
     * @param    {Object} [headers] - headers to set on the response
     * @returns  {Object} the response object
     * @example
     * res.header('content-type', 'json');
     * res.send({hello: 'world'});
     */
    Response.prototype.json = function json(code, body, headers) {
        this.setHeader('Content-Type', 'application/json');
        return this.send(code, body, headers);
    };

    /**
     * Sets the link header.
     *
     * @public
     * @memberof Response
     * @instance
     * @function link
     * @param    {String} key -  the link key
     * @param    {String} value - the link value
     * @returns  {String}     the header value set to res
     */
    Response.prototype.link = function link(key, value) {
        assert.string(key, 'key');
        assert.string(value, 'value');

        var _link = sprintf('<%s>; rel="%s"', key, value);
        return this.header('Link', _link);
    };

    /**
     * Sends the response object. pass through to internal `__send` that uses a
     * formatter based on the `content-type` header.
     *
     * @public
     * @memberof Response
     * @instance
     * @function send
     * @param    {Number} [code] - http status code
     * @param    {Object | Buffer | Error} [body] - the content to send
     * @param    {Object} [headers] - any add'l headers to set
     * @returns  {Object} the response object
     * @example
     * <caption>
     * You can use send() to wrap up all the usual writeHead(), write(), end()
     * calls on the HTTP API of node.
     * You can pass send either a `code` and `body`, or just a body. body can be
     * an `Object`, a `Buffer`, or an `Error`.
     * When you call `send()`, restify figures out how to format the response
     * based on the `content-type`.
     * </caption>
     * res.send({hello: 'world'});
     * res.send(201, {hello: 'world'});
     * res.send(new BadRequestError('meh'));
     */
    Response.prototype.send = function send(code, body, headers) {
        var self = this;
        var args = Array.prototype.slice.call(arguments);
        args.push(true); // Append format = true to __send invocation
        return self.__send.apply(self, args);
    };

    /**
     * Like `res.send()`, but skips formatting. This can be useful when the
     * payload has already been preformatted.
     * Sends the response object. pass through to internal `__send` that skips
     * formatters entirely and sends the content as is.
     *
     * @public
     * @memberof Response
     * @instance
     * @function sendRaw
     * @param    {Number} [code] - http status code
     * @param    {Object | Buffer | Error} [body] - the content to send
     * @param    {Object} [headers] - any add'l headers to set
     * @returns  {Object} the response object
     */
    Response.prototype.sendRaw = function sendRaw(code, body, headers) {
        var self = this;
        var args = Array.prototype.slice.call(arguments);
        args.push(false); // Append format = false to __send invocation
        return self.__send.apply(self, args);
    };

    // eslint-disable-next-line jsdoc/check-param-names
    /**
     * Internal implementation of send. convenience method that handles:
     * writeHead(), write(), end().
     *
     * Both body and headers are optional, but you MUST provide body if you are
     * providing headers.
     *
     * @private
     * @param    {Number} [code] - http status code
     * @param    {Object | Buffer | String | Error} [body] - the content to send
     * @param    {Object} [headers] - any add'l headers to set
     * @param    {Boolean} [format] - When false, skip formatting
     * @returns  {Object} returns the response object
     */
    Response.prototype.__send = function __send() {
        var self = this;
        var isHead = self.req.method === 'HEAD';
        var log = self.log;
        var code, body, headers, format;

        // derive arguments from types, one by one
        var index = 0;
        // Check to see if the first argument is a status code
        if (typeof arguments[index] === 'number') {
            code = arguments[index++];
        }

        // Check to see if the next argument is a body
        if (
            typeof arguments[index] === 'object' ||
            typeof arguments[index] === 'string'
        ) {
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
        // if we reach this line and there are still arguments, either one of
        // the optional arguments was of an invalid type or we were provided
        // with too many arguments
        assert(
            arguments[index] === undefined,
            'Unknown argument: ' + arguments[index] + '\nProvided: ' + arguments
        );

        // Now lets try to derive values for optional arguments that we were not
        // provided, otherwise we choose sane defaults.

        // If the body is an error object and we were not given a status code,
        // try to derive it from the error object, otherwise default to 500
        if (!code && body instanceof Error) {
            code = body.statusCode || 500;
        }

        // Set sane defaults for optional arguments if they were not provided
        // and we failed to derive their values
        code = code || self.statusCode || 200;
        headers = headers || {};

        // Populate our response object with the derived arguments
        self.statusCode = code;
        self._body = body;
        Object.keys(headers).forEach(function forEach(k) {
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

        // 204 = No Content and 304 = Not Modified, we don't want to send the
        // body in these cases. HEAD never provides a body.
        if (isHead || code === 204 || code === 304) {
            return flush(self);
        }

        // if no formatting, assert that the value to be written is a string
        // or a buffer, then send it.
        if (format === false) {
            assert.ok(
                typeof body === 'string' || Buffer.isBuffer(body),
                'res.sendRaw() accepts only strings or buffers'
            );
            return flush(self, body);
        }

        // if no body, then no need to format. if this was an error caught by a
        // domain, don't send the domain error either.
        if (body === undefined || (body instanceof Error && body.domain)) {
            return flush(self);
        }

        // At this point we know we have a body that needs to be formatted, so
        // lets derive the formatter based on the response object's properties

        var formatter;
        var type = self.contentType || self.getHeader('Content-Type');

        // Set Content-Type to application/json when
        // res.send is called with an Object instead of calling res.json
        if (!type && typeof body === 'object' && !util.isBuffer(body)) {
            type = 'application/json';
        }

        // Derive type if not provided by the user
        type = type || self.req.accepts(self.acceptable);

        // Check to see if we can find a valid formatter
        if (!type) {
            return formatterError(
                self,
                new errors.NotAcceptableError({
                    message: 'could not find suitable formatter'
                })
            );
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

        // If after the above attempts we were still unable to derive a
        // formatter, provide a meaningful error message
        if (!formatter) {
            return formatterError(
                self,
                new errors.InternalServerError({
                    message:
                        'could not find formatter for application/octet-stream'
                })
            );
        }

        if (self._charSet) {
            type = type + '; charset=' + self._charSet;
        }

        // Update header to the derived content type for our formatter
        self.setHeader('Content-Type', type);

        // Finally, invoke the formatter and flush the request with it's results
        return flush(self, formatter(self.req, self, body));
    };

    /**
     * Sets multiple header(s) on the response.
     * Uses `header()` underneath the hood, enabling multi-value headers.
     *
     * @public
     * @memberof Response
     * @instance
     * @function set
     * @param    {String|Object} name - name of the header or
     *                                `Object` of headers
     * @param    {String} val - value of the header
     * @returns  {Object}      self, the response object
     * @example
     * res.header('x-foo', 'a');
     * res.set({
     *     'x-foo', 'b',
     *     'content-type': 'application/json'
     * });
     * // =>
     * // {
     * //    'x-foo': [ 'a', 'b' ],
     * //    'content-type': 'application/json'
     * // }
     */
    Response.prototype.set = function set(name, val) {
        var self = this;

        if (arguments.length === 2) {
            assert.string(
                name,
                'res.set(name, val) requires name to be a string'
            );
            this.header(name, val);
        } else {
            assert.object(
                name,
                'res.set(headers) requires headers to be an object'
            );
            Object.keys(name).forEach(function forEach(k) {
                self.set(k, name[k]);
            });
        }

        return this;
    };

    /**
     * Sets the http status code on the response.
     *
     * @public
     * @memberof Response
     * @instance
     * @function status
     * @param    {Number} code - http status code
     * @returns  {Number}        the status code passed in
     * @example
     * res.status(201);
     */
    Response.prototype.status = function status(code) {
        assert.number(code, 'code');

        this.statusCode = code;
        return code;
    };

    /**
     * toString() serialization.
     *
     * @private
     * @memberof Response
     * @instance
     * @function toString
     * @returns  {String} stringified response
     */
    Response.prototype.toString = function toString() {
        var headers = this.getHeaders();
        var headerString = '';
        var str;

        Object.keys(headers).forEach(function forEach(k) {
            headerString += k + ': ' + headers[k] + '\n';
        });
        str = sprintf(
            'HTTP/1.1 %s %s\n%s',
            this.statusCode,
            http.STATUS_CODES[this.statusCode],
            headerString
        );

        return str;
    };

    if (!Response.prototype.hasOwnProperty('_writeHead')) {
        Response.prototype._writeHead = Response.prototype.writeHead;
    }

    /**
     * Pass through to native response.writeHead()
     *
     * @private
     * @memberof Response
     * @instance
     * @function writeHead
     * @fires    header
     * @returns  {undefined} no return value
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

    /**
     * Redirect is sugar method for redirecting.
     * @public
     * @memberof Response
     * @instance
     * @param {Object} options url or an options object to configure a redirect
     * @param {Boolean} [options.secure] whether to redirect to http or https
     * @param {String} [options.hostname] redirect location's hostname
     * @param {String} [options.pathname] redirect location's pathname
     * @param {String} [options.port] redirect location's port number
     * @param {String} [options.query] redirect location's query string
     *                                 parameters
     * @param {Boolean} [options.overrideQuery] if true, `options.query`
     *                                          stomps over any existing query
     *                                          parameters on current URL.
     *                                          by default, will merge the two.
     * @param {Boolean} [options.permanent] if true, sets 301. defaults to 302.
     * @param {Function} next mandatory, to complete the response and trigger
     *                        audit logger.
     * @fires    redirect
     * @function redirect
     * @returns  {undefined}
     * @example
     * res.redirect({...}, next);
     * @example
     * <caption>
     * A convenience method for 301/302 redirects. Using this method will tell
     * restify to stop execution of your handler chain.
     * You can also use an options object. `next` is required.
     * </caption>
     * res.redirect({
     *   hostname: 'www.foo.com',
     *   pathname: '/bar',
     *   port: 80,                 // defaults to 80
     *   secure: true,             // sets https
     *   permanent: true,
     *   query: {
     *     a: 1
     *   }
     * }, next);  // => redirects to 301 https://www.foo.com/bar?a=1
     */

    /**
     * Redirect with code and url.
     * @memberof Response
     * @instance
     * @param {Number} code http redirect status code
     * @param {String} url redirect url
     * @param {Function} next mandatory, to complete the response and trigger
     *                        audit logger.
     * @fires    redirect
     * @function redirect
     * @returns  {undefined}
     * @example
     * res.redirect(301, 'www.foo.com', next);
     */

    /**
     * Redirect with url.
     * @public
     * @memberof Response
     * @instance
     * @param {String} url redirect url
     * @param {Function} next mandatory, to complete the response and trigger
     *                        audit logger.
     * @fires    redirect
     * @function redirect
     * @returns  {undefined}
     * @example
     * res.redirect('www.foo.com', next);
     * res.redirect('/foo', next);
     */
    Response.prototype.redirect = redirect;

    /**
     * @private
     * @param {*} arg1 - arg1
     * @param {*} arg2 - arg2
     * @param {*} arg3 - arg3
     * @fires    redirect
     * @function redirect
     * @returns  {undefined} no return value
     */
    function redirect(arg1, arg2, arg3) {
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
        } else if (typeof arg1 === 'string') {
            // 2) this is signaure number 2
            // otherwise, it's a string, and use it directly
            finalUri = arg1;
            next = arg2;
        } else if (typeof arg1 === 'object') {
            // 3) signature number 3, using an options object.
            // set next, then go to work.
            next = arg2;

            var req = self.req;
            var opt = arg1 || {};
            var currentFullPath = req.href();
            var secure = opt.hasOwnProperty('secure')
                ? opt.secure
                : req.isSecure();

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
            // start with the host
            if (opt.hostname) {
                finalUri.hostname = opt.hostname;
            }

            // then set protocol IFF hostname is set - otherwise we end up with
            // malformed URL.
            if (finalUri.hostname) {
                finalUri.protocol = secure === true ? 'https' : 'http';
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
            return next(new InternalServerError('could not construct url'));
        }

        redirectLocation = url.format(finalUri);

        self.emit('redirect', redirectLocation);

        // now we're done constructing url, send the res
        self.send(statusCode, null, {
            Location: redirectLocation
        });

        // tell server to stop processing the handler stack.
        return next(false);
    }
}

/**
 * Flush takes our constructed response object and sends it to the client
 *
 * @private
 * @function flush
 * @param {Response} res - response
 * @param {String|Buffer} formattedBody - formatted body
 * @returns {Response} response
 */
function flush(res, formattedBody) {
    res._data = formattedBody;

    // Flush headers
    res.writeHead(res.statusCode);

    // Send body if it was provided
    if (res._data) {
        res.write(res._data);
    }

    // Finish resuest
    res.end();

    // If log level is set to trace, log the entire response object
    if (res.log.trace()) {
        res.log.trace({ res: res }, 'response sent');
    }

    // Return the response object back out to the caller of __send
    return res;
}

/**
 * formatterError is used to handle any case where we were unable to
 * properly format the provided body
 *
 * @private
 * @function formatterError
 * @param {Response} res - response
 * @param {Error} err - error
 * @returns {Response} response
 */
function formatterError(res, err) {
    // If the user provided a non-success error code, we don't want to
    // mess with it since their error is probably more important than
    // our inability to format their message.
    if (res.statusCode >= 200 && res.statusCode < 300) {
        res.statusCode = err.statusCode;
    }

    res.log.warn(
        {
            req: res.req,
            err: err
        },
        'error retrieving formatter'
    );

    return flush(res);
}

module.exports = patch;
