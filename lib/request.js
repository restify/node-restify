// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var url = require('url');
var sprintf = require('util').format;

var assert = require('assert-plus');
var mime = require('mime');
var Negotiator = require('negotiator');
var uuid = require('uuid');

var dtrace = require('./dtrace');

///-- Helpers
/**
 * Creates and sets negotiator on request if one doesn't already exist,
 * then returns it.
 *
 * @private
 * @function negotiator
 * @param    {Object} req - the request object
 * @returns  {Object}     a negotiator
 */
function negotiator(req) {
    var h = req.headers;

    if (!req._negotiator) {
        req._negotiator = new Negotiator({
            headers: {
                accept: h.accept || '*/*',
                'accept-encoding': h['accept-encoding'] || 'identity'
            }
        });
    }

    return req._negotiator;
}

///--- API

/**
 * Patch Request object and extends with extra functionalities
 *
 * @private
 * @function patch
 * @param    {http.IncomingMessage|http2.Http2ServerRequest} Request -
 *                                                           Server Request
 * @returns  {undefined} No return value
 */
function patch(Request) {
    /**
     * Wraps all of the node
     * [http.IncomingMessage](https://nodejs.org/api/http.html)
     * APIs, events and properties, plus the following.
     * @class Request
     * @extends http.IncomingMessage
     */

    ///--- Patches

    /**
     * Builds an absolute URI for the request.
     *
     * @private
     * @memberof Request
     * @instance
     * @function absoluteUri
     * @param    {String} path - a url path
     * @returns  {String} uri
     */
    Request.prototype.absoluteUri = function absoluteUri(path) {
        assert.string(path, 'path');

        var protocol = this.isSecure() ? 'https://' : 'http://';
        var hostname = this.headers.host;
        return url.resolve(protocol + hostname + this.path() + '/', path);
    };

    /**
     * Check if the Accept header is present, and includes the given type.
     * When the Accept header is not present true is returned.
     * Otherwise the given type is matched by an exact match, and then subtypes.
     *
     * @public
     * @memberof Request
     * @instance
     * @function accepts
     * @param    {String | String[]} types - an array of accept type headers
     * @returns  {Boolean} is accepteed
     * @example
     * <caption>
     * You may pass the subtype such as html which is then converted internally
     * to text/html using the mime lookup table:
     * </caption>
     * // Accept: text/html
     * req.accepts('html');
     * // => true
     *
     * // Accept: text/*; application/json
     * req.accepts('html');
     * req.accepts('text/html');
     * req.accepts('text/plain');
     * req.accepts('application/json');
     * // => true
     *
     * req.accepts('image/png');
     * req.accepts('png');
     * // => false
     */
    Request.prototype.accepts = function accepts(types) {
        if (typeof types === 'string') {
            types = [types];
        }

        types = types.map(function map(t) {
            assert.string(t, 'type');

            if (t.indexOf('/') === -1) {
                t = mime.getType(t);
            }
            return t;
        });

        negotiator(this);

        return this._negotiator.preferredMediaType(types);
    };

    /**
     * Checks if the request accepts the encoding type(s) specified.
     *
     * @public
     * @memberof Request
     * @instance
     * @function acceptsEncoding
     * @param    {String | String[]} types - an array of accept type headers
     * @returns  {Boolean} is accepted encoding
     */
    Request.prototype.acceptsEncoding = function acceptsEncoding(types) {
        if (typeof types === 'string') {
            types = [types];
        }

        assert.arrayOfString(types, 'types');

        negotiator(this);

        return this._negotiator.preferredEncoding(types);
    };

    /**
     * Returns the value of the content-length header.
     *
     * @private
     * @memberof Request
     * @instance
     * @function getContentLength
     * @returns {Number} content length
     */
    Request.prototype.getContentLength = function getContentLength() {
        if (this._clen !== undefined) {
            return this._clen === false ? undefined : this._clen;
        }

        // We should not attempt to read and parse the body of an
        // Upgrade request, so force Content-Length to zero:
        if (this.isUpgradeRequest()) {
            return 0;
        }

        var len = this.header('content-length');

        if (!len) {
            this._clen = false;
        } else {
            this._clen = parseInt(len, 10);
        }

        return this._clen === false ? undefined : this._clen;
    };
    /**
     * Returns the value of the content-length header.
     * @public
     * @memberof Request
     * @instance
     * @function contentLength
     * @returns {Number}
     */
    Request.prototype.contentLength = Request.prototype.getContentLength;

    /**
     * Returns the value of the content-type header. If a content-type is not
     * set, this will return a default value of `application/octet-stream`.
     *
     * @private
     * @memberof Request
     * @instance
     * @function getContentType
     * @returns {String} content type
     */
    Request.prototype.getContentType = function getContentType() {
        if (this._contentType !== undefined) {
            return this._contentType;
        }

        var index;
        var type = this.headers['content-type'];

        if (!type) {
            // RFC2616 section 7.2.1
            this._contentType = 'application/octet-stream';
        } else if ((index = type.indexOf(';')) === -1) {
            this._contentType = type;
        } else {
            this._contentType = type.substring(0, index);
        }

        // #877 content-types need to be case insensitive.
        this._contentType = this._contentType.toLowerCase();

        return this._contentType;
    };

    /**
     * Returns the value of the content-type header. If a content-type is not
     * set, this will return a default value of `application/octet-stream`
     * @public
     * @memberof Request
     * @instance
     * @function getContentType
     * @returns {String} content type
     */
    Request.prototype.contentType = Request.prototype.getContentType;

    /**
     * Returns a Date object representing when the request was setup.
     * Like `time()`, but returns a Date object.
     *
     * @public
     * @memberof Request
     * @instance
     * @function date
     * @returns  {Date} date when request began being processed
     */
    Request.prototype.date = function date() {
        return this._date;
    };

    /**
     * Retrieves the complete URI requested by the client.
     *
     * @private
     * @memberof Request
     * @instance
     * @function getHref
     * @returns {String} URI
     */
    Request.prototype.getHref = function getHref() {
        return this.getUrl().href;
    };

    /**
     * Returns the full requested URL.
     * @public
     * @memberof Request
     * @instance
     * @function href
     * @returns {String}
     * @example
     * // incoming request is http://localhost:3000/foo/bar?a=1
     * server.get('/:x/bar', function(req, res, next) {
     *     console.warn(req.href());
     *     // => /foo/bar/?a=1
     * });
     */
    Request.prototype.href = Request.prototype.getHref;

    /**
     * Retrieves the request uuid. was created when the request was setup.
     *
     * @private
     * @memberof Request
     * @instance
     * @function getId
     * @returns  {String} id
     */
    Request.prototype.getId = function getId() {
        if (this._id !== undefined) {
            return this._id;
        }

        this._id = uuid.v4();

        return this._id;
    };

    /**
     * Returns the request id. If a `reqId` value is passed in,
     * this will become the request’s new id. The request id is immutable,
     * and can only be set once. Attempting to set the request id more than
     * once will cause restify to throw.
     *
     * @public
     * @memberof Request
     * @instance
     * @function id
     * @param {String} reqId - request id
     * @returns {String} id
     */
    Request.prototype.id = function id(reqId) {
        var self = this;

        if (reqId) {
            if (self._id) {
                throw new Error(
                    'request id is immutable, cannot be set again!'
                );
            } else {
                assert.string(reqId, 'reqId');
                self._id = reqId;
                return self._id;
            }
        }

        return self.getId();
    };

    /**
     * Retrieves the cleaned up url path.
     * e.g., /foo?a=1  =>  /foo
     *
     * @private
     * @memberof Request
     * @instance
     * @function getPath
     * @returns  {String} path
     */
    Request.prototype.getPath = function getPath() {
        return this.getUrl().pathname;
    };

    /**
     * Returns the cleaned up requested URL.
     * @public
     * @memberof Request
     * @instance
     * @function getPath
     * @returns  {String}
     * @example
     * // incoming request is http://localhost:3000/foo/bar?a=1
     * server.get('/:x/bar', function(req, res, next) {
     *     console.warn(req.path());
     *     // => /foo/bar
     * });
     */
    Request.prototype.path = Request.prototype.getPath;

    /**
     * Returns the raw query string. Returns empty string
     * if no query string is found.
     *
     * @public
     * @memberof Request
     * @instance
     * @function getQuery
     * @returns  {String} query
     * @example
     * // incoming request is /foo?a=1
     * req.getQuery();
     * // => 'a=1'
     * @example
     * <caption>
     * If the queryParser plugin is used, the parsed query string is
     * available under the req.query:
     * </caption>
     * // incoming request is /foo?a=1
     * server.use(restify.plugins.queryParser());
     * req.query;
     * // => { a: 1 }
     */
    Request.prototype.getQuery = function getQuery() {
        // always return a string, because this is the raw query string.
        // if the queryParser plugin is used, req.query will provide an empty
        // object fallback.
        return this.getUrl().query || '';
    };

    /**
     * Returns the raw query string. Returns empty string
     * if no query string is found
     * @private
     * @memberof Request
     * @instance
     * @function query
     * @returns  {String}
     */
    Request.prototype.query = Request.prototype.getQuery;

    /**
     * The number of ms since epoch of when this request began being processed.
     * Like date(), but returns a number.
     *
     * @public
     * @memberof Request
     * @instance
     * @function time
     * @returns  {Number} time when request began being processed in epoch:
     *                    ellapsed milliseconds since
     *                    January 1, 1970, 00:00:00 UTC
     */
    Request.prototype.time = function time() {
        return this._date.getTime();
    };

    /**
     * returns a parsed URL object.
     *
     * @private
     * @memberof Request
     * @instance
     * @function getUrl
     * @returns  {Object} url
     */
    Request.prototype.getUrl = function getUrl() {
        if (this._cacheURL !== this.url) {
            this._url = url.parse(this.url);
            this._cacheURL = this.url;
        }
        return this._url;
    };

    /**
     * Returns the accept-version header.
     *
     * @private
     * @memberof Request
     * @instance
     * @function getVersion
     * @returns  {String} version
     */
    Request.prototype.getVersion = function getVersion() {
        if (this._version !== undefined) {
            return this._version;
        }

        this._version =
            this.headers['accept-version'] ||
            this.headers['x-api-version'] ||
            '*';

        return this._version;
    };

    /**
     * Returns the accept-version header.
     * @public
     * @memberof Request
     * @instance
     * @function version
     * @returns  {String}
     */
    Request.prototype.version = Request.prototype.getVersion;

    /**
     * Returns the version of the route that matched.
     *
     * @private
     * @memberof Request
     * @instance
     * @function matchedVersion
     * @returns {String} version
     */
    Request.prototype.matchedVersion = function matchedVersion() {
        if (this._matchedVersion !== undefined) {
            return this._matchedVersion;
        } else {
            return this.version();
        }
    };

    /**
     * Get the case-insensitive request header key,
     * and optionally provide a default value (express-compliant).
     * Returns any header off the request. also, 'correct' any
     * correctly spelled 'referrer' header to the actual spelling used.
     *
     * @public
     * @memberof Request
     * @instance
     * @function header
     * @param    {String} key - the key of the header
     * @param    {String} [defaultValue] - default value if header isn't
     *                                   found on the req
     * @returns  {String} header value
     * @example
     * req.header('Host');
     * req.header('HOST');
     * req.header('Accept', '*\/*');
     */
    Request.prototype.header = function header(key, defaultValue) {
        assert.string(key, 'key');

        key = key.toLowerCase();

        if (key === 'referer' || key === 'referrer') {
            key = 'referer';
        }

        return this.headers[key] || defaultValue;
    };

    /**
     * Returns any trailer header off the request. Also, 'correct' any
     * correctly spelled 'referrer' header to the actual spelling used.
     *
     * @public
     * @memberof Request
     * @instance
     * @function trailer
     * @param    {String} name - the name of the header
     * @param    {String} value - default value if header isn't found on the req
     * @returns  {String} trailer value
     */
    Request.prototype.trailer = function trailer(name, value) {
        assert.string(name, 'name');
        name = name.toLowerCase();

        if (name === 'referer' || name === 'referrer') {
            name = 'referer';
        }

        return (this.trailers || {})[name] || value;
    };

    /**
     * Check if the incoming request contains the `Content-Type` header field,
     * and if it contains the given mime type.
     *
     * @public
     * @memberof Request
     * @instance
     * @function is
     * @param    {String} type - a content-type header value
     * @returns  {Boolean} is content-type header
     * @example
     * // With Content-Type: text/html; charset=utf-8
     * req.is('html');
     * req.is('text/html');
     * // => true
     *
     * // When Content-Type is application/json
     * req.is('json');
     * req.is('application/json');
     * // => true
     *
     * req.is('html');
     * // => false
     */
    Request.prototype.is = function is(type) {
        assert.string(type, 'type');

        var contentType = this.getContentType();
        var matches = true;

        if (!contentType) {
            return false;
        }

        if (type.indexOf('/') === -1) {
            type = mime.getType(type);
        }

        if (type.indexOf('*') !== -1) {
            type = type.split('/');
            contentType = contentType.split('/');
            matches &= type[0] === '*' || type[0] === contentType[0];
            matches &= type[1] === '*' || type[1] === contentType[1];
        } else {
            matches = contentType === type;
        }

        return matches;
    };

    /**
     * Check if the incoming request is chunked.
     *
     * @public
     * @memberof Request
     * @instance
     * @function isChunked
     * @returns  {Boolean} is chunked
     */
    Request.prototype.isChunked = function isChunked() {
        return this.headers['transfer-encoding'] === 'chunked';
    };

    /**
     * Check if the incoming request is kept alive.
     *
     * @public
     * @memberof Request
     * @instance
     * @function isKeepAlive
     * @returns  {Boolean} is keep alive
     */
    Request.prototype.isKeepAlive = function isKeepAlive() {
        if (this._keepAlive !== undefined) {
            return this._keepAlive;
        }

        if (this.headers.connection) {
            this._keepAlive = /keep-alive/i.test(this.headers.connection);
        } else {
            this._keepAlive = this.httpVersion === '1.0' ? false : true;
        }

        return this._keepAlive;
    };

    /**
     * Check if the incoming request is encrypted.
     *
     * @public
     * @memberof Request
     * @instance
     * @function isSecure
     * @returns  {Boolean} is secure
     */
    Request.prototype.isSecure = function isSecure() {
        if (this._secure !== undefined) {
            return this._secure;
        }

        this._secure = this.connection.encrypted ? true : false;
        return this._secure;
    };

    /**
     * Check if the incoming request has been upgraded.
     *
     * @public
     * @memberof Request
     * @instance
     * @function isUpgradeRequest
     * @returns  {Boolean} is upgraded
     */
    Request.prototype.isUpgradeRequest = function isUpgradeRequest() {
        if (this._upgradeRequest !== undefined) {
            return this._upgradeRequest;
        } else {
            return false;
        }
    };

    /**
     * Check if the incoming request is an upload verb.
     *
     * @public
     * @memberof Request
     * @instance
     * @function isUpload
     * @returns  {Boolean} is upload
     */
    Request.prototype.isUpload = function isUpload() {
        var m = this.method;
        return m === 'PATCH' || m === 'POST' || m === 'PUT';
    };

    /**
     * toString serialization
     *
     * @public
     * @memberof Request
     * @instance
     * @function toString
     * @returns  {String} serialized request
     */
    Request.prototype.toString = function toString() {
        var headers = '';
        var self = this;
        var str;

        Object.keys(this.headers).forEach(function forEach(k) {
            headers += sprintf('%s: %s\n', k, self.headers[k]);
        });

        str = sprintf(
            '%s %s HTTP/%s\n%s',
            this.method,
            this.url,
            this.httpVersion,
            headers
        );

        return str;
    };

    /**
     * Returns the user-agent header.
     *
     * @public
     * @memberof Request
     * @instance
     * @function userAgent
     * @returns  {String} user agent
     */
    Request.prototype.userAgent = function userAgent() {
        return this.headers['user-agent'];
    };

    /**
     * Start the timer for a request handler.
     * By default, restify uses calls this automatically for all handlers
     * registered in your handler chain.
     * However, this can be called manually for nested functions inside the
     * handler chain to record timing information.
     *
     * @public
     * @memberof Request
     * @instance
     * @function startHandlerTimer
     * @param    {String}    handlerName - The name of the handler.
     * @returns  {undefined} no return value
     * @example
     * <caption>
     * You must explicitly invoke
     * endHandlerTimer() after invoking this function. Otherwise timing
     * information will be inaccurate.
     * </caption>
     * server.get('/', function fooHandler(req, res, next) {
     *     vasync.pipeline({
     *         funcs: [
     *             function nestedHandler1(req, res, next) {
     *                 req.startHandlerTimer('nestedHandler1');
     *                 // do something
     *                 req.endHandlerTimer('nestedHandler1');
     *                 return next();
     *             },
     *             function nestedHandler1(req, res, next) {
     *                 req.startHandlerTimer('nestedHandler2');
     *                 // do something
     *                 req.endHandlerTimer('nestedHandler2');
     *                 return next();
     *
     *             }...
     *        ]...
     *     }, next);
     * });
     */
    Request.prototype.startHandlerTimer = function startHandlerTimer(
        handlerName
    ) {
        var self = this;

        // For nested handlers, we prepend the top level handler func name
        var name =
            self._currentHandler === handlerName
                ? handlerName
                : self._currentHandler + '-' + handlerName;

        if (!self._timerMap) {
            self._timerMap = {};
        }

        self._timerMap[name] = process.hrtime();

        if (self.dtrace) {
            dtrace._rstfy_probes['handler-start'].fire(function fire() {
                return [
                    self.serverName,
                    self._currentRoute, // set in server._run
                    name,
                    self._dtraceId
                ];
            });
        }
    };

    /**
     * End the timer for a request handler.
     * You must invoke this function if you called `startRequestHandler` on a
     * handler. Otherwise the time recorded will be incorrect.
     *
     * @public
     * @memberof Request
     * @instance
     * @function endHandlerTimer
     * @param    {String}    handlerName - The name of the handler.
     * @returns  {undefined} no return value
     */
    Request.prototype.endHandlerTimer = function endHandlerTimer(handlerName) {
        var self = this;

        // For nested handlers, we prepend the top level handler func name
        var name =
            self._currentHandler === handlerName
                ? handlerName
                : self._currentHandler + '-' + handlerName;

        if (!self.timers) {
            self.timers = [];
        }

        self._timerMap[name] = process.hrtime(self._timerMap[name]);
        self.timers.push({
            name: name,
            time: self._timerMap[name]
        });

        if (self.dtrace) {
            dtrace._rstfy_probes['handler-done'].fire(function fire() {
                return [
                    self.serverName,
                    self._currentRoute, // set in server._run
                    name,
                    self._dtraceId
                ];
            });
        }
    };

    /**
     * Returns the connection state of the request. Current possible values are:
     * - `close` - when the request has been closed by the clien
     *
     * @public
     * @memberof Request
     * @instance
     * @function connectionState
     * @returns {String} connection state (`"close"`)
     */
    Request.prototype.connectionState = function connectionState() {
        var self = this;
        return self._connectionState;
    };

    /**
     * Returns the route object to which the current request was matched to.
     *
     * @public
     * @memberof Request
     * @instance
     * @function getRoute
     * @returns {Object} route
     * @example
     * <caption>Route info object structure:</caption>
     * {
     *  path: '/ping/:name',
     *  method: 'GET',
     *  versions: [],
     *  name: 'getpingname'
     * }
     */
    Request.prototype.getRoute = function getRoute() {
        var self = this;
        return self.route;
    };
}

module.exports = patch;
