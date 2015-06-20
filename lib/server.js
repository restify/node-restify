// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var domain = require('domain');
var EventEmitter = require('events').EventEmitter;
var http = require('http');
var https = require('https');
var util = require('util');

var assert = require('assert-plus');
var mime = require('mime');
var once = require('once');
var spdy = require('spdy');
var uuid = require('node-uuid');

var dtrace = require('./dtrace');
var errors = require('./errors');
var formatters = require('./formatters');
var shallowCopy = require('./utils').shallowCopy;
var upgrade = require('./upgrade');

var semver = require('semver');
var maxSatisfying = semver.maxSatisfying;

// Ensure these are loaded
require('./request');
require('./response');


///--- Globals

var sprintf = util.format;

var ResourceNotFoundError = errors.ResourceNotFoundError;

var PROXY_EVENTS = [
    'clientError',
    'close',
    'connection',
    'error',
    'listening',
    'secureConnection'
];


///--- Helpers

/**
 * helper function to help verify and flatten an array of arrays.
 * takes an arguments object and an index frmo which to slice, then
 * merges that into a single array.
 * @private
 * @function argumentsToChain
 * @throws   {TypeError}
 * @param    {Object} args  pass through of funcs from server.[method]
 * @param    {Number} start index of args at which to start working with
 * @returns  {Array}
 */
function argumentsToChain(args, start) {
    assert.ok(args);

    args = Array.prototype.slice.call(args, start);

    if (args.length < 0) {
        throw new TypeError('handler (function) required');
    }

    var chain = [];

    function process(handlers) {
        for (var i = 0; i < handlers.length; i++) {
            if (Array.isArray(handlers[i])) {
                process(handlers[i], 0);
            } else {
                assert.func(handlers[i], 'handler');
                chain.push(handlers[i]);
            }
        }

        return (chain);
    }

    return (process(args));
}

/**
 * merge optional formatters with the default formatters to create a single
 * formatters object. the passed in optional formatters object looks like:
 * formatters: {
 *   'application/foo': function formatFoo(req, res, body) {...}
 * }
 * @private
 * @function mergeFormatters
 * @param    {Object} fmt user specified formatters object
 * @returns  {Object}
 */

function mergeFormatters(fmt) {
    var arr = [];
    var obj = {};

    function addFormatter(src, k) {
        assert.func(src[k], 'formatter');

        var q = 1.0; // RFC 2616 sec14 - The default value is q=1
        var t = k;

        if (k.indexOf(';') !== -1) {
            var tmp = k.split(/\s*;\s*/);
            t = tmp[0];

            if (tmp[1].indexOf('q=') !== -1) {
                q = parseFloat(tmp[1].split('=')[1]);
            }
        }

        if (k.indexOf('/') === -1) {
            k = mime.lookup(k);
        }

        obj[t] = src[k];
        arr.push({
            q: q,
            t: t
        });
    }

    Object.keys(formatters).forEach(addFormatter.bind(this, formatters));
    Object.keys(fmt || {}).forEach(addFormatter.bind(this, fmt || {}));

    arr = arr.sort(function (a, b) {
        return (b.q - a.q);
    }).map(function (a) {
            return (a.t);
        });

    return ({
        formatters: obj,
        acceptable: arr
    });
}


/**
 * attaches ifError function attached to the `next` function in handler chain.
 * uses a closure to maintain ref to next.
 * @private
 * @function ifError
 * @param    {Function} n the next function
 * @returns  {Function}
 */
function ifError(n) {
    /**
     * @throws   will throw if an error is passed in.
     * @private
     * @function _ifError
     * @param    {Object} err an error object
     * @returns  {undefined}
     */
    function _ifError(err) {
        if (err) {
            err._restify_next = n;
            throw err;
        }
    }

    return (_ifError);
}


/**
 * when an error occurrs, this is used to emit an error to consumers
 * via EventEmitter.
 * @private
 * @function emitRouteError
 * @param    {Object} server the server object
 * @param    {Object} req    the request object
 * @param    {Object} res    the response object
 * @param    {Object} err    an error object
 * @returns  {undefined}
 */
