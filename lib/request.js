// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var http = require('http');
var url = require('url');
var sprintf = require('util').format;

var assert = require('assert-plus');
var mime = require('mime');
var Negotatior = require('negotiator');
var uuid = require('uuid');

var dtrace = require('./dtrace');


///--- Globals

var Request = http.IncomingMessage;


///-- Helpers
/**
 * creates and sets negotiator on request if one doesn't already exist,
 * then returns it.
 * @private
 * @function negotiator
 * @param    {Object} req the request object
 * @returns  {Object}     a negotiator
 */
function negotiator(req) {
    var h = req.headers;

    if (!req._negotatiator) {
        req._negotiator = new Negotatior({
            headers: {
                accept: h.accept || '*/*',
                'accept-encoding': h['accept-encoding'] ||
                    'identity'
            }
        });
    }

    return (req._negotiator);
}


///--- API

///--- Patches

/**
 * builds an absolute URI for the request.
 * @private
 * @function absoluteUri
 * @param    {String} path a url path
 * @returns  {String}
 */
Request.prototype.absoluteUri = function absoluteUri(path) {
    assert.string(path, 'path');

    var protocol = this.secure ? 'https://' : 'http://';
    var hostname = this.headers.host;
    return (url.resolve(protocol + hostname + this.path() + '/', path));
};


/**
 * checks if the accept header is present and has the value requested.
 * e.g., req.accepts('html');
 * @public
 * @function accepts
 * @param    {String | Array} types an array of accept type headers
 * @returns  {Boolean}
 */
Request.prototype.accepts = function accepts(types) {
    if (typeof (types) === 'string') {
        types = [types];
    }

    types = types.map(function (t) {
        assert.string(t, 'type');

        if (t.indexOf('/') === -1) {
            t = mime.lookup(t);
        }
        return (t);
    });

    negotiator(this);

    return (this._negotiator.preferredMediaType(types));
};


/**
 * checks if the request accepts the encoding types.
 * @public
 * @function acceptsEncoding
 * @param    {String | Array} types an array of accept type headers
 * @returns  {Boolean}
 */
Request.prototype.acceptsEncoding = function acceptsEncoding(types) {
    if (typeof (types) === 'string') {
        types = [types];
    }

    assert.arrayOfString(types, 'types');

    negotiator(this);

    return (this._negotiator.preferredEncoding(types));
};


/**
 * gets the content-length header off the request.
 * @public
 * @function getContentLength
 * @returns {Number}
 */
Request.prototype.getContentLength = function getContentLength() {
    if (this._clen !== undefined) {
        return (this._clen === false ? undefined : this._clen);
    }

    // We should not attempt to read and parse the body of an
    // Upgrade request, so force Content-Length to zero:
    if (this.isUpgradeRequest()) {
        return (0);
    }

    var len = this.header('content-length');

    if (!len) {
        this._clen = false;
    } else {
        this._clen = parseInt(len, 10);
    }

    return (this._clen === false ? undefined : this._clen);
};
/**
 * pass through to getContentLength
 * @public
 * @function contentLength
 * @returns {Number}
 */
Request.prototype.contentLength = Request.prototype.getContentLength;


/**
 * gets the content-type header.
 * @public
 * @function getContentType
 * @returns {String}
 */
Request.prototype.getContentType = function getContentType() {
    if (this._contentType !== undefined) {
        return (this._contentType);
    }

    var index;
    var type = this.headers['content-type'];

    if (!type) {
        // RFC2616 section 7.2.1
        this._contentType = 'application/octet-stream';
    } else {
        if ((index = type.indexOf(';')) === -1) {
            this._contentType = type;
        } else {
            this._contentType = type.substring(0, index);
        }
    }

    // #877 content-types need to be case insensitive.
    this._contentType = this._contentType.toLowerCase();

    return (this._contentType);
};
Request.prototype.contentType = Request.prototype.getContentType;


/**
 * gets the _date property off the request. was created when the request
 * was setup.
 * @private
 * @function date
 * @returns  {Date}
 */
Request.prototype.date = function date() {
    if (this._date !== undefined) {
        return (this._date);
    }

    this._date = new Date(this._time);
    return (this._date);
};


