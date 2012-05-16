// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var http = require('http');
var url = require('url');
var sprintf = require('util').format;

var mime = require('mime');
var uuid = require('node-uuid');

var args = require('./args');



///--- Globals

var assertString = args.assertString;

var Request = http.IncomingMessage;


///--- Helpers


// The following three functions are courtesy of expressjs
// as is req.accepts(), and req.is() below.
//
// https://github.com/visionmedia/express
//

// Helpers for 'Accept'
// http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.1

function quality(str) {
        var parts = str.split(/ *; */);
        var val = parts[0];
        var q = parts[1] ? parseFloat(parts[1].split(/ *= */)[1]) : 1;

        return ({value: val, quality: q});
}


function parseQuality(str) {
        /* JSSTYLED */
        str = str.split(/ *, */).map(quality).filter(function (obj) {
                return obj.quality;
        }).sort(function (a, b) {
                return b.quality - a.quality;
        });

        return (str);
}


function parseAccept(str) {
        var accept =  parseQuality(str).map(function (obj) {
                var parts = obj.value.split('/');
                obj.type = parts[0];
                obj.subtype = parts[1];
                return obj;
        });

        return (accept);
}



///--- API

///--- Patches

Request.prototype.absoluteUri = function absoluteUri(path) {
        assertString('path', path);

        var protocol = this.secure ? 'https://' : 'http://';
        var hostname = this.headers['host'];
        return (url.resolve(protocol + hostname + this.path + '/', path));
};


Request.prototype.accepts = function accepts(type) {
        assertString('type', type);

        if (!this.accept)
                this.accept = parseAccept(this.headers.accept || '*/*');

        if (type.indexOf('/') === -1)
                type = mime.lookup(type);

        type = type.split('/');

        var matches = this.accept.some(function (obj) {
                if ((obj.type === type[0] || obj.type === '*') &&
                    (obj.subtype === type[1] || obj.subtype === '*'))
                        return (true);

                return (false);
        });

        return (matches);
};


Request.prototype.getContentLength = function getContentLength() {
        return (this.headers['content-length'] || 0);
};


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


Request.prototype.getHref = function getHref() {
        if (this._href !== undefined)
                return (this._href);

        this._href = this.getUrl().href;
        return (this._href);
};


Request.prototype.getId = function getId() {
        if (this.id !== undefined)
                return (this.id);

        this.id = this.headers['x-request-id'] || uuid.v1();
        return (this.id);
};


Request.prototype.getPath = function getPath() {
        if (this._path !== undefined)
                return (this._path);

        this._path = this.getUrl().pathname;
        return (this._path);
};


Request.prototype.getQuery = function getQuery() {
        if (this._query !== undefined)
                return (this._query);

        this._query = this.getUrl().query || {};
        return (this._query);
};


Request.prototype.getTime = function getTime() {
        if (this.time !== undefined)
                return (this.time);

        this.time = new Date(this._time);
        return (this.time);
};


Request.prototype.getUrl = function getUrl() {
        if (this._url !== undefined)
                return (this._url);

        this._url = url.parse(this.url);
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


Request.prototype.header = function header(name, value) {
        assertString('name', name);

        name = name.toLowerCase();

        if (name === 'referer' || name === 'referrer')
                name = 'referer';

        return (this.headers[name] || value);
};


Request.prototype.trailer = function trailer(name, value) {
        assertString('name', name);
        name = name.toLowerCase();

        if (name === 'referer' || name === 'referrer')
                name = 'referer';

        return ((this.trailers || {})[name] || value);
};


Request.prototype.is = function is(type) {
        assertString('type', type);

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
