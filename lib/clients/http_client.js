// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var crypto = require('crypto');
var EventEmitter = require('events').EventEmitter;
var http = require('http');
var https = require('https');
var os = require('os');
var querystring = require('querystring');
var url = require('url');
var util = require('util');
var zlib = require('zlib');

var assert = require('assert-plus');
var mime = require('mime');
var retry = require('retry');
var semver = require('semver');
var uuid = require('node-uuid');

var errors = require('../errors');



///--- Helpers

function defaultUserAgent() {
        var UA = 'restify/1.0 (' + os.arch() + '-' + os.platform() + '; ' +
                'v8/' + process.versions.v8 + '; ' +
                'OpenSSL/' + process.versions.openssl + ') ' +
                'node/' + process.versions.node;

        return (UA);
}


function newRetryOperation(options) {
        var operation;
        if (options.retry !== false) {
                operation = retry.operation(options.retry);
        } else {
                // Stub out node-retry so the code isn't fugly in the
                // mainline client
                operation = {
                        attempt: function (callback) {
                                return (callback(1));
                        },
                        retry: function (err) {
                                operation._err = err;
                                return (false);
                        },
                        mainError: function () {
                                return (operation._err);
                        }
                };
        }

        return (operation);
}


function ConnectTimeoutError() {
        if (Error.captureStackTrace)
                Error.captureStackTrace(this, ConnectTimeoutError);

        this.message = util.format.apply(util, arguments);
}
util.inherits(ConnectTimeoutError, Error);



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

        this.retry = (options.retry !== false) ?
                (options.retry || { retries: 3 }) : false;

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

}
util.inherits(HttpClient, EventEmitter);
module.exports = HttpClient;


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


HttpClient.prototype.request = function request(options, callback) {
        var done = false;

        function _callback(err, req) {
                if (done)
                        return (false);

                done = true;
                return (callback(err, req));
        }

        // Don't rely on x-request-id, as the server may not accept it
        var log = this.log;
        var operation = newRetryOperation(options);
        var proto = options.protocol === 'https:' ? https : http;
        var signRequest = this.signRequest;

        operation.attempt(function retryCallback(currentAttempt) {
                var timer = false;
                function clearTimer() {
                        if (timer)
                                clearTimeout(timer);

                        timer = false;
                }

                log.trace({
                        client_req: options,
                        attempt: currentAttempt
                }, 'sending request');

                if (options.cert && options.key)
                        options.agent = new proto.Agent(options);

                var req = proto.request(options, function requestCallback(res) {
                        clearTimer();
                        log.trace({client_res: res}, 'Response received');

                        res.log = log;

                        var err = null;
                        if (res.statusCode >= 400)
                                err = errors.codeToHttpError(res.statusCode);

                        req.emit('result', err, res);
                });

                req.log = log;
                if (signRequest)
                        signRequest(req);

                req.on('error', function onError(err) {
                        log.trace({err: err}, 'Request failed');
                        clearTimer();
                        if (!done) {
                                if (!operation.retry(err)) {
                                        err = operation.mainError() || err;
                                        return (_callback(err));
                                }
                        } else {
                                // Since we're changing subtly the way the
                                // client interacts with callbacks to handle
                                // socket connections, we have to handle the
                                // case where the caller was told we're
                                // "good to go", and instead mimic the behavior
                                // of there being a bad http code. I.e., a
                                // server may just TCP RST us instead of a 400
                                req.emit('result', err, null);
                        }

                        return (false);
                });

                if (options.connectTimeout) {
                        timer = setTimeout(function connectTimeout() {
                                clearTimer();
                                req.abort();

                                var to = options.connectTimeout;
                                var err = new ConnectTimeoutError('timeout ' +
                                                                  'after ' +
                                                                  to +
                                                                  'ms');

                                if (!operation.retry(err)) {
                                        err = operation.mainError() || err;
                                        return (_callback(err));
                                }

                                return (false);
                        }, options.connectTimeout);
                }

                req.once('socket', function onSocket(socket) {
                        if (socket.writable && !socket._connecting) {
                                clearTimer();
                                return (_callback(null, req));
                        }

                        return socket.once('connect', function onConnect() {
                                clearTimer();
                                return (_callback(null, req));
                        });
                });
        });
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
                method: method,
                path: options.path || self.path,
                retry: options.retry || self.retry
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