function emitRouteError(server, req, res, err) {
    var name;

    if (err.name === 'ResourceNotFoundError') {
        name = 'NotFound';
    } else if (err.name === 'InvalidVersionError') {
        name = 'VersionNotAllowed';
    } else {
        name = err.name.replace(/Error$/, '');
    }

    req.log.trace({name: name, err: err}, 'entering emitRouteError');

    if (server.listeners(name).length > 0) {
        server.emit(name, req, res, err, once(function () {
            server.emit('after', req, res, null);
        }));
    } else {
        res.send(err);
        server.emit('after', req, res, null);
    }
}


/**
 * returns true if an error generated is for an options request.
 * @private
 * @function optionsError
 * @param    {Object}     err an error object
 * @param    {Object}     req the request object
 * @param    {Object}     res the response object
 * @returns  {Boolean}
 */
function optionsError(err, req, res) {
    var code = err.statusCode;
    var ok = false;

    if (code === 404 && req.method === 'OPTIONS' && req.url === '*') {
        res.send(200);
        ok = true;
    }

    return (ok);
}


///--- API

/**
 * Creates a new Server.
 * @public
 * @class
 * @param {Object} options an options object
 */
function Server(options) {
    assert.object(options, 'options');
    assert.object(options.log, 'options.log');
    assert.object(options.router, 'options.router');

    var self = this;

    EventEmitter.call(this);

    this.before = [];
    this.chain = [];
    this.log = options.log;
    this.name = options.name || 'restify';
    this.router = options.router;
    this.routes = {};
    this.secure = false;
    this.versions = options.versions || options.version || [];
    this.socketio = options.socketio || false;

    var fmt = mergeFormatters(options.formatters);
    this.acceptable = fmt.acceptable;
    this.formatters = fmt.formatters;

    if (options.spdy) {
        this.spdy = true;
        this.server = spdy.createServer(options.spdy);
    } else if ((options.cert || options.certificate) && options.key) {
        this.ca = options.ca;
        this.certificate = options.certificate || options.cert;
        this.key = options.key;
        this.passphrase = options.passphrase || null;
        this.secure = true;

        this.server = https.createServer({
            ca: self.ca,
            cert: self.certificate,
            key: self.key,
            passphrase: self.passphrase,
            rejectUnauthorized: options.rejectUnauthorized,
            requestCert: options.requestCert,
            ciphers: options.ciphers
        });
    } else if (options.httpsServerOptions) {
        this.server = https.createServer(options.httpsServerOptions);
    } else {
        this.server = http.createServer();
    }

    this.router.on('mount', this.emit.bind(this, 'mount'));

    if (!options.handleUpgrades && PROXY_EVENTS.indexOf('upgrade') === -1) {
        PROXY_EVENTS.push('upgrade');
    }
    PROXY_EVENTS.forEach(function (e) {
        self.server.on(e, self.emit.bind(self, e));
    });

    // Now the things we can't blindly proxy
    this.server.on('checkContinue', function onCheckContinue(req, res) {
        if (self.listeners('checkContinue').length > 0) {
            self.emit('checkContinue', req, res);
            return;
        }

        if (!options.noWriteContinue) {
            res.writeContinue();
        }

        self._setupRequest(req, res);
        self._handle(req, res, true);
    });

    if (options.handleUpgrades) {
        this.server.on('upgrade', function onUpgrade(req, socket, head) {
            req._upgradeRequest = true;
            var res = upgrade.createResponse(req, socket, head);
            self._setupRequest(req, res);
            self._handle(req, res);
        });
    }

    this.server.on('request', function onRequest(req, res) {
        self.emit('request', req, res);

        if (options.socketio && (/^\/socket\.io.*/).test(req.url)) {
            return;
        }

        self._setupRequest(req, res);
        self._handle(req, res);
    });

    this.__defineGetter__('maxHeadersCount', function () {
        return (self.server.maxHeadersCount);
    });

    this.__defineSetter__('maxHeadersCount', function (c) {
        self.server.maxHeadersCount = c;
        return (c);
    });

    this.__defineGetter__('url', function () {
        if (self.socketPath) {
            return ('http://' + self.socketPath);
        }

        var addr = self.address();
        var str = '';

        if (self.spdy) {
            str += 'spdy://';
        } else if (self.secure) {
            str += 'https://';
        } else {
            str += 'http://';
        }

        if (addr) {
            str += addr.family === 'IPv6' ?
                '[' + addr.address + ']' : addr.address;
            str += ':';
            str += addr.port;
        } else {
            str += '169.254.0.1:0000';
        }

        return (str);
    });
}
util.inherits(Server, EventEmitter);

