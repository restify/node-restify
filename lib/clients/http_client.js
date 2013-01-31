// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var crypto = require('crypto');
var EventEmitter = require('events').EventEmitter;
var fs = require('fs');
var http = require('http');
var https = require('https');
var os = require('os');
var querystring = require('querystring');
var url = require('url');
var util = require('util');
var zlib = require('zlib');

var assert = require('assert-plus');
var backoff = require('backoff');
var KeepAliveAgent = require('keep-alive-agent');
var mime = require('mime');
var once = require('once');
var semver = require('semver');
var uuid = require('node-uuid');

var errors = require('../errors');



///--- Globals

/* JSSTYLED */
var VERSION = JSON.parse(fs.readFileSync(require('path').normalize(__dirname + '/../../package.json'), 'utf8')).version;



///--- Helpers

function cloneRetryOptions(options, defaults) {
        if (options === false) {
                return ({
                        minTimeout: 1,
                        maxTimeout: 2,
                        retries: 1
                });
        }

        assert.optionalObject(options, 'options.retry');
        var r = options || {};
        assert.optionalNumber(r.minTimeout, 'options.retry.minTimeout');
        assert.optionalNumber(r.maxTimeout, 'options.retry.maxTimeout');
        assert.optionalNumber(r.retries, 'options.retry.retries');
        assert.optionalObject(defaults, 'defaults');
        defaults = defaults || {};

        return ({
                minTimeout: r.minTimeout || defaults.minTimeout || 1000,
                maxTimeout: r.maxTimeout || defaults.maxTimeout || Infinity,
                retries: r.retries || defaults.retries || 4
        });
}


function defaultUserAgent() {
        var UA = 'restify/' + VERSION +
                ' (' + os.arch() + '-' + os.platform() + '; ' +
                'v8/' + process.versions.v8 + '; ' +
                'OpenSSL/' + process.versions.openssl + ') ' +
                'node/' + process.versions.node;

        return (UA);
}


function ConnectTimeoutError(ms) {
        if (Error.captureStackTrace)
                Error.captureStackTrace(this, ConnectTimeoutError);

        this.message = 'connect timeout after ' + ms + 'ms';
        this.name = 'ConnectTimeoutError';
}
util.inherits(ConnectTimeoutError, Error);


function rawRequest(opts, cb) {
        assert.object(opts, 'options');
        assert.object(opts.log, 'options.log');
        assert.func(cb, 'callback');

        cb = once(cb);

        var log = opts.log;
        var proto = opts.protocol === 'https:' ? https : http;
        var timer;

        if (opts.cert && opts.key)
                opts.agent = false;

        if (opts.connectTimeout) {
                timer = setTimeout(function connectTimeout() {
                        timer = null;
                        if (req) {
                                req.abort();
                        }

                        cb(new ConnectTimeoutError(opts.connectTimeout), req);
                }, opts.connectTimeout);
        }

        var req = proto.request(opts, function onResponse(res) {
                clearTimeout(timer);
                log.trace({client_res: res}, 'Response received');

                res.log = log;

                var err;
                if (res.statusCode >= 400)
                        err = errors.codeToHttpError(res.statusCode);

                req.removeAllListeners('error');
                req.removeAllListeners('socket');
                req.emit('result', (err || null), res);
        });
        req.log = log;

        req.on('error', function onError(err) {
                log.trace({err: err}, 'Request failed');
                clearTimeout(timer);

                cb(err, req);
                if (req) {
                        process.nextTick(function () {
                                req.emit('result', err, null);
                        });
                }
        });

        req.once('socket', function onSocket(socket) {
                if (socket.writable && !socket._connecting) {
                        clearTimeout(timer);
                        cb(null, req);
                        return;
                }

                socket.once('connect', function onConnect() {
                        clearTimeout(timer);
                        cb(null, req);
                });
        });

        if (opts.signRequest)
                opts.signRequest(req);
} // end `rawRequest`



///--- API

function HttpClient(options) {
        assert.object(options, 'options');
        assert.optionalObject(options.headers, 'options.headers');
        assert.object(options.log, 'options.log');
        assert.optionalFunc(options.signRequest, 'options.signRequest');
        assert.optionalString(options.socketPath, 'options.socketPath');
        assert.optionalString(options.url, 'options.url');

        EventEmitter.call(this);

        this.agent = options.agent;
        this.cert = options.cert;
        this.connectTimeout = options.connectTimeout || false;
        this.headers = options.headers || {};
        this.log = options.log;
        this.key = options.key;
        this.name = options.name || 'HttpClient';
        this.retry = cloneRetryOptions(options.retry);
        this.signRequest = options.signRequest || false;
        this.socketPath = options.socketPath || false;
        this.url = options.url ? url.parse(options.url) : {};

        if (options.accept) {
                if (options.accept.indexOf('/') === -1)
                        options.accept = mime.lookup(options.accept);

                this.headers.accept = options.accept;
        }

        if (options.contentType) {
                if (options.contentType.indexOf('/') === -1)
                        options.type = mime.lookup(options.contentType);

                this.headers['content-type'] = options.contentType;
        }

        if (options.userAgent !== false) {
                this.headers['user-agent'] = options.userAgent ||
                        defaultUserAgent();
        }

        if (options.version)
                this.headers['accept-version'] = options.version;

        if (this.agent === undefined) {
                var Agent;
                var maxSockets;

                if (this.url.protocol === 'https:') {
                        Agent = KeepAliveAgent.Secure;
                        maxSockets = https.globalAgent.maxSockets;
                } else {
                        Agent = KeepAliveAgent;
                        maxSockets = http.globalAgent.maxSockets;
                }

                this.agent = new Agent({
                        maxSockets: maxSockets,
                        maxKeepAliveRequests: 0,
                        maxKeepAliveTime: 0
                });
        }
}
util.inherits(HttpClient, EventEmitter);
module.exports = HttpClient;


