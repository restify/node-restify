// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var domain = require('domain');
var EventEmitter = require('events').EventEmitter;
var http = require('http');
var https = require('https');
var util = require('util');

var _ = require('lodash');
var assert = require('assert-plus');
var errors = require('restify-errors');
var mime = require('mime');
var once = require('once');
var semver = require('semver');
var spdy = require('spdy');
var uuid = require('uuid');
var vasync = require('vasync');

var dtrace = require('./dtrace');
var formatters = require('./formatters');
var shallowCopy = require('./utils').shallowCopy;
var upgrade = require('./upgrade');
var deprecationWarnings = require('./deprecationWarnings');

// Ensure these are loaded
require('./request');
require('./response');


///--- Globals

var sprintf = util.format;
var maxSatisfying = semver.maxSatisfying;
var ResourceNotFoundError = errors.ResourceNotFoundError;
var PROXY_EVENTS = [
    'clientError',
    'close',
    'connection',
    'error',
    'listening',
    'secureConnection'
];


///--- API

/**
 * Creates a new Server.
 * @public
 * @class
 * @param {Object} options  - an options object
 * @param {String} options.name - Name of the server.
 * @param {Router} options.router - Router
 * @param {Object} options.log - [bunyan](https://github.com/trentm/node-bunyan)
 * instance.
 * @param {String|Array} [options.version] - Default version(s) to use in all
 * routes.
 * @param {Array} [options.acceptable] - String)|List of content-types this
 * server can respond with.
 * @param {String} [options.url] - Once listen() is called, this will be filled
 * in with where the server is running.
 * @param {String|Buffer} [options.certificate] - If you want to create an HTTPS
 * server, pass in a PEM-encoded certificate and key.
 * @param {String|Buffer} [options.key] - If you want to create an HTTPS server,
 * pass in a PEM-encoded certificate and key.
 * @param {Object} [options.formatters] - Custom response formatters for
 * `res.send()`.
 * @param {Boolean} [options.handleUncaughtExceptions=false] - When true restify
 * will use a domain to catch and respond to any uncaught
 * exceptions that occur in it's handler stack.
 * [bunyan](https://github.com/trentm/node-bunyan) instance.
 * response header, default is `restify`. Pass empty string to unset the header.
 * @param {Object} [options.spdy] - Any options accepted by
 * [node-spdy](https://github.com/indutny/node-spdy).
 * @param {Boolean} [options.handleUpgrades=false] - Hook the `upgrade` event
 * from the node HTTP server, pushing `Connection: Upgrade` requests through the
 *  regular request handling chain.
 * @param {Object} [options.httpsServerOptions] - Any options accepted by
 * [node-https Server](http://nodejs.org/api/https.html#https_https).
 * If provided the following restify server options will be ignored:
 * spdy, ca, certificate, key, passphrase, rejectUnauthorized, requestCert and
 * ciphers; however these can all be specified on httpsServerOptions.
 * @param {Boolean} [options.strictRouting=false] - If set, Restify
 * will treat "/foo" and "/foo/" as different paths.
 * @example
 * var restify = require('restify');
 * var server = restify.createServer();
 *
 * srv.listen(8080, function () {
 *   console.log('ready on %s', srv.url);
 * });
 */
function Server(options) {
    assert.object(options, 'options');
    assert.object(options.log, 'options.log');
    assert.object(options.router, 'options.router');
    assert.string(options.name, 'options.name');

    var self = this;

    EventEmitter.call(this);

    this.before = [];
    this.chain = [];
    this.log = options.log;
    this.name = options.name;
    this.handleUncaughtExceptions = options.handleUncaughtExceptions || false;
    this.router = options.router;
    this.routes = {};
    this.secure = false;
    this.socketio = options.socketio || false;
    this._once = (options.strictNext === false) ? once : once.strict;
    this.versions = options.versions || options.version || [];
    this._inflightRequests = 0;

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

    // print deprecation messages based on server configuration
    deprecationWarnings(self);
}
util.inherits(Server, EventEmitter);