module.exports = Server;


/**
 * Returns the server address. Wraps node's address().
 * @public
 * @function address
 * @returns  {String}
 */
Server.prototype.address = function address() {
    return (this.server.address());
};


/**
 * Gets the server up and listening. Wraps node's listen().
 *
 * You can call like:
 *  server.listen(80)
 *  server.listen(80, '127.0.0.1')
 *  server.listen('/tmp/server.sock')
 *
 * @public
 * @function listen
 * @throws   {TypeError}
 * @param    {Function}  callback optionally get notified when listening.
 * @returns  {undefined}
 */
Server.prototype.listen = function listen() {
    var args = Array.prototype.slice.call(arguments);
    return (this.server.listen.apply(this.server, args));
};


/**
 * Shuts down this server, and invokes callback (optionally) when done.
 * Wraps node's close().
 * @public
 * @function close
 * @param    {Function}  callback optional callback to invoke when done.
 * @returns  {undefined}
 */
Server.prototype.close = function close(callback) {
    if (callback) {
        assert.func(callback, 'callback');
    }

    this.server.once('close', function onClose() {
        return (callback ? callback() : false);
    });

    return (this.server.close());
};


// Register all the routing methods
/**
 * Mounts a chain on the given path against this HTTP verb
 *
 * @public
 * @function del, get, head, opts, post, put, patch
 * @param   {String | Object} opts if string, the URL to handle.
 *                                 if options, the URL to handle, at minimum.
 * @returns {Route}                the newly created route.
 */
[
    'del',
    'get',
    'head',
    'opts',
    'post',
    'put',
    'patch'
].forEach(function (method) {
        Server.prototype[method] = function (opts) {
            if (opts instanceof RegExp || typeof (opts) === 'string') {
                opts = {
                    path: opts
                };
            } else if (typeof (opts) === 'object') {
                opts = shallowCopy(opts);
            } else {
                throw new TypeError('path (string) required');
            }

            if (arguments.length < 2) {
                throw new TypeError('handler (function) required');
            }

            var chain = [];
            var route;
            var self = this;

            function addHandler(h) {
                assert.func(h, 'handler');

                chain.push(h);
            }

            if (method === 'del') {
                method = 'DELETE';
            }

            if (method === 'opts') {
                method = 'OPTIONS';
            }
            opts.method = method.toUpperCase();
            opts.versions = opts.versions || opts.version || self.versions;

            if (!Array.isArray(opts.versions)) {
                opts.versions = [opts.versions];
            }

            if (!opts.name) {
                opts.name = method + '-' + (opts.path || opts.url);

                if (opts.versions.length > 0) {
                    opts.name += '-' + opts.versions.join('--');
                }

                opts.name = opts.name.replace(/\W/g, '').toLowerCase();

                if (this.router.mounts[opts.name]) { // GH-401
                    opts.name += uuid.v4().substr(0, 7);
                }
            } else {
                opts.name = opts.name.replace(/\W/g, '').toLowerCase();
            }


            if (!(route = this.router.mount(opts))) {
                return (false);
            }

            this.chain.forEach(addHandler);
            argumentsToChain(arguments, 1).forEach(addHandler);
            this.routes[route] = chain;

            return (route);
        };
    });