/**
 * retrieves the complete URI requested by the client.
 * @public
 * @function getHref
 * @returns {String}
 */
Request.prototype.getHref = function getHref() {
    return (this.getUrl().href);
};
Request.prototype.href = Request.prototype.getHref;


/**
 * retrieves the request uuid. was created when the request was setup.
 * @public
 * @function getId
 * @returns  {String}
 */
Request.prototype.getId = function getId() {
    if (this._id !== undefined) {
        return (this._id);
    }

    this._id = this.headers['request-id'] ||
        this.headers['x-request-id'] ||
        uuid.v4();

    return (this._id);
};
Request.prototype.id = Request.prototype.getId;


/**
 * retrieves the cleaned up url path.
 * e.g., /foo?a=1  =>  /foo
 * @public
 * @function getPath
 * @returns  {String}
 */
Request.prototype.getPath = function getPath() {
    return (this.getUrl().pathname);
};
Request.prototype.path = Request.prototype.getPath;


/**
 * returns the raw query string
 * @public
 * @function getQuery
 * @returns  {String}
 */
Request.prototype.getQuery = function getQuery() {
    // always return a string, because this is the raw query string.
    // if the queryParser plugin is used, req.query will provide an empty
    // object fallback.
    return (this.getUrl().query || '');
};
Request.prototype.query = Request.prototype.getQuery;


/**
 * returns ms since epoch when request was setup.
 * @public
 * @function time
 * @returns  {Number}
 */
Request.prototype.time = function time() {
    return (this._time);
};


/**
 * returns a parsed URL object.
 * @public
 * @function getUrl
 * @returns  {Object}
 */
Request.prototype.getUrl = function getUrl() {
    if (this._cacheURL !== this.url) {
        this._url = url.parse(this.url);
        this._cacheURL = this.url;
    }
    return (this._url);
};


/**
 * returns the accept-version header.
 * @public
 * @function getVersion
 * @returns  {String}
 */
Request.prototype.getVersion = function getVersion() {
    if (this._version !== undefined) {
        return (this._version);
    }

    this._version =
        this.headers['accept-version'] ||
            this.headers['x-api-version'] ||
            '*';

    return (this._version);
};
Request.prototype.version = Request.prototype.getVersion;

Request.prototype.matchedVersion = function matchedVersion() {
    if (this._matchedVersion !== undefined) {
        return (this._matchedVersion);
    } else {
        return (this.version());
    }
};

/**
 * returns any header off the request. also, 'correct' any
 * correctly spelled 'referrer' header to the actual spelling used.
 * @public
 * @function header
 * @param    {String} name  the name of the header
 * @param    {String} value default value if header isn't found on the req
 * @returns  {String}
 */
Request.prototype.header = function header(name, value) {
    assert.string(name, 'name');

    name = name.toLowerCase();

    if (name === 'referer' || name === 'referrer') {
        name = 'referer';
    }

    return (this.headers[name] || value);
};


/**
 * returns any trailer header off the request. also, 'correct' any
 * correctly spelled 'referrer' header to the actual spelling used.
 * @public
 * @function trailer
 * @param    {String} name  the name of the header
 * @param    {String} value default value if header isn't found on the req
 * @returns  {String}
 */
Request.prototype.trailer = function trailer(name, value) {
    assert.string(name, 'name');
    name = name.toLowerCase();

    if (name === 'referer' || name === 'referrer') {
        name = 'referer';
    }

    return ((this.trailers || {})[name] || value);
};


/**
 * Check if the incoming request contains the Content-Type header field, and
 * if it contains the given mime type.
 * @public
 * @function is
 * @param    {String} type  a content-type header value
 * @returns  {Boolean}
 */
Request.prototype.is = function is(type) {
    assert.string(type, 'type');

    var contentType = this.getContentType();
    var matches = true;

    if (!contentType) {
        return (false);
    }

    if (type.indexOf('/') === -1) {
        type = mime.lookup(type);
    }

    if (type.indexOf('*') !== -1) {
        type = type.split('/');
        contentType = contentType.split('/');
        matches &= (type[0] === '*' || type[0] === contentType[0]);
        matches &= (type[1] === '*' || type[1] === contentType[1]);
    } else {
        matches = (contentType === type);
    }

    return (matches);
};