HttpClient.prototype.close = function close() {
        var sockets = this.agent.sockets;
        Object.keys((sockets || {})).forEach(function (k) {
                sockets[k].forEach(function (s) {
                        s.end();
                });
        });

        sockets = this.agent.idleSockets;
        Object.keys((sockets || {})).forEach(function (k) {
                sockets[k].forEach(function (s) {
                        s.end();
                });
        });
};


HttpClient.prototype.del = function del(options, callback) {
        var opts = this._options('DELETE', options);

        return (this.read(opts, callback));
};


HttpClient.prototype.get = function get(options, callback) {
        var opts = this._options('GET', options);

        return (this.read(opts, callback));
};


HttpClient.prototype.head = function head(options, callback) {
        var opts = this._options('HEAD', options);

        return (this.read(opts, callback));
};

HttpClient.prototype.opts = function http_options(options, callback) {
        var _opts = this._options('OPTIONS', options);

        return (this.read(_opts, callback));
};


HttpClient.prototype.post = function post(options, callback) {
        var opts = this._options('POST', options);

        return (this.request(opts, callback));
};


HttpClient.prototype.put = function put(options, callback) {
        var opts = this._options('PUT', options);

        return (this.request(opts, callback));
};


HttpClient.prototype.read = function read(options, callback) {
        var r = this.request(options, function readRequestCallback(err, req) {
                if (!err)
                        req.end();

                return (callback(err, req));
        });
        return (r);
};


HttpClient.prototype.basicAuth = function basicAuth(username, password) {
        if (username === false) {
                delete this.headers.authorization;
        } else {
                assert.string(username, 'username');
                assert.string(password, 'password');

                var buffer = new Buffer(username + ':' + password, 'utf8');
                this.headers.authorization = 'Basic ' +
                        buffer.toString('base64');
        }

        return (this);
};


HttpClient.prototype.request = function request(opts, cb) {
        assert.object(opts, 'options');
        assert.func(cb, 'callback');

        cb = once(cb);

        var call;
        var retry = cloneRetryOptions(opts.retry);

        call = backoff.call(rawRequest, opts, cb);
        call.setStrategy(new backoff.ExponentialStrategy({
                initialDelay: retry.minTimeout,
                maxDelay: retry.maxTimeout
        }));
        call.failAfter(retry.retries);
        call.on('backoff', this.emit.bind(this, 'attempt'));

        call.start();
};


HttpClient.prototype._options = function (method, options) {
        if (typeof (options) !== 'object')
                options = { path: options };

        var self = this;
        var opts = {
                agent: options.agent || self.agent,
                cert: options.cert || self.cert,
                connectTimeout: options.connectTimeout || self.connectTimeout,
                headers: options.headers || {},
                key: options.key || self.key,
                log: options.log || self.log,
                method: method,
                path: options.path || self.path,
                retry: options.retry || self.retry,
                signRequest: options.signRequest || self.signRequest
        };

        // Backwards compatibility with restify < 1.0
        if (options.query &&
            Object.keys(options.query).length &&
            opts.path.indexOf('?') === -1) {
                opts.path += '?' + querystring.stringify(options.query);
        }

        if (this.socketPath)
                opts.socketPath = this.socketPath;

        Object.keys(self.url).forEach(function (k) {
                if (!opts[k])
                        opts[k] = self.url[k];
        });

        Object.keys(self.headers).forEach(function (k) {
                if (!opts.headers[k])
                        opts.headers[k] = self.headers[k];
        });

        if (!opts.headers.date)
                opts.headers.date = new Date().toUTCString();

        if (method === 'GET' || method === 'HEAD' || method === 'DELETE') {
                if (opts.headers['content-type'])
                        delete opts.headers['content-type'];
                if (opts.headers['content-md5'])
                        delete opts.headers['content-md5'];
                if (opts.headers['content-length'])
                        delete opts.headers['content-length'];
                if (opts.headers['transfer-encoding'])
                        delete opts.headers['transfer-encoding'];
        }

        return (opts);
};