/**
 * Minimal port of the functionality offered by Express.js Route Param
 * Pre-conditions
 * @link http://expressjs.com/guide.html#route-param%20pre-conditions
 *
 * This basically piggy-backs on the `server.use` method. It attaches a
 * new middleware function that only fires if the specified parameter exists
 * in req.params
 *
 * Exposes an API:
 *   server.param("user", function (req, res, next) {
 *     // load the user's information here, always making sure to call next()
 *   });
 *
 * @public
 * @function param
 * @param    {String}   name The name of the URL param to respond to
 * @param    {Function} fn   The middleware function to execute
 * @returns  {Object}        returns self
 */
Server.prototype.param = function param(name, fn) {
    this.use(function _param(req, res, next) {
        if (req.params && req.params[name]) {
            fn.call(this, req, res, next, req.params[name], name);
        } else {
            next();
        }
    });

    return (this);
};


/**
 * Piggy-backs on the `server.use` method. It attaches a new middleware
 * function that only fires if the specified version matchtes the request.
 *
 * Note that if the client does not request a specific version, the middleware
 * function always fires. If you don't want this set a default version with a
 * pre handler on requests where the client omits one.
 *
 * Exposes an API:
 *   server.versionedUse("version", function (req, res, next, ver) {
 *     // do stuff that only applies to routes of this API version
 *   });
 *
 * @public
 * @function versionedUse
 * @param    {String|Array} versions the version(s) the URL to respond to
 * @param    {Function}     fn       the middleware function to execute, the
 *                                   fourth parameter will be the selected
 *                                   version
 * @returns  {undefined}
 */
Server.prototype.versionedUse = function versionedUse(versions, fn) {
    if (!Array.isArray(versions)) {
        versions = [versions];
    }
    assert.arrayOfString(versions, 'versions');

    versions.forEach(function (v) {
        if (!semver.valid(v)) {
            throw new TypeError('%s is not a valid semver', v);
        }
    });

    this.use(function _versionedUse(req, res, next) {
        var ver;

        if (req.version() === '*' ||
            (ver = maxSatisfying(versions,
                req.version()) || false)) {
            fn.call(this, req, res, next, ver);
        } else {
            next();
        }
    });

    return (this);
};


/**
 * Removes a route from the server.
 * You pass in the route 'blob' you got from a mount call.
 * @public
 * @function rm
 * @throws   {TypeError} on bad input.
 * @param    {String}    route the route name.
 * @returns  {Boolean}         true if route was removed, false if not.
 */
Server.prototype.rm = function rm(route) {
    var r = this.router.unmount(route);

    if (r && this.routes[r]) {
        delete this.routes[r];
    }

    return (r);
};


/**
 * Installs a list of handlers to run _before_ the "normal" handlers of all
 * routes.
 *
 * You can pass in any combination of functions or array of functions.
 * @public
 * @function use
 * @returns {Object} returns self
 */
Server.prototype.use = function use() {
    var self = this;

    (argumentsToChain(arguments) || []).forEach(function (h) {
        self.chain.push(h);
    });

    return (this);
};


/**
 * Gives you hooks to run _before_ any routes are located.  This gives you
 * a chance to intercept the request and change headers, etc., that routing
 * depends on.  Note that req.params will _not_ be set yet.
 * @public
 * @function pre
 * @returns {Object} returns self
 */
Server.prototype.pre = function pre() {
    var self = this;

    argumentsToChain(arguments).forEach(function (h) {
        self.before.push(h);
    });

    return (this);
};


/**
 * toString() the server for easy reading/output.
 * @public
 * @function toString
 * @returns  {String}
 */