/**
 * Check if the incoming request is chunked.
 * @public
 * @function isChunked
 * @returns  {Boolean}
 */
Request.prototype.isChunked = function isChunked() {
    return (this.headers['transfer-encoding'] === 'chunked');
};


/**
 * Check if the incoming request is kept alive.
 * @public
 * @function isKeepAlive
 * @returns  {Boolean}
 */
Request.prototype.isKeepAlive = function isKeepAlive() {
    if (this._keepAlive !== undefined) {
        return (this._keepAlive);
    }

    if (this.headers.connection) {
        this._keepAlive = /keep-alive/i.test(this.headers.connection);
    } else {
        this._keepAlive = this.httpVersion === '1.0' ? false : true;
    }

    return (this._keepAlive);
};


/**
 * Check if the incoming request is encrypted.
 * @public
 * @function isSecure
 * @returns  {Boolean}
 */
Request.prototype.isSecure = function isSecure() {
    if (this._secure !== undefined) {
        return (this._secure);
    }

    this._secure = this.connection.encrypted ? true : false;
    return (this._secure);
};


/**
 * Check if the incoming request has been upgraded.
 * @public
 * @function isUpgradeRequest
 * @returns  {Boolean}
 */
Request.prototype.isUpgradeRequest = function isUpgradeRequest() {
    if (this._upgradeRequest !== undefined) {
        return (this._upgradeRequest);
    } else {
        return (false);
    }
};


/**
 * Check if the incoming request is an upload verb.
 * @public
 * @function isUpload
 * @returns  {Boolean}
 */
Request.prototype.isUpload = function isUpload() {
    var m = this.method;
    return (m === 'PATCH' || m === 'POST' || m === 'PUT');
};


/**
 * toString serialization
 * @public
 * @function toString
 * @returns  {String}
 */
Request.prototype.toString = function toString() {
    var headers = '';
    var self = this;
    var str;

    Object.keys(this.headers).forEach(function (k) {
        headers += sprintf('%s: %s\n', k, self.headers[k]);
    });

    str = sprintf('%s %s HTTP/%s\n%s',
        this.method,
        this.url,
        this.httpVersion,
        headers);

    return (str);
};


/**
 * retrieves the user-agent header.
 * @public
 * @function userAgent
 * @returns  {String}
 */
Request.prototype.userAgent = function userAgent() {
    return (this.headers['user-agent']);
};


/**
 * Start the timer for a request handler function. You must explicitly invoke
 * endHandlerTimer() after invoking this function. Otherwise timing information
 * will be inaccurate.
 * @public
 * @function startHandlerTimer
 * @param    {String}    handlerName The name of the handler.
 * @returns  {undefined}
 */
Request.prototype.startHandlerTimer = function startHandlerTimer(handlerName) {
    var self = this;

    // For nested handlers, we prepend the top level handler func name
    var name = (self._currentHandler === handlerName ?
                handlerName : self._currentHandler + '-' + handlerName);

    if (!self._timerMap) {
        self._timerMap = {};
    }

    self._timerMap[name] = process.hrtime();

    dtrace._rstfy_probes['handler-start'].fire(function () {
        return ([
            self.serverName,
            self._currentRoute, // set in server._run
            name,
            self._dtraceId
        ]);
    });
};


/**
 * Stop the timer for a request handler function.
 * @public
 * @function endHandlerTimer
 * @param    {String}    handlerName The name of the handler.
 * @returns  {undefined}
 */
Request.prototype.endHandlerTimer = function endHandlerTimer(handlerName) {
    var self = this;

    // For nested handlers, we prepend the top level handler func name
    var name = (self._currentHandler === handlerName ?
                handlerName : self._currentHandler + '-' + handlerName);

    if (!self.timers) {
        self.timers = [];
    }

    self._timerMap[name] = process.hrtime(self._timerMap[name]);
    self.timers.push({
        name: name,
        time: self._timerMap[name]
    });

    dtrace._rstfy_probes['handler-done'].fire(function () {
        return ([
            self.serverName,
            self._currentRoute, // set in server._run
            name,
            self._dtraceId
        ]);
    });
};
