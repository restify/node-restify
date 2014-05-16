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
var mime = require('mime');
var once = require('once');
var tunnelAgent = require('tunnel-agent');
var uuid = require('node-uuid');

var dtrace = require('../dtrace');
var errors = require('../errors');
var bunyan = require('../bunyan_helper');

// Use native KeepAlive in Node as of 0.11.6
var semver = require('semver');
var nodeVersion = process.version;
var nativeKeepAlive = semver.satisfies(nodeVersion, '>=0.11.6');
var KeepAliveAgent;
var KeepAliveAgentSecure;
var httpMaxSockets = http.globalAgent.maxSockets;
var httpsMaxSockets = https.globalAgent.maxSockets;
if (!nativeKeepAlive) {
    KeepAliveAgent = require('keep-alive-agent');
    KeepAliveAgentSecure = KeepAliveAgent.Secure;
} else {
    KeepAliveAgent = http.Agent;
    KeepAliveAgentSecure = https.Agent;
    // maxSockets defaults to Infinity, but that doesn't
    // lend itself well to KeepAlive, since sockets will
    // never be reused.
    httpMaxSockets = Math.min(httpMaxSockets, 1024);
    httpsMaxSockets = Math.min(httpsMaxSockets, 1024);
}

///--- Globals

/* JSSTYLED */
var VERSION = JSON.parse(fs.readFileSync(require('path').normalize(__dirname + '/../../package.json'), 'utf8')).version;


///--- Helpers

