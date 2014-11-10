// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var http = require('http');
var url = require('url');
var sprintf = require('util').format;

var assert = require('assert-plus');
var mime = require('mime');
var Negotatior = require('negotiator');
var uuid = require('node-uuid');

var utils = require('./utils');


///--- Globals

var Request = http.IncomingMessage;

var parseAccept = utils.parseAccept;
var sanitizePath = utils.sanitizePath;


///-- Helpers

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

Request.prototype.absoluteUri = function absoluteUri(path) {
    assert.string(path, 'path');

    var protocol = this.secure ? 'https://' : 'http://';
    var hostname = this.headers['host'];
    return (url.resolve(protocol + hostname + this.path + '/', path));
};


Request.prototype.accepts = function accepts(types) {
    if (typeof (types) === 'string')
        types = [types];

    types = types.map(function (t) {
        assert.string(t, 'type');
        if (t.indexOf('/') === -1)
            t = mime.lookup(t);
        return (t);
    });

    negotiator(this);

    return (this._negotiator.preferredMediaType(types));
};


Request.prototype.acceptsEncoding = function acceptsEncoding(types) {
    if (typeof (types) === 'string')
        types = [types];

    assert.arrayOfString(types, 'types');

    negotiator(this);

    return (this._negotiator.preferredEncoding(types));
};


Request.prototype.getContentLength = function getContentLength() {
    if (this._clen !== undefined)
        return (this._clen === false ? undefined : this._clen);

    // We should not attempt to read and parse the body of an
    // Upgrade request, so force Content-Length to zero:
    if (this.isUpgradeRequest())
        return (0);

    var len = this.header('content-length');
    if (!len) {
        this._clen = false;
    } else {
        this._clen = parseInt(len, 10);
    }

    return (this._clen === false ? undefined : this._clen);
};
Request.prototype.contentLength = Request.prototype.getContentLength;


Request.prototype.getContentType = function getContentType() {
    if (this._contentType !== undefined)
        return (this._contentType);

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

    return (this._contentType);
};
Request.prototype.contentType = Request.prototype.getContentType;


Request.prototype.date = function date() {
    if (this._date !== undefined)
        return (this._date);

    this._date = new Date(this._time);
    return (this._date);
};


Request.prototype.getHref = function getHref() {
    return (this.getUrl().href);
};
Request.prototype.href = Request.prototype.getHref;


Request.prototype.getId = function getId() {
    if (this._id !== undefined)
        return (this._id);

    this._id = this.headers['request-id'] ||
        this.headers['x-request-id'] ||
        uuid.v1();

    return (this._id);
};
Request.prototype.id = Request.prototype.getId;


Request.prototype.getPath = function getPath() {
    return (this.getUrl().pathname);
};
Request.prototype.path = Request.prototype.getPath;


Request.prototype.getQuery = function getQuery() {
    return (this.getUrl().query || {});
};
Request.prototype.query = Request.prototype.getQuery;


Request.prototype.time = function time() {
    return (this._time);
};


Request.prototype.getUrl = function getUrl() {
    if (this._cacheURL !== this.url) {
        this._url = url.parse(this.url);
        this._cacheURL = this.url;
    }
    return (this._url);
};


Request.prototype.getVersion = function getVersion() {
    if (this._version !== undefined)
        return (this._version);

    this._version =
        this.headers['accept-version'] ||
            this.headers['x-api-version'] ||
            '*';

    return (this._version);
};
Request.prototype.version = Request.prototype.getVersion;


Request.prototype.header = function header(name, value) {
    assert.string(name, 'name');

    name = name.toLowerCase();

    if (name === 'referer' || name === 'referrer')
        name = 'referer';

    return (this.headers[name] || value);
};


Request.prototype.trailer = function trailer(name, value) {
    assert.string(name, 'name');
    name = name.toLowerCase();

    if (name === 'referer' || name === 'referrer')
        name = 'referer';

    return ((this.trailers || {})[name] || value);
};


Request.prototype.is = function is(type) {
    assert.string(type, 'type');

    var contentType = this.getContentType();
    var matches = true;
    if (!contentType)
        return (false);

    if (type.indexOf('/') === -1)
        type = mime.lookup(type);

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


Request.prototype.isChunked = function isChunked() {
    return (this.headers['transfer-encoding'] === 'chunked');
};


Request.prototype.isKeepAlive = function isKeepAlive() {
    if (this._keepAlive !== undefined)
        return (this._keepAlive);

    if (this.headers.connection) {
        this._keepAlive = /keep-alive/i.test(this.headers.connection);
    } else {
        this._keepAlive = this.httpVersion === '1.0' ? false : true;
    }

    return (this._keepAlive);
};


Request.prototype.isSecure = function isSecure() {
    if (this._secure !== undefined)
        return (this._secure);

    this._secure = this.connection.encrypted ? true : false;
    return (this._secure);
};


Request.prototype.isUpgradeRequest = function isUpgradeRequest() {
    if (this._upgradeRequest !== undefined)
        return (this._upgradeRequest);
    else
        return (false);
};


Request.prototype.isUpload = function isUpload() {
    var m = this.method;
    return (m === 'PATH' || m === 'POST' || m === 'PUT');
};


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


Request.prototype.userAgent = function userAgent() {
    return (this.headers['user-agent']);
};