module.exports = Server;


///--- Server lifecycle methods

// FIXME: unnecessary jscs rule
// for more info check out: https://github.com/jscs-dev/node-jscs/issues/2226
// jscs:disable disallowTrailingWhitespace
/**
 * Gets the server up and listening.
 * Wraps node's
 * [listen()](
 * http://nodejs.org/docs/latest/api/net.html#net_server_listen_path_callback).
 *
 * @public
 * @memberof Server
 * @instance
 * @method   listen
 * @throws   {TypeError}
 * @param    {Number} port Port
 * @param    {Number} [host] Host
 * @param    {Function} callback optionally get notified when listening.
 * @returns  {undefined}
 * @example
 * <caption>You can call like:</caption>  
 * server.listen(80)
 * server.listen(80, '127.0.0.1')
 * server.listen('/tmp/server.sock')
 */
Server.prototype.listen = function listen() {
    var args = Array.prototype.slice.call(arguments);
    return (this.server.listen.apply(this.server, args));
};


/**
 * Shuts down this server, and invokes callback (optionally) when done.
 * Wraps node's
 * [close()](http://nodejs.org/docs/latest/api/net.html#net_event_close).
 * @public
 * @memberof Server
 * @instance
 * @method   close
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


///--- Routing methods


/**
 * Server method opts
 * @typedef  {String|Regexp |Object} Server~methodOpts
 * @type     {Object}
 * @property {String} name a name for the route
 * @property {String|Regexp} path a string or regex matching the route
 * @property {String|ArrayOfString} version versions supported by this route
 * @example
 * // a static route
 * server.get('/foo', function(req, res, next) {});
 * // a parameterized route
 * server.get('/foo/:bar', function(req, res, next) {});
 * // a regular expression
 * server.get(/^\/([a-zA-Z0-9_\.~-]+)\/(.*)/, function(req, res, next) {});
 * // an options object
 * server.get({
 *     path: '/foo',
 *     version: ['1.0.0', '2.0.0']
 * }, function(req, res, next) {});
 */


/**
 * Mounts a chain on the given path against this HTTP verb
 *
 * @public
 * @memberof Server
 * @instance
 * @method get
 * @param   {Server~methodOpts} opts - if string, the URL to handle.
 *                                 if options, the URL to handle, at minimum.
 * @returns {Route}                the newly created route.
 */
Server.prototype.get = serverMethodFactory('GET');

/**
 * Mounts a chain on the given path against this HTTP verb
 *
 * @public
 * @memberof Server
 * @instance
 * @method head
 * @param   {Server~methodOpts} opts - if string, the URL to handle.
 *                                 if options, the URL to handle, at minimum.
 * @returns {Route}                the newly created route.
 */
Server.prototype.head = serverMethodFactory('HEAD');


/**
 * Mounts a chain on the given path against this HTTP verb
 *
 * @public
 * @memberof Server
 * @instance
 * @method post
 * @param   {Server~methodOpts} post - if string, the URL to handle.
 *                                 if options, the URL to handle, at minimum.
 * @returns {Route}                the newly created route.
 */
Server.prototype.post = serverMethodFactory('POST');

/**
 * Mounts a chain on the given path against this HTTP verb
 *
 * @public
 * @memberof Server
 * @instance
 * @method put
 * @param   {Server~methodOpts} put - if string, the URL to handle.
 *                                 if options, the URL to handle, at minimum.
 * @returns {Route}                the newly created route.
 */
Server.prototype.put = serverMethodFactory('PUT');

/**
 * Mounts a chain on the given path against this HTTP verb
 *
 * @public
 * @memberof Server
 * @instance
 * @method patch
 * @param   {Server~methodOpts} patch - if string, the URL to handle.
 *                                 if options, the URL to handle, at minimum.
 * @returns {Route}                the newly created route.
 */
Server.prototype.patch = serverMethodFactory('PATCH');


/**
 * Mounts a chain on the given path against this HTTP verb
 *
 * @public
 * @memberof Server
 * @instance
 * @method del
 * @param   {Server~methodOpts} opts - if string, the URL to handle.
 *                                 if options, the URL to handle, at minimum.
 * @returns {Route}                the newly created route.
 */
Server.prototype.del = serverMethodFactory('DELETE');


/**
 * Mounts a chain on the given path against this HTTP verb
 *
 * @public
 * @memberof Server
 * @instance
 * @method opts
 * @param   {Server~methodOpts} opts - if string, the URL to handle.
 *                                 if options, the URL to handle, at minimum.
 * @returns {Route}                the newly created route.
 */
Server.prototype.opts = serverMethodFactory('OPTIONS');


///---  Request lifecycle and middleware methods


/**
 * Gives you hooks to run _before_ any routes are located.  This gives you
 * a chance to intercept the request and change headers, etc., that routing
 * depends on.  Note that req.params will _not_ be set yet.
 * @public
 * @memberof Server
 * @instance
 * @function pre
 * @param {Function|Array} handler - Allows you to add handlers that run for all
 * routes. *before* routing occurs.
 * This gives you a hook to change request headers and the like if you need to.
 * Note that `req.params` will be undefined, as that's filled in *after*
 * routing.
 * Takes a function, or an array of functions.
 * variable number of nested arrays of handler functions
 * @returns {Object} returns self
 * @example
 * server.pre(function(req, res, next) {
 *   req.headers.accept = 'application/json';
 *   return next();
 * });
 * @example
 * <caption>For example, `pre()` can be used to deduplicate slashes in
 * URLs</caption>
 * server.pre(restify.pre.dedupeSlashes());
 */
Server.prototype.pre = function pre() {
    var self = this;
    var handlers = Array.prototype.slice.call(arguments);

    argumentsToChain(handlers).forEach(function (h) {
        self.before.push(h);
    });

    return (this);
};


/**
 * Allows you to add in handlers that run for all routes. Note that handlers
 * added
 * via `use()` will run only after the router has found a matching route. If no
 * match is found, these handlers will never run. Takes a function, or an array
 * of functions.
 *
 * You can pass in any combination of functions or array of functions.
 * @public
 * @memberof Server
 * @instance
 * @function use
 * @param {Function|Array} handlers - A variable number of handler functions
 * * and/or a
 * variable number of nested arrays of handler functions
 * @returns {Object} returns self
 */
Server.prototype.use = function use() {
    var self = this;
    var handlers = Array.prototype.slice.call(arguments);

    argumentsToChain(handlers).forEach(function (h) {
        self.chain.push(h);
    });

    return (this);
};


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
 * @memberof Server
 * @instance
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
 * function that only fires if the specified version matches the request.
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
 * @memberof Server
 * @instance
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
 * @memberof Server
 * @instance
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


///--- Info and debug methods


/**
 * Returns the server address.
 * Wraps node's
 * [address()](http://nodejs.org/docs/latest/api/net.html#net_server_address).
 * @public
 * @memberof Server
 * @instance
 * @function address
 * @returns  {String}
 */
Server.prototype.address = function address() {
    return (this.server.address());
};


/**
 * Returns the number of inflight requests currently being handled by the server
 * @public
 * @memberof Server
 * @instance
 * @function inflightRequests
 * @returns  {number}
 */
Server.prototype.inflightRequests = function inflightRequests() {
    var self = this;
    return (self._inflightRequests);
};


/**
 * Return debug information about the server.
 * @public
 * @memberof Server
 * @instance
 * @method debugInfo
 * @returns {Object}
 */
Server.prototype.getDebugInfo = function getDebugInfo() {
    var self = this;

    // map an array of function to an array of function names
    var funcNameMapper = function funcNameMapper(handler) {
        if (handler.name === '') {
            return 'anonymous';
        } else {
            return handler.name;
        }
    };

    if (!self._debugInfo) {
        var addressInfo = self.server.address();

        // output the actual routes registered with restify
        var routeInfo = self.router.getDebugInfo();
        // get each route's handler chain
        _.forEach(routeInfo, function (value, key) {
            var routeName = value.name;
            value.handlers = self.routes[routeName].map(funcNameMapper);
        });

        self._debugInfo = {
            routes: routeInfo,
            server: {
                formatters: self.formatters,
                // if server is not yet listening, addressInfo may be null
                address: (addressInfo && addressInfo.address),
                port: (addressInfo && addressInfo.port),
                inflightRequests: self.inflightRequests(),
                pre: self.before.map(funcNameMapper),
                use: self.chain.map(funcNameMapper),
                after: self.listeners('after').map(funcNameMapper)
            }
        };
    }

    return self._debugInfo;
};


/**
 * toString() the server for easy reading/output.
 * @public
 * @memberof Server
 * @instance
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
 * @memberof Server
 * @instance
 * @function _handle
 * @param    {Object} req the request object
 * @param    {Object} res the response object
 * @returns  {undefined}
 */
Server.prototype._handle = function _handle(req, res) {
    var self = this;

    // increment number of requests
    self._inflightRequests++;
    // emit 'pre' event before we run the pre handlers
    self.emit('pre', req, res);

    function routeAndRun() {
        self._route(req, res, function (route, context) {
            // emit 'routed' event after the req has been routed
            self.emit('routed', req, res, route);
            req.context = req.params = context;
            req.route = route.spec;

            var r = route ? route.name : null;
            var chain = self.routes[r];

            self._run(req, res, route, chain, function done(e) {
                self._finishReqResCycle(req, res, route, e);
            });
        });
    }

    // run pre() handlers first before routing and running
    if (self.before.length > 0) {
        self._run(req, res, null, self.before, function (err) {
            // Like with regular handlers, if we are provided an error, we
            // should abort the middleware chain and fire after events.
            if (err === false || err instanceof Error) {
                self._finishReqResCycle(req, res, null, err);
                return;
            }

            routeAndRun();
        });
    } else {
        routeAndRun();
    }
};


/**
 * look into the router, find the route object that should match this request.
 * if a route cannot be found, fire error events then flush the error out.
 * @private
 * @memberof Server
 * @instance
 * @function _route
 * @param    {Object}    req    the request object
 * @param    {Object}    res    the response object
 * @param    {String}    [name] name of the route
 * @param    {Function}  cb     callback function
 * @returns  {undefined}
 */
Server.prototype._route = function _route(req, res, name, cb) {
    var self = this;
    // helper function to, when on router error, emit error events and then
    // flush the err.
    var errResponse = function errResponse(err) {
        return self._emitErrorEvents(req, res, null, err, function () {
            res.send(err);
            return self._finishReqResCycle(req, res, null, err);
        });
    };

    if (typeof (name) === 'function') {
        cb = name;
        name = null;

        return this.router.find(req, res, function onRoute(err, route, ctx) {
            var r = route ? route.name : null;

            if (err) {
                // TODO: if its a 404 for OPTION method (likely a CORS
                // preflight), return OK. This should move into userland.
                if (optionsError(err, req, res)) {
                    res.send(200);
                    return self._finishReqResCycle(req, res, null, null);
                } else {
                    return errResponse(err);
                }
            } else if (!r || !self.routes[r]) {
                err = new ResourceNotFoundError(req.path());
                return errResponse(err);
            } else {
                // else no err, continue
                return cb(route, ctx);
            }
        });
    } else {
        return this.router.get(name, req, function (err, route, ctx) {
            if (err) {
                return errResponse(err);
            } else {
                // else no err, continue
                return cb(route, ctx);
            }
        });
    }
};


/**
 * `cb()` is called when execution is complete. "completion" can occur when:
 * 1) all functions in handler chain have been executed
 * 2) users invoke `next(false)`. this indicates the chain should stop
 * executing immediately.
 * 3) users invoke `next(err)`. this is sugar for calling res.send(err) and
 * firing any error events. after error events are done firing, it will also
 * stop execution.
 *
 * The goofy checks in next() are to make sure we fire the DTrace
 * probes after an error might have been sent, as in a handler
 * return next(new Error) is basically shorthand for sending an
 * error via res.send(), so we do that before firing the dtrace
 * probe (namely so the status codes get updated in the
 * response).
 *
 * there are two important closure variables in this function as a result of
 * the way `next()` is currently implemented. `next()` assumes logic is sync,
 * and automatically calls cb() when a route is considered complete. however,
 * for case #3, emitted error events are async and serial. this means the
 * automatic invocation of cb() cannot occur:
 *
 * 1) `emittingErrors` - this boolean is set to true when the server is still
 * emitting error events. this var is used to avoid automatic invocation of
 * cb(), which is delayed until all async error events are fired.
 * 2) `done` - when next is invoked with a value of `false`, or handler if
 *
 * @private
 * @memberof Server
 * @instance
 * @function _run
 * @param    {Object}    req   the request object
 * @param    {Object}    res   the response object
 * @param    {Object}    route the route object
 * @param    {Array}     chain array of handler functions
 * @param    {Function}  cb    callback function
 * @emits    redirect
 * @returns  {undefined}
 */
Server.prototype._run = function _run(req, res, route, chain, cb) {
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
    var emittingErrors = false;
    cb = self._once(cb);

    // attach a listener for 'close' and 'aborted' events, this will let us set
    // a flag so that we can stop processing the request if the client closes
    // the connection (or we lose the connection).
    function _requestClose() {
        req._connectionState = 'close';
    }
    function _requestAborted() {
        req._connectionState = 'aborted';
    }
    req.once('close', _requestClose);
    req.once('aborted', _requestAborted);

    // attach a listener for the response's 'redirect' event
    res.on('redirect', function (redirectLocation) {
        self.emit('redirect', redirectLocation);
    });

    function next(arg) {
        // default value of done determined by whether or not there is another
        // function in the chain and/or if req was not already closed. we will
        // consume the value of `done` after dealing with any passed in values
        // of `arg`.
        var done = false;

        if (typeof arg !== 'undefined') {
            if (arg instanceof Error) {
                // the emitting of the error events are async, so we can not
                // complete this invocation of run() until it returns. set a
                // flag so that the automatic invocation of cb() at the end of
                // this function is bypassed.
                emittingErrors = true;
                // set the done flag - allows us to stop execution of handler
                // chain now that an error has occurred.
                done = true;
                // now emit error events in serial and async
                self._emitErrorEvents(req, res, route, arg,
                function emitErrorsDone() {
                    res.send(arg);
                    return cb(arg);
                });
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

                // Stop running the rest of this route since we're redirecting.
                // do this instead of setting done since the route technically
                // isn't complete yet.
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
            } else if (arg === false) {
                done = true;
            }
        }

        // Fire DTrace done for the previous handler.
        if ((i + 1) > 0 && chain[i] && !chain[i]._skip) {
            req.endHandlerTimer(handlerName);
        }

        // Run the next handler up
        if (!done && chain[++i] && !_reqClosed(req)) {
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

            var n = self._once(next);

            // support ifError only if domains are on
            if (self.handleUncaughtExceptions === true) {
                n.ifError = ifError(n);
            }
            return (chain[i].call(self, req, res, n));
        }

        // if we have reached this last section of next(), then we are 'done'
        // with this route.
        dtrace._rstfy_probes['route-done'].fire(function () {
            return ([
                self.name,
                route !== null ? route.name : 'pre',
                id,
                res.statusCode || 200,
                res.headers()
            ]);
        });

        // if there is no route, it's because this is running the `pre` handler
        // chain.
        if (route === null) {
            self.emit('preDone', req, res);
        } else {
            req.removeListener('close', _requestClose);
            req.removeListener('aborted', _requestAborted);
            self.emit('done', req, res, route);
        }

        // if we have reached here, there are no more handlers in the chain, or
        // we next(err), and we are done with the request. if errors are still
        // being emitted (due to being async), skip calling cb now, that will
        // happen after all error events are done being emitted.
        if (emittingErrors === false) {
            return cb(arg);
        }

        // don't really need to return anything, returning null to placate
        // eslint.
        return null;
    }

    var n1 = self._once(next);

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

    req.timers = [];

    if (!self.handleUncaughtExceptions) {
        return n1();
    } else {
        n1.ifError = ifError(n1);
        // Add the uncaughtException error handler.
        var d = domain.create();
        d.add(req);
        d.add(res);
        d.on('error', function onError(err) {
            if (err._restify_next) {
                err._restify_next(err);
            } else {
                log.trace({err: err}, 'uncaughtException');
                self.emit('uncaughtException', req, res, route, err);
                self._finishReqResCycle(req, res, route, err);
            }
        });
        return d.run(n1);
    }
};


/**
 * set up the request before routing and execution of handler chain functions.
 * @private
 * @memberof Server
 * @instance
 * @function _setupRequest
 * @param    {Object}    req the request object
 * @param    {Object}    res the response object
 * @returns  {undefined}
 */
Server.prototype._setupRequest = function _setupRequest(req, res) {

    var self = this;
    req.log = res.log = self.log;
    req._time = process.hrtime();
    req.serverName = self.name;

    res.acceptable = self.acceptable;
    res.formatters = self.formatters;
    res.req = req;
    res.serverName = self.name;

    // set header only if name isn't empty string
    if (self.name !== '') {
        res.header('Server', self.name);
    }
    res.version = self.router.versions[self.router.versions.length - 1];
};


/**
 * emit error events when errors are encountered either while attempting to
 * route the request (via router) or while executing the handler chain.
 * @private
 * @memberof Server
 * @instance
 * @function _emitErrorEvents
 * @param    {Object} req    the request object
 * @param    {Object} res    the response object
 * @param    {Object} route  the current route, if applicable
 * @param    {Object} err    an error object
 * @param    {Object} cb     callback function
 * @returns  {undefined}
 */
Server.prototype._emitErrorEvents =
function _emitErrorEvents(req, res, route, err, cb) {

    var self = this;
    var errName = errEvtNameFromError(err);

    req.log.trace({
        err: err,
        errName: errName
    }, 'entering emitErrorEvents', err.name);

    var errEvtNames = [];

    // if we have listeners for the specific error, fire those first.
    if (self.listeners(errName).length > 0) {
        errEvtNames.push(errName);
    }

    // or if we have a generic error listener. always fire generic error event
    // listener afterwards.
    if (self.listeners('restifyError').length > 0) {
        errEvtNames.push('restifyError');
    }

    // kick off the async listeners
    return vasync.forEachPipeline({
        inputs: errEvtNames,
        func: function emitError(errEvtName, vasyncCb) {
            self.emit(errEvtName, req, res, err, function emitErrDone() {
                // the error listener may return arbitrary objects, throw
                // them away and continue on. don't want vasync to take
                // that error and stop, we want to emit every single event.
                return vasyncCb();
            });
        }
    }, function (nullErr, results) { // eslint-disable-line handle-callback-err
        // vasync will never return error here. callback with the original
        // error to pass it on.
        return cb(err);
    });
};


/**
 * wrapper method for emitting the after event. this is needed in scenarios
 * where the async formatter has failed, and the ot assume that the
 * original res.send() status code is no longer valid (it is now a 500). check
 * if the response is finished, and if not, wait for it before firing the
 * response object.
 * @private
 * @memberof Server
 * @instance
 * @method _finishReqResCycle
 * @param {Object} req the request object
 * @param {Object} res the response object
 * @param {Object} [route] the matched route
 * @param {Object} [err] a possible error as a result of failed route matching
 * or failed execution of the handler array.
 * @returns {undefined}
 */
Server.prototype._finishReqResCycle =
function _finishReqResCycle(req, res, route, err) {

    var self = this;

    // res.finished is set by node core's response object, when
    // res.end() completes. if the request was closed by the client, then emit
    // regardless of res status.

    // after event has signature of function(req, res, route, err) {...}
    if (!res.finished && !_reqClosed(req)) {
        res.once('finish', function resFinished() {
            self.emit('after', req, res, route, err || res.formatterErr);
        });
    } else {
        // if there was an error in the processing of that request, use it.
        // if not, check to see if the request was closed or aborted early and
        // create an error out of that for audit logging.
        var afterErr = err;

        if (!afterErr) {
            if (req._connectionState === 'close') {
                afterErr = new errors.RequestCloseError();
            } else if (req._connectionState === 'aborted') {
                afterErr = new errors.RequestAbortedError();
            }
        }

        self.emit('after', req, res, route, afterErr);
    }

    // decrement number of requests
    self._inflightRequests--;
};


///--- Helpers


/**
 * helper function that returns true if the request was closed or aborted.
 * @private
 * @function _reqClosed
 * @param {Object} req the request object
 * @returns {Boolean}
 */
function _reqClosed(req) {
    return (req._connectionState === 'close' ||
            req._connectionState === 'aborted');
}


/**
 * Verify and flatten a nested array of request handlers.
 *
 * @private
 * @function argumentsToChain
 * @throws   {TypeError}
 * @param    {Array} handlers - pass through of funcs from server.[method]
 * @returns  {Array}
 */
function argumentsToChain(handlers) {
    assert.array(handlers, 'handlers');

    var chain = [];

    // A recursive function for unwinding a nested array of handlers into a
    // single chain.
    function process(array) {
        for (var i = 0; i < array.length; i++) {
            if (Array.isArray(array[i])) {
                // Recursively call on nested arrays
                process(array[i]);
                continue;
            }
            // If an element of the array isn't an array, ensure it is a
            // handler function and then push it onto the chain of handlers
            assert.func(array[i], 'handler');
            chain.push(array[i]);
        }

        return chain;
    }

    // Return the chain, note that if `handlers` is an empty array, this will
    // return an empty array.
    return process(handlers);
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
 *
 * @private
 * @deprecated since 5.x
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
 * returns true if the router generated a 404 for an options request.
 *
 * TODO: this is relevant for CORS only. Should move this out eventually to a
 * userland middleware? This also seems a little like overreach, as there is no
 * option to opt out of this behavior today.
 * @private
 * @function optionsError
 * @param    {Object}     err an error object
 * @param    {Object}     req the request object
 * @param    {Object}     res the response object
 * @returns  {Boolean}
 */
function optionsError(err, req, res) {
    return (
        err.statusCode === 404 &&
        req.method === 'OPTIONS' &&
        req.url === '*'
    );
}


/**
 * map an Error's .name property into the actual event name that is emitted
 * by the restify server object.
 * @function
 * @private errEvtNameFromError
 * @param {Object} err an error object
 * @returns {String} an event name to emit
 */
function errEvtNameFromError(err) {
    if (err.name === 'ResourceNotFoundError') {
        // remap the name for router errors
        return 'NotFound';
    } else if (err.name === 'InvalidVersionError') {
        // remap the name for router errors
        return 'VersionNotAllowed';
    } else {
        return err.name.replace(/Error$/, '');
    }
}


/**
 * Mounts a chain on the given path against this HTTP verb
 *
 * @private
 * @function serverMethodFactory
 * @param {String} method - name of the HTTP method
 * @returns {Function}
 */
function serverMethodFactory (method) {
    return function (opts) {
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

        opts.method = method;
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
        }

        if (!(route = this.router.mount(opts))) {
            return (false);
        }

        this.chain.forEach(addHandler);
        // We accept both a variable number of handler functions, a
        // variable number of nested arrays of handler functions, or a mix
        // of both
        argumentsToChain(Array.prototype.slice.call(arguments, 1))
            .forEach(addHandler);
        this.routes[route] = chain;

        return (route);
    };
}