Server.prototype.toString = function toString() {
    var LINE_FMT = '\t%s: %s\n';
    var SUB_LINE_FMT = '\t\t%s: %s\n';
    var self = this;
    var str = '';

    function handlersToString(arr) {
        var s = '[' + arr.map(function (b) {
            return (b.name || 'function');
        }).join(', ') + ']';

        return (s);
    }

    str += sprintf(LINE_FMT, 'Accepts', this.acceptable.join(', '));
    str += sprintf(LINE_FMT, 'Name', this.name);
    str += sprintf(LINE_FMT, 'Pre', handlersToString(this.before));
    str += sprintf(LINE_FMT, 'Router', this.router.toString());
    str += sprintf(LINE_FMT, 'Routes', '');
    Object.keys(this.routes).forEach(function (k) {
        var handlers = handlersToString(self.routes[k]);
        str += sprintf(SUB_LINE_FMT, k, handlers);
    });
    str += sprintf(LINE_FMT, 'Secure', this.secure);
    str += sprintf(LINE_FMT, 'Url', this.url);
    str += sprintf(LINE_FMT, 'Version', Array.isArray(this.versions) ?
                   this.versions.join() :
                   this.versions);

    return (str);
};


///--- Private methods

/**
 * upon receivng a request, route the request, then run the chain of handlers.
 * @private
 * @function _handle
 * @param    {Object} req the request object
 * @param    {Object} res the response object
 * @returns  {undefined}
 */
Server.prototype._handle = function _handle(req, res) {
    var self = this;

    function routeAndRun() {
        self._route(req, res, function (route, context) {
            req.context = req.params = context;
            req.route = route.spec;

            var r = route ? route.name : null;
            var chain = self.routes[r];

            self._run(req, res, route, chain, function done(e) {
                self.emit('after', req, res, route, e);
            });
        });
    }

    if (this.before.length > 0) {
        this._run(req, res, null, this.before, function (err) {
            if (!err) {
                routeAndRun();
            }
        });
    } else {
        routeAndRun();
    }
};


/**
 * look into the router, find the route object that should match this request.
 * @private
 * @function _route
 * @param    {Object}    req    the request object
 * @param    {Object}    res    the response object
 * @param    {String}    [name] name of the route
 * @param    {Function}  cb     callback function
 * @returns  {undefined}
 */
Server.prototype._route = function _route(req, res, name, cb) {
    var self = this;

    if (typeof (name) === 'function') {
        cb = name;
        name = null;

        this.router.find(req, res, function onRoute(err, route, ctx) {
            var r = route ? route.name : null;

            if (err) {
                if (optionsError(err, req, res)) {
                    self.emit('after', req, res, err);
                } else {
                    emitRouteError(self, req, res, err);
                }
            } else if (r === 'preflight') {
                res.writeHead(200);
                res.end();
                self.emit('after', req, res, null);
            } else if (!r || !self.routes[r]) {
                err = new ResourceNotFoundError(req.path());
                emitRouteError(self, res, res, err);
            } else {
                cb(route, ctx);
            }
        });
    } else {
        this.router.get(name, req, function (err, route, ctx) {
            if (err) {
                emitRouteError(self, req, res, err);
            } else {
                cb(route, ctx);
            }
        });
    }
};


/*
 * The goofy checks in next() are to make sure we fire the DTrace
 * probes after an error might have been sent, as in a handler
 * return next(new Error) is basically shorthand for sending an
 * error via res.send(), so we do that before firing the dtrace
 * probe (namely so the status codes get updated in the
 * response).
 *
 * Callers can stop the chain from proceding if they do
 * return next(false); This is useful for non-errors, but where
 * a response was sent and you don't want the chain to keep
 * going.
 *
 * @private
 * @function _run
 * @param    {Object}    req   the request object
 * @param    {Object}    res   the response object
 * @param    {Object}    route the route object
 * @param    {Array}     chain array of handler functions
 * @param    {Function}  cb    callback function
 * @returns  {undefined}
 */
Server.prototype._run = function _run(req, res, route, chain, cb) {
    var d;
    var i = -1;
    var id = dtrace.nextId();
    req._dtraceId = id;

    if (!req._anonFuncCount) {
        // Counter used to keep track of anonymous functions. Used when a
        // handler function is anonymous. This ensures we're using a
        // monotonically increasing int for anonymous handlers through out the
        // the lifetime of this request
        req._anonFuncCount = 0;
    }
    var log = this.log;
    var self = this;
    var handlerName = null;
    var errName;
    var emittedError = false;

    if (cb) {
        cb = once(cb);
    }

    function next(arg) {
        var done = false;

        if (arg) {
            if (arg instanceof Error) {
                errName = arg.name.replace(/Error$/, '');
                log.trace({err: arg, errName: errName}, 'next(err=%s)',
                    (arg.name || 'Error'));

                if (self.listeners(errName).length > 0) {
                    self.emit(errName, req, res, arg, once(function () {
                        res.send(arg);
                        return (cb ? cb(arg) : true);
                    }));
                    emittedError = true;
                } else {
                    res.send(arg);
                }
                done = true;
            } else if (typeof (arg) === 'string') { // GH-193, allow redirect
                if (req._rstfy_chained_route) {
                    var _e = new errors.InternalError();
                    log.error({
                        err: _e
                    }, 'Multiple next("chain") calls not ' +
                        'supported');
                    res.send(_e);
                    return (false);
                }

                // Stop running the rest of this route since we're redirecting
                return self._route(req, res, arg, function (r, ctx) {
                    req.context = req.params = ctx;
                    req.route = r.spec;

                    var _c = chain.slice(0, i + 1);

                    function _uniq(fn) {
                        return (_c.indexOf(fn) === -1);
                    }

                    var _routes = self.routes[r.name] || [];
                    var _chain = _routes.filter(_uniq);

                    req._rstfy_chained_route = true;

                    // Need to fire DTrace done for previous handler here too.
                    if ((i + 1) > 0 && chain[i] && !chain[i]._skip) {
                        req.endHandlerTimer(handlerName);
                    }
                    self._run(req, res, r, _chain, cb);
                });
            }
        }

        if (arg === false) {
            done = true;
        }

        // Fire DTrace done for the previous handler.
        if ((i + 1) > 0 && chain[i] && !chain[i]._skip) {
            req.endHandlerTimer(handlerName);
        }

        // Run the next handler up
        if (!done && chain[++i]) {
            if (chain[i]._skip) {
                return (next());
            }

            if (log.trace()) {
                log.trace('running %s', chain[i].name || '?');
            }

            req._currentRoute = (route !== null ? route.name : 'pre');
            handlerName = (chain[i].name ||
                           ('handler-' + req._anonFuncCount++));
            req._currentHandler = handlerName;
            req.startHandlerTimer(handlerName);

            var n = once(next);
            n.ifError = ifError(n);
            return (chain[i].call(self, req, res, n));
        }

        dtrace._rstfy_probes['route-done'].fire(function () {
            return ([
                self.name,
                route !== null ? route.name : 'pre',
                id,
                res.statusCode || 200,
                res.headers()
            ]);
        });

        if (route === null) {
            self.emit('preDone', req, res);
        } else {
            self.emit('done', req, res, route);
        }

        // Don't return cb here if we emit an error since we will cb after the
        // handler fires.
        if (!emittedError) {
            return (cb ? cb(arg) : true);
        } else {
            return (true);
        }
    }

    var n1 = once(next);
    n1.ifError = ifError(n1);

    dtrace._rstfy_probes['route-start'].fire(function () {
        return ([
            self.name,
            route !== null ? route.name : 'pre',
            id,
            req.method,
            req.href(),
            req.headers
        ]);
    });

    d = domain.create();
    d.add(req);
    d.add(res);
    d.on('error', function onError(err) {
        if (err._restify_next) {
            err._restify_next(err);
        } else {
            log.trace({err: err}, 'uncaughtException');
            self.emit('uncaughtException', req, res, route, err);
        }
    });
    d.run(n1);
};


/**
 * set up the request by before routing and executing handler chain.
 * @private
 * @function _setupRequest
 * @param    {Object}    req the request object
 * @param    {Object}    res the response object
 * @returns  {undefined}
 */
Server.prototype._setupRequest = function _setupRequest(req, res) {
    req.log = res.log = this.log;
    req._time = res._time = Date.now();
    req.serverName = this.name;

    res.acceptable = this.acceptable;
    res.formatters = this.formatters;
    res.req = req;
    res.serverName = this.name;
    res.version = this.router.versions[this.router.versions.length - 1];
};