function cloneRetryOptions(options, defaults) {
    if (options === false) {
        return (false);
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

function RequestTimeoutError(ms) {
    if (Error.captureStackTrace)
        Error.captureStackTrace(this, RequestTimeoutError);

    this.message = 'request timeout after ' + ms + 'ms';
    this.name = 'RequestTimeoutError';
}
util.inherits(RequestTimeoutError, Error);

function rawRequest(opts, cb) {
    assert.object(opts, 'options');
    assert.object(opts.log, 'options.log');
    assert.func(cb, 'callback');

    cb = once(cb);

    var id = dtrace.nextId();
    var log = opts.log;
    var proto = opts.protocol === 'https:' ? https : http;
    var connectionTimer;
    var requestTimer;

    if (opts.cert && opts.key)
        opts.agent = false;

    if (opts.connectTimeout) {
        connectionTimer = setTimeout(function connectTimeout() {
            connectionTimer = null;
            if (req) {
                req.abort();
            }

            var err = new ConnectTimeoutError(opts.connectTimeout);
            dtrace._rstfy_probes['client-error'].fire(function () {
                return ([id, err.toString()]);
            });
            cb(err, req);
        }, opts.connectTimeout);
    }

    dtrace._rstfy_probes['client-request'].fire(function () {
        return ([
            opts.method,
            opts.path,
            opts.headers,
            id
        ]);
    });

    var emit_result = once(function _emit_result(_err, _req, _res) {
        _req.emit('result', _err, _res);
    });

    var req = proto.request(opts, function onResponse(res) {
        clearTimeout(connectionTimer);
        clearTimeout(requestTimer);

        dtrace._rstfy_probes['client-response'].fire(function () {
            return ([ id, res.statusCode, res.headers ]);
        });
        log.trace({client_res: res}, 'Response received');

        res.log = log;

        var err;
        if (res.statusCode >= 400)
            err = errors.codeToHttpError(res.statusCode);

        req.removeAllListeners('socket');

        emit_result((err || null), req, res);
    });
    req.log = log;

    req.on('error', function onError(err) {
        dtrace._rstfy_probes['client-error'].fire(function () {
            return ([id, (err || {}).toString()]);
        });
        log.trace({err: err}, 'Request failed');
        clearTimeout(connectionTimer);
        clearTimeout(requestTimer);

        cb(err, req);
        if (req) {
            process.nextTick(function () {
                emit_result(err, req, null);
            });
        }
    });

    req.once('upgrade', function onUpgrade(res, socket, _head) {
        clearTimeout(connectionTimer);
        clearTimeout(requestTimer);
        dtrace._rstfy_probes['client-response'].fire(function () {
            return ([ id, res.statusCode, res.headers ]);
        });
        log.trace({client_res: res}, 'upgrade response received');

        res.log = log;

        var err;
        if (res.statusCode >= 400)
            err = errors.codeToHttpError(res.statusCode);

        req.removeAllListeners('error');
        req.removeAllListeners('socket');
        req.emit('upgradeResult', (err || null), res, socket, _head);
    });

    req.once('socket', function onSocket(socket) {
        var _socket = socket;
        if (opts.protocol === 'https:' && socket.socket) {
            _socket = socket.socket;
        }

        if (_socket.writable && !_socket._connecting) {
            clearTimeout(connectionTimer);
            cb(null, req);
            return;
        }

        _socket.once('connect', function onConnect() {
            clearTimeout(connectionTimer);
            if (opts._keep_alive) {
                _socket.setKeepAlive(true);
                socket.setKeepAlive(true);
            }

            if (opts.requestTimeout) {
                requestTimer = setTimeout(function requestTimeout() {
                    requestTimer = null;

                    var err = new RequestTimeoutError(opts.requestTimeout);
                    dtrace._rstfy_probes['client-error'].fire(function () {
                        return ([id, err.toString()]);
                    });

                    cb(err, req);

                    if (req) {
                        req.abort();
                        process.nextTick(function () {
                            req.emit('result', err, null);
                        });
                    }
                }, opts.requestTimeout);
            }

            cb(null, req);
        });
    });

    if (opts.signRequest)
        opts.signRequest(req);

    if (log.trace())
        log.trace({client_req: opts}, 'request sent');
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

    var self = this;

    this.agent = options.agent;
    this.ca = options.ca;
    this.cert = options.cert;
    this.ciphers = options.ciphers;
    this.connectTimeout = options.connectTimeout || false;
    this.requestTimeout = options.requestTimeout || false;
    this.headers = options.headers || {};
    this.log = options.log;
    if (!this.log.serializers) {
        // Ensure logger has a reasonable serializer for `client_res`
        // and `client_req` logged in this module.
        this.log = this.log.child({serializers: bunyan.serializers});
    }
    this.key = options.key;
    this.name = options.name || 'HttpClient';
    this.passphrase = options.passphrase;
    this.pfx = options.pfx;
    if (options.rejectUnauthorized !== undefined) {
        this.rejectUnauthorized = options.rejectUnauthorized;
    } else {
        this.rejectUnauthorized = true;
    }

    if (process.env.https_proxy) {
        this.proxy = url.parse(process.env.https_proxy);
    } else if (process.env.http_proxy) {
        this.proxy = url.parse(process.env.http_proxy);
    } else if (options.proxy) {
        this.proxy = options.proxy;
    } else {
        this.proxy = false;
    }

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

        if (this.proxy) {
            if (this.url.protocol == 'https:') {
                if (this.proxy.protocol === 'https:') {
                    Agent = tunnelAgent.httpsOverHttps;
                } else {
                    Agent = tunnelAgent.httpsOverHttp;
                }
            } else {
                if (this.proxy.protocol === 'https:') {
                    Agent = tunnelAgent.httpOverHttps;
                } else {
                    Agent = tunnelAgent.httpOverHttp;
                }
            }
        } else if (this.url.protocol === 'https:') {
            Agent = KeepAliveAgentSecure;
            maxSockets = httpsMaxSockets;
        } else {
            Agent = KeepAliveAgent;
            maxSockets = httpMaxSockets;
        }

        if (this.proxy) {
            this.agent = new Agent({
                proxy: self.proxy,
                rejectUnauthorized: self.rejectUnauthorized,
                ca: self.ca
            });
        } else {
            this.agent = new Agent({
                cert: self.cert,
                ca: self.ca,
                ciphers: self.ciphers,
                key: self.key,
                maxSockets: maxSockets,

                // require('keep-alive-agent')
                maxKeepAliveRequests: 0,
                maxKeepAliveTime: 0,

                // native keepalive
                keepAliveMsecs: 1000,
                keepAlive: true,

                passphrase: self.passphrase,
                pfx: self.pfx,
                rejectUnauthorized: self.rejectUnauthorized
            });
            this._keep_alive = true;
        }
    }
}
util.inherits(HttpClient, EventEmitter);
module.exports = HttpClient;


HttpClient.prototype.close = function close() {
    var sockets = this.agent.sockets;
    Object.keys((sockets || {})).forEach(function (k) {
        if (Array.isArray(sockets[k])) {
            sockets[k].forEach(function (s) {
                s.end();
            });
        }
    });

    sockets = this.agent.idleSockets || this.agent.freeSockets;
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


HttpClient.prototype.patch = function patch(options, callback) {
    var opts = this._options('PATCH', options);


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

    if (opts.retry === false) {
        rawRequest(opts, cb);
        return;
    }

    var call;
    var retry = cloneRetryOptions(opts.retry);

    opts._keep_alive = this._keep_alive;
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
        ca: options.ca || self.ca,
        cert: options.cert || self.cert,
        ciphers: options.ciphers || self.ciphers,
        connectTimeout: options.connectTimeout || self.connectTimeout,
        requestTimeout: options.requestTimeout || self.requestTimeout,
        headers: options.headers || {},
        key: options.key || self.key,
        log: options.log || self.log,
        method: method,
        passphrase: options.passphrase || self.passphrase,
        path: options.path || self.path,
        pfx: options.pfx || self.pfx,
        rejectUnauthorized: options.rejectUnauthorized ||
            self.rejectUnauthorized,
        retry: options.retry !== false ? options.retry : false,
        signRequest: options.signRequest || self.signRequest
    };

    if (!opts.retry && opts.retry !== false)
        opts.retry = self.retry;


    // Backwards compatibility with restify < 1.0
    if (options.query &&
        Object.keys(options.query).length &&
        opts.path.indexOf('?') === -1) {
        opts.path += '?' + querystring.stringify(options.query);
    }

    if (this.socketPath)
        opts.socketPath = this.socketPath;

    Object.keys(this.url).forEach(function (k) {
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
        if (opts.headers['content-length'] && method !== 'DELETE')
            delete opts.headers['content-length'];
        if (opts.headers['transfer-encoding'])
            delete opts.headers['transfer-encoding'];
    }

    return (opts);
};
// vim: set ts=4 sts=4 sw=4 et:
