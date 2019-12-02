// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var EventEmitter = require('events').EventEmitter;
var http = require('http');
var https = require('https');
var util = require('util');

var _ = require('lodash');
var assert = require('assert-plus');
var errors = require('restify-errors');
var mime = require('mime');
var spdy = require('spdy');
var vasync = require('vasync');

var Chain = require('./chain');
var dtrace = require('./dtrace');
var formatters = require('./formatters');
var shallowCopy = require('./utils').shallowCopy;
var upgrade = require('./upgrade');
var deprecationWarnings = require('./deprecationWarnings');
var customErrorTypes = require('./errorTypes');

// Ensure these are loaded
var patchRequest = require('./request');
var patchResponse = require('./response');

var domain;
var http2;

patchResponse(http.ServerResponse);
patchRequest(http.IncomingMessage);

///--- Globals

var sprintf = util.format;

///--- API

/**
 * Creates a new Server.
 *
 * @public
 * @class
 * @param {Object} options  - an options object
 * @param {String} options.name - Name of the server.
 * @param {Boolean} [options.dtrace=false] - enable DTrace support
 * @param {Router} options.router - Router
 * @param {Object} options.log - [bunyan](https://github.com/trentm/node-bunyan)
 * instance.
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
 * Comes with significant negative performance impact.
 * [bunyan](https://github.com/trentm/node-bunyan) instance.
 * response header, default is `restify`. Pass empty string to unset the header.
 * @param {Object} [options.spdy] - Any options accepted by
 * [node-spdy](https://github.com/indutny/node-spdy).
 * @param {Object} [options.http2] - Any options accepted by
 * [http2.createSecureServer](https://nodejs.org/api/http2.html).
 * @param {Boolean} [options.handleUpgrades=false] - Hook the `upgrade` event
 * from the node HTTP server, pushing `Connection: Upgrade` requests through the
 *  regular request handling chain.
 * @param {Boolean} [options.onceNext=false] - Prevents calling next multiple
 *  times
 * @param {Boolean} [options.strictNext=false] - Throws error when next() is
 *  called more than once, enabled onceNext option
 * @param {Object} [options.httpsServerOptions] - Any options accepted by
 * [node-https Server](http://nodejs.org/api/https.html#https_https).
 * If provided the following restify server options will be ignored:
 * spdy, ca, certificate, key, passphrase, rejectUnauthorized, requestCert and
 * ciphers; however these can all be specified on httpsServerOptions.
 * @param {Boolean} [options.noWriteContinue=false] - prevents
 *  `res.writeContinue()` in `server.on('checkContinue')` when proxing
 * @param {Boolean} [options.ignoreTrailingSlash=false] - ignore trailing slash
 * on paths
 * @param {Boolean} [options.strictFormatters=true] - enables strict formatters
 * behavior: a formatter matching the response's content-type is required. If
 * not found, the response's content-type is automatically set to
 * 'application/octet-stream'. If a formatter for that content-type is not
 * found, sending the response errors.
 * @example
 * var restify = require('restify');
 * var server = restify.createServer();
 *
 * server.listen(8080, function () {
 *   console.log('ready on %s', server.url);
 * });
 */
function Server(options) {
    assert.object(options, 'options');
    assert.object(options.log, 'options.log');
    assert.object(options.router, 'options.router');
    assert.string(options.name, 'options.name');
    assert.optionalBool(
        options.handleUncaughtExceptions,
        'options.handleUncaughtExceptions'
    );
    assert.optionalBool(options.dtrace, 'options.dtrace');
    assert.optionalBool(options.socketio, 'options.socketio');
    assert.optionalBool(options.onceNext, 'options.onceNext');
    assert.optionalBool(options.strictNext, 'options.strictNext');
    assert.optionalBool(options.strictFormatters, 'options.strictFormatters');

    var self = this;

    EventEmitter.call(this);

    this.onceNext = !!options.onceNext;
    this.strictNext = !!options.strictNext;
    this.firstChain = [];
    this.preChain = new Chain({
        onceNext: this.onceNext,
        strictNext: this.strictNext
    });
    this.useChain = new Chain({
        onceNext: this.onceNext,
        strictNext: this.strictNext
    });
    this.log = options.log;
    this.name = options.name;
    this.handleUncaughtExceptions = options.handleUncaughtExceptions || false;
    this.router = options.router;
    this.secure = false;
    this.socketio = options.socketio || false;
    this.dtrace = options.dtrace || false;
    this._inflightRequests = 0;

    this.strictFormatters = true;
    if (options.strictFormatters !== undefined) {
        this.strictFormatters = options.strictFormatters;
    }

    var fmt = mergeFormatters(options.formatters);
    this.acceptable = fmt.acceptable;
    this.formatters = fmt.formatters;
    this.proxyEvents = [
        'clientError',
        'close',
        'connection',
        'error',
        'listening',
        'secureConnection'
    ];

    if (options.spdy) {
        this.spdy = true;
        this.server = spdy.createServer(options.spdy);
    } else if (options.http2) {
        // http2 module is not available < v8.4.0 (only with flag <= 8.8.0)
        // load http2 module here to avoid experimental warning in other cases
        if (!http2) {
            try {
                http2 = require('http2');
                patchResponse(http2.Http2ServerResponse);
                patchRequest(http2.Http2ServerRequest);
                // eslint-disable-next-line no-empty
            } catch (err) {}
        }

        assert(
            http2,
            'http2 module is not available, ' +
                'upgrade your Node.js version to >= 8.8.0'
        );

        this.http2 = true;
        this.server = http2.createSecureServer(options.http2);
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
            ciphers: options.ciphers,
            secureOptions: options.secureOptions
        });
    } else if (options.httpsServerOptions) {
        this.server = https.createServer(options.httpsServerOptions);
    } else {
        this.server = http.createServer();
    }

    this.router.on('mount', this.emit.bind(this, 'mount'));

    if (!options.handleUpgrades) {
        this.proxyEvents.push('upgrade');
    }
    this.proxyEvents.forEach(function forEach(e) {
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

        self._onRequest(req, res);
    });

    if (options.handleUpgrades) {
        this.server.on('upgrade', function onUpgrade(req, socket, head) {
            req._upgradeRequest = true;
            var res = upgrade.createResponse(req, socket, head);
            self._onRequest(req, res);
        });
    }

    this.server.on('request', this._onRequest.bind(this));

    this.__defineGetter__('maxHeadersCount', function getMaxHeadersCount() {
        return self.server.maxHeadersCount;
    });

    this.__defineSetter__('maxHeadersCount', function setMaxHeadersCount(c) {
        self.server.maxHeadersCount = c;
        return c;
    });

    this.__defineGetter__('url', function getUrl() {
        if (self.socketPath) {
            return 'http://' + self.socketPath;
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
            str +=
                addr.family === 'IPv6'
                    ? '[' + addr.address + ']'
                    : addr.address;
            str += ':';
            str += addr.port;
        } else {
            str += '169.254.0.1:0000';
        }

        return str;
    });

    // print deprecation messages based on server configuration
    deprecationWarnings(self);
}
util.inherits(Server, EventEmitter);

module.exports = Server;

///--- Server lifecycle methods

// eslint-disable-next-line jsdoc/check-param-names
/**
 * Gets the server up and listening.
 * Wraps node's
 * [listen()](
 * http://nodejs.org/docs/latest/api/net.html#net_server_listen_path_callback).
 *
 * @public
 * @memberof Server
 * @instance
 * @function   listen
 * @throws   {TypeError}
 * @param    {Number} port - Port
 * @param    {Number} [host] - Host
 * @param    {Function} [callback] - optionally get notified when listening.
 * @returns  {undefined} no return value
 * @example
 * <caption>You can call like:</caption>
 * server.listen(80)
 * server.listen(80, '127.0.0.1')
 * server.listen('/tmp/server.sock')
 */
Server.prototype.listen = function listen() {
    var args = Array.prototype.slice.call(arguments);
    return this.server.listen.apply(this.server, args);
};

/**
 * Shuts down this server, and invokes callback (optionally) when done.
 * Wraps node's
 * [close()](http://nodejs.org/docs/latest/api/net.html#net_event_close).
 *
 * @public
 * @memberof Server
 * @instance
 * @function   close
 * @param    {Function}  [callback] - callback to invoke when done
 * @returns  {undefined} no return value
 */
Server.prototype.close = function close(callback) {
    if (callback) {
        assert.func(callback, 'callback');
    }

    this.server.once('close', function onClose() {
        return callback ? callback() : false;
    });

    return this.server.close();
};

///--- Routing methods

/**
 * Server method opts
 * @typedef  {String|Regexp |Object} Server~methodOpts
 * @type     {Object}
 * @property {String} name a name for the route
 * @property {String} path can be any String accepted by
 * [find-my-way](https://github.com/delvedor/find-my-way)
 * @example
 * // a static route
 * server.get('/foo', function(req, res, next) {});
 * // a parameterized route
 * server.get('/foo/:bar', function(req, res, next) {});
 * // a regular expression
 * server.get('/example/:file(^\\d+).png', function(req, res, next) {});
 * // an options object
 * server.get({
 *     path: '/foo',
 * }, function(req, res, next) {});
 */

/**
 * Mounts a chain on the given path against this HTTP verb
 *
 * @public
 * @memberof Server
 * @instance
 * @function get
 * @param   {Server~methodOpts} opts - if string, the URL to handle.
 *                                 if options, the URL to handle, at minimum.
 * @returns {Route}                the newly created route.
 * @example
 * server.get('/', function (req, res, next) {
 *    res.send({ hello: 'world' });
 *    next();
 * });
 */
Server.prototype.get = serverMethodFactory('GET');

/**
 * Mounts a chain on the given path against this HTTP verb
 *
 * @public
 * @memberof Server
 * @instance
 * @function head
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
 * @function post
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
 * @function put
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
 * @function patch
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
 * @function del
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
 * @function opts
 * @param   {Server~methodOpts} opts - if string, the URL to handle.
 *                                 if options, the URL to handle, at minimum.
 * @returns {Route}                the newly created route.
 */
Server.prototype.opts = serverMethodFactory('OPTIONS');

///---  Request lifecycle and middleware methods

// eslint-disable-next-line jsdoc/check-param-names
/**
 * Gives you hooks to run _before_ any routes are located.  This gives you
 * a chance to intercept the request and change headers, etc., that routing
 * depends on.  Note that req.params will _not_ be set yet.
 *
 * @public
 * @memberof Server
 * @instance
 * @function pre
 * @param {...Function|Array} handler - Allows you to add handlers that
 * run for all routes. *before* routing occurs.
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

    argumentsToChain(handlers).forEach(function forEach(handler) {
        handler._name = handler.name || 'pre-' + self.preChain.count();
        self.preChain.add(handler);
    });

    return this;
};

// eslint-disable-next-line jsdoc/check-param-names
/**
 * Gives you hooks that run before restify touches a request. These hooks
 * allow you to do processing early in the request/response life cycle without
 * the overhead of the restify framework. You can not yield the event loop in
 * this handler.
 *
 * The function handler accepts two parameters: req, res. If you want restify
 * to ignore this request, return false from your handler. Return true or
 * undefined to let restify continue handling the request.
 *
 * When false is returned, restify immediately stops handling the request. This
 * means that no further middleware will be executed for any chain and routing
 * will not occure. All request/response handling for an incoming request must
 * be done inside the first handler if you intend to return false. This
 * includes things like closing the response and returning a status code.
 *
 * The only work restify does for a first handler is to increment the number of
 * inflightRequests prior to calling the chain, and decrement that value if the
 * handler returns false. Returning anything other than true, false, undefined,
 * or null will cause an exception to be thrown.
 *
 * Since server.first is designed to bypass the restify framework, there are
 * naturally trade-offs you make when using this API:
 *  * Standard restify lifecycle events such as 'after' are not triggered for
 *    any request that you return false from a handler for
 *  * Invoking any of the restify req/res APIs from within a first handler is
 *    unspecified behavior, as the restify framework hasn't built up state for
 *    the request yet.
 *  * There are no request timers available at the time that the first chain
 *    runs.
 *  * And more! Beware doing anything with restify in these handlers. They are
 *    designed to give you similar access to the req/res as you would have if
 *    you were directly using node.js' http module, they are outside of the
 *    restify framework!
 *
 * @public
 * @memberof Server
 * @instance
 * @function first
 * @param {...Function} handler - Allows you to add handlers that
 * run for all requests, *before* restify touches the request.
 * This gives you a hook to change request headers and the like if you need to.
 * Note that `req.params` will be undefined, as that's filled in *after*
 * routing.

 * Takes one or more functions.
 * @returns {Object} returns self
 * @example
 * server.first(function(req, res) {
 *   if(server.inflightRequests() > 100) {
 *     res.statusCode = 503;
 *     res.end();
 *     return false
 *   }
 *   return true;
 * })
 */
Server.prototype.first = function first() {
    var args = Array.prototype.slice.call(arguments);
    for (var i = 0; i < args.length; i++) {
        assert.func(args[i]);
        this.firstChain.push(args[i]);
    }
    return this;
};

// eslint-disable-next-line jsdoc/check-param-names
/**
 * Allows you to add in handlers that run for all routes. Note that handlers
 * added
 * via `use()` will run only after the router has found a matching route. If no
 * match is found, these handlers will never run. Takes a function, or an array
 * of functions.
 *
 * You can pass in any combination of functions or array of functions.
 *
 * @public
 * @memberof Server
 * @instance
 * @function use
 * @param {...Function|Array} handler - A variable number of handler functions
 * * and/or a
 * variable number of nested arrays of handler functions
 * @returns {Object} returns self
 */
Server.prototype.use = function use() {
    var self = this;
    var handlers = Array.prototype.slice.call(arguments);

    argumentsToChain(handlers).forEach(function forEach(handler) {
        handler._name = handler.name || 'use-' + self.useChain.count();
        self.useChain.add(handler);
    });

    return this;
};

/**
 * Minimal port of the functionality offered by Express.js Route Param
 * Pre-conditions
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
 * @see http://expressjs.com/guide.html#route-param%20pre-conditions
 * @public
 * @memberof Server
 * @instance
 * @function param
 * @param    {String}   name - The name of the URL param to respond to
 * @param    {Function} fn -   The middleware function to execute
 * @returns  {Object}        returns self
 */
Server.prototype.param = function param(name, fn) {
    this.use(function _param(req, res, next) {
        if (req.params && req.params.hasOwnProperty(name)) {
            fn.call(this, req, res, next, req.params[name], name);
        } else {
            next();
        }
    });

    return this;
};

/**
 * Removes a route from the server.
 * You pass in the route 'blob' you got from a mount call.
 *
 * @public
 * @memberof Server
 * @instance
 * @function rm
 * @throws   {TypeError} on bad input.
 * @param    {String}    routeName - the route name.
 * @returns  {Boolean}   true if route was removed, false if not.
 */
Server.prototype.rm = function rm(routeName) {
    var route = this.router.unmount(routeName);
    return !!route;
};

///--- Info and debug methods

/**
 * Returns the server address.
 * Wraps node's
 * [address()](http://nodejs.org/docs/latest/api/net.html#net_server_address).
 *
 * @public
 * @memberof Server
 * @instance
 * @function address
 * @returns  {Object} Address of server
 * @example
 * server.address()
 * @example
 * <caption>Output:</caption>
 * { address: '::', family: 'IPv6', port: 8080 }
 */
Server.prototype.address = function address() {
    return this.server.address();
};

/**
 * Returns the number of inflight requests currently being handled by the server
 *
 * @public
 * @memberof Server
 * @instance
 * @function inflightRequests
 * @returns  {number} number of inflight requests
 */
Server.prototype.inflightRequests = function inflightRequests() {
    var self = this;
    return self._inflightRequests;
};

/**
 * Return debug information about the server.
 *
 * @public
 * @memberof Server
 * @instance
 * @function debugInfo
 * @returns {Object} debug info
 * @example
 * server.getDebugInfo()
 * @example
 * <caption>Output:</caption>
 * {
 *   routes: [
 *     {
 *       name: 'get',
 *       method: 'get',
 *       input: '/',
 *       compiledRegex: /^[\/]*$/,
 *       compiledUrlParams: null,
 *       handlers: [Array]
 *      }
 *   ],
 *   server: {
 *     formatters: {
 *       'application/javascript': [Function: formatJSONP],
 *       'application/json': [Function: formatJSON],
 *       'text/plain': [Function: formatText],
 *       'application/octet-stream': [Function: formatBinary]
 *     },
 *     address: '::',
 *     port: 8080,
 *     inflightRequests: 0,
 *     pre: [],
 *     use: [ 'parseQueryString', '_jsonp' ],
 *     after: []
 *   }
 * }
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

        var preHandlers = self.preChain.getHandlers().map(funcNameMapper);
        var useHandlers = self.useChain.getHandlers().map(funcNameMapper);

        // get each route's handler chain
        var routes = _.map(routeInfo, function mapValues(route) {
            route.handlers = Array.prototype.concat.call(
                // TODO: should it contain use handlers?
                useHandlers,
                route.handlers.map(funcNameMapper)
            );
            return route;
        });

        self._debugInfo = {
            routes: routes,
            server: {
                formatters: self.formatters,
                // if server is not yet listening, addressInfo may be null
                address: addressInfo && addressInfo.address,
                port: addressInfo && addressInfo.port,
                inflightRequests: self.inflightRequests(),
                pre: preHandlers,
                use: useHandlers,
                after: self.listeners('after').map(funcNameMapper)
            }
        };
    }

    return self._debugInfo;
};

/**
 * toString() the server for easy reading/output.
 *
 * @public
 * @memberof Server
 * @instance
 * @function toString
 * @returns  {String} stringified server
 * @example
 * server.toString()
 * @example
 * <caption>Output:</caption>
 *	Accepts: application/json, text/plain, application/octet-stream,
 * application/javascript
 *	Name: restify
 *	Pre: []
 *	Router: RestifyRouter:
 *		DELETE: []
 *		GET: [get]
 *		HEAD: []
 *		OPTIONS: []
 *		PATCH: []
 *		POST: []
 *		PUT: []
 *
 *	Routes:
 *		get: [parseQueryString, _jsonp, function]
 *	Secure: false
 *	Url: http://[::]:8080
 *	Version:
 */
Server.prototype.toString = function toString() {
    var LINE_FMT = '\t%s: %s\n';
    var SUB_LINE_FMT = '\t\t%s: %s\n';
    var str = '';

    function handlersToString(arr) {
        var s =
            '[' +
            arr
                .map(function map(b) {
                    return b.name || 'function';
                })
                .join(', ') +
            ']';

        return s;
    }

    str += sprintf(LINE_FMT, 'Accepts', this.acceptable.join(', '));
    str += sprintf(LINE_FMT, 'Name', this.name);
    str += sprintf(
        LINE_FMT,
        'Pre',
        handlersToString(this.preChain.getHandlers())
    );
    str += sprintf(LINE_FMT, 'Router', '');
    this.router
        .toString()
        .split('\n')
        .forEach(function forEach(line) {
            str += sprintf('\t\t%s\n', line);
        });
    str += sprintf(LINE_FMT, 'Routes', '');
    _.forEach(this.router.getRoutes(), function forEach(route, routeName) {
        var handlers = handlersToString(route.chain.getHandlers());
        str += sprintf(SUB_LINE_FMT, routeName, handlers);
    });
    str += sprintf(LINE_FMT, 'Secure', this.secure);
    str += sprintf(LINE_FMT, 'Url', this.url);

    return str;
};

///--- Private methods

// Lifecycle:
//
// 1. _onRequest (handle new request, setup request and triggers pre)
//   2. _runPre
//     3. _afterPre (runs after pre handlers are finisehd, triggers route)
//       4. _runRoute (route lookup)
//         5. _runUse (runs use handlers, if route exists)
//            6. Runs route handlers
//              7. _afterRoute (runs after route handlers are finised,
//                          triggers use)
// 8. _finishReqResCycle (on response "finish" and "error" events)
//
// Events:
// e.1 after (triggered when response is flushed)
//
// Errors:
// e.1 _onHandlerError (runs when next was called with an Error)
//   e.2 _routeErrorResponse
// e.1 _onHandlerError (when, next('string') called, trigger route by name)
//  e.2 _afterRoute

/**
 * Setup request and calls _onRequest to run middlewares and call router
 *
 * @private
 * @memberof Server
 * @instance
 * @function _onRequest
 * @param    {Object}    req - the request object
 * @param    {Object}    res - the response object
 * @returns  {undefined} no return value
 * @fires Request,Response#request
 */
Server.prototype._onRequest = function _onRequest(req, res) {
    var self = this;

    // Increment the number of inflight requests prior to calling the firstChain
    // handlers. This accomplishes two things. First, it gives earliest an
    // accurate count of how many inflight requests there would be including
    // this new request. Second, it intentionally winds up the inflight request
    // accounting with the implementation of firstChain. Note how we increment
    // here, but decrement down inside the for loop below. It's easy to end up
    // with race conditions betwen inflight request accounting and inflight
    // request load shedding, causing load shedding to reject/allow too many
    // requests. The current implementation of firstChain is designed to
    // remove those race conditions. By winding these implementations up with
    // one another, it makes it clear that moving around the inflight request
    // accounting will change the behavior of earliest.
    self._inflightRequests++;

    // Give the first chain the earliest possible opportunity to process
    // this request before we do any work on it.
    var firstChain = self.firstChain;
    for (var i = 0; i < firstChain.length; i++) {
        var handle = firstChain[i](req, res);
        // Limit the range of values we will accept as return results of
        // first handlers. This helps us maintain forward compatibility by
        // ensuring users don't rely on undocumented/unspecified behavior.
        assert.ok(
            handle === true ||
                handle === false ||
                handle === undefined ||
                handle === null,
            'Return value of first[' +
                i +
                '] must be: ' +
                'boolean, undefined, or null'
        );
        // If the first handler returns false, stop handling the request
        // immediately.
        if (handle === false) {
            self._inflightRequests--;
            return;
        }
    }

    this.emit('request', req, res);

    // Skip Socket.io endpoints
    if (this.socketio && /^\/socket\.io.*/.test(req.url)) {
        self._inflightRequests--;
        return;
    }

    // Decorate req and res objects
    self._setupRequest(req, res);

    // Run in domain to catch async errors
    // It has significant negative performance impact
    // Warning: this feature depends on the deprecated domains module
    if (self.handleUncaughtExceptions) {
        // In Node v12.x requiring the domain module has a negative performance
        // impact. As using domains in restify is optional and only required
        // with the `handleUncaughtExceptions` options, we apply a singleton
        // pattern to avoid any performance regression in the default scenario.
        if (!domain) {
            domain = require('domain');
        }

        var handlerDomain = domain.create();
        handlerDomain.add(req);
        handlerDomain.add(res);
        handlerDomain.on('error', function onError(err) {
            self._onHandlerError(err, req, res, true);
        });
        handlerDomain.run(function run() {
            self._runPre(req, res);
        });
    } else {
        self._runPre(req, res);
    }
};

/**
 * Run pre handlers
 *
 * @private
 * @memberof Server
 * @instance
 * @function _runPre
 * @param    {Object}    req - the request object
 * @param    {Object}    res - the response object
 * @returns  {undefined} no return value
 * @fires Request,Response#request
 */
Server.prototype._runPre = function _runPre(req, res) {
    var self = this;

    // emit 'pre' event before we run the pre handlers
    self.emit('pre', req, res);

    // Run "pre"
    req._currentHandler = 'pre';
    req._timePreStart = process.hrtime();

    self.preChain.run(req, res, function preChainDone(err) {
        // Execution time of a handler with error can be significantly lower
        req._timePreEnd = process.hrtime();
        self._afterPre(err, req, res);
    });
};

/**
 * After pre handlers finished
 *
 * @private
 * @memberof Server
 * @instance
 * @function _afterPre
 * @param  {Error|false|undefined} err - pre handler error
 * @param  {Request} req - request
 * @param  {Response} res - response
 * @returns {undefined} no return value
 */
Server.prototype._afterPre = function _afterPre(err, req, res) {
    var self = this;

    // Handle error
    if (err) {
        self._onHandlerError(err, req, res);
        self._finishReqResCycle(req, res, err);
        return;
    }

    // Stop
    if (err === false) {
        self._onHandlerStop(req, res);
        return;
    }

    self._runRoute(req, res);
};

/**
 * Find route and run handlers
 *
 * @private
 * @memberof Server
 * @instance
 * @function _runRoute
 * @param    {Object}    req - the request object
 * @param    {Object}    res - the response object
 * @returns  {undefined} no return value
 * @fires Request,Response#request
 */
Server.prototype._runRoute = function _runRoute(req, res) {
    var self = this;

    var routeHandler = self.router.lookup(req, res);

    if (!routeHandler) {
        self.router.defaultRoute(req, res, function afterRouter(err) {
            self._afterRoute(err, req, res);
        });
        return;
    }

    // Emit routed
    self.emit('routed', req, res, req.route);

    self._runUse(req, res, function afterUse() {
        // DTrace
        if (self.dtrace) {
            dtrace._rstfy_probes['route-start'].fire(function fire() {
                return [
                    self.name,
                    req.route.name,
                    req._dtraceId,
                    req.method,
                    req.href(),
                    req.headers
                ];
            });
        }

        req._timeRouteStart = process.hrtime();
        routeHandler(req, res, function afterRouter(err) {
            // Execution time of a handler with error can be significantly lower
            req._timeRouteEnd = process.hrtime();

            // DTrace
            if (self.dtrace) {
                dtrace._rstfy_probes['route-done'].fire(function fire() {
                    return [
                        self.name,
                        req.route.name,
                        req._dtraceId,
                        res.statusCode || 200,
                        res.headers
                    ];
                });
            }

            self._afterRoute(err, req, res);
        });
    });
};

/**
 * After use handlers finished
 *
 * @private
 * @memberof Server
 * @instance
 * @function _afterRoute
 * @param  {Error|false|undefined} err - use handler error
 * @param  {Request} req - request
 * @param  {Response} res - response
 * @returns {undefined} no return value
 */
Server.prototype._afterRoute = function _afterRoute(err, req, res) {
    var self = this;

    res._handlersFinished = true;

    // Handle error
    if (err) {
        self._onHandlerError(err, req, res);
        self._finishReqResCycle(req, res, err);
        return;
    }

    // Trigger finish
    self._finishReqResCycle(req, res, err);
};

/**
 * Run use handlers
 *
 * @private
 * @memberof Server
 * @instance
 * @function _runUse
 * @param    {Object}    req - the request object
 * @param    {Object}    res - the response object
 * @param    {Function}  next - next
 * @returns  {undefined} no return value
 * @fires Request,Response#request
 */
Server.prototype._runUse = function _runUse(req, res, next) {
    var self = this;

    // Run "use"
    req._currentHandler = 'use';
    req._timeUseStart = process.hrtime();

    self.useChain.run(req, res, function useChainDone(err) {
        // Execution time of a handler with error can be significantly lower
        req._timeUseEnd = process.hrtime();
        self._afterUse(err, req, res, next);
    });
};

/**
 * After use handlers finished
 *
 * @private
 * @memberof Server
 * @instance
 * @function _afterUse
 * @param  {Error|false|undefined} err - use handler error
 * @param  {Request} req - request
 * @param  {Response} res - response
 * @param  {Function}  next - next
 * @returns {undefined} no return value
 */
Server.prototype._afterUse = function _afterUse(err, req, res, next) {
    var self = this;

    // Handle error
    if (err) {
        self._onHandlerError(err, req, res);
        self._finishReqResCycle(req, res, err);
        return;
    }

    // Stop
    if (err === false) {
        self._onHandlerStop(req, res);
        return;
    }

    next();
};

/**
 * Runs after next(false) is called
 *
 * @private
 * @memberof Server
 * @instance
 * @function _onHandlerStop
 * @param  {Request} req - request
 * @param  {Response} res - response
 * @returns {undefined} no return value
 */
Server.prototype._onHandlerStop = function _onHandlerStop(req, res) {
    res._handlersFinished = true;
    this._finishReqResCycle(req, res);
};

/**
 * After route handlers finished
 * NOTE: only called when last handler calls next([err])
 *
 * @private
 * @memberof Server
 * @instance
 * @function _onHandlerError
 * @param  {Error|String|undefined} err - router handler error or route name
 * @param  {Request} req - request
 * @param  {Response} res - response
 * @param  {boolean} isUncaught - whether the error is uncaught
 * @returns {undefined} no return value
 */
Server.prototype._onHandlerError = function _onHandlerError(
    err,
    req,
    res,
    isUncaught
) {
    var self = this;

    // Call route by name
    if (!isUncaught && _.isString(err)) {
        var routeName = err;
        var routeHandler = self.router.lookupByName(routeName, req, res);

        // Cannot find route by name, called when next('route-name') doesn't
        // find any route, it's a 5xx error as it's a programatic error
        if (!routeHandler) {
            var routeByNameErr = new customErrorTypes.RouteMissingError(
                "Route by name doesn't exist"
            );
            routeByNameErr.code = 'ENOEXIST';
            self._afterRoute(routeByNameErr, req, res);
            return;
        }
        routeHandler(req, res, function afterRouter(routeErr) {
            self._afterRoute(routeErr, req, res);
        });
        return;
    }

    // Handlers don't continue when error happen
    res._handlersFinished = true;

    // Preserve handler err for finish event
    res.err = res.err || err;

    // Error happened in router handlers
    self._routeErrorResponse(req, res, err, isUncaught);
};

/**
 * Set up the request before routing and execution of handler chain functions.
 *
 * @private
 * @memberof Server
 * @instance
 * @function _setupRequest
 * @param    {Object}    req - the request object
 * @param    {Object}    res - the response object
 * @returns  {undefined} no return value
 */
Server.prototype._setupRequest = function _setupRequest(req, res) {
    var self = this;

    // Extend request
    req._dtraceId = dtrace.nextId();
    req.log = res.log = self.log;
    req._date = new Date();
    req._timeStart = process.hrtime();
    req.serverName = self.name;
    req.params = {};
    req.timers = [];
    req.dtrace = self.dtrace;

    // Extend response
    res.acceptable = self.acceptable;
    res.formatters = self.formatters;
    res.req = req;
    res.serverName = self.name;
    res._handlersFinished = false;
    res._flushed = false;
    res._strictFormatters = this.strictFormatters;

    // set header only if name isn't empty string
    if (self.name !== '') {
        res.setHeader('Server', self.name);
    }

    // Request lifecycle events

    // attach a listener for 'aborted' events, this will let us set
    // a flag so that we can stop processing the request if the client aborts
    // the connection (or we lose the connection).
    // we consider a closed request as flushed from metrics point of view
    function onReqAborted() {
        // Request was aborted, override the status code
        var err = new customErrorTypes.RequestCloseError();
        err.statusCode = 444;

        // For backward compatibility we only set connection state to "close"
        // for RequestCloseError, also aborted is always immediatly followed
        // by a "close" event.
        // We don't set _connectionState to "close" in the happy path
        req._connectionState = 'close';

        // Set status code and err for audit as req is already closed connection
        res.statusCode = err.statusCode;
        res.err = err;
    }

    // Response lifecycle events
    function onResFinish() {
        var processHrTime = process.hrtime();

        res._flushed = true;
        req._timeFlushed = processHrTime;

        // Response may get flushed before handler callback is triggered
        req._timeFlushed = processHrTime;
        req._timePreEnd = req._timePreEnd || processHrTime;
        req._timeUseEnd = req._timeUseEnd || processHrTime;
        req._timeRouteEnd = req._timeRouteEnd || processHrTime;

        // In Node < 10 "close" event dont fire always
        // https://github.com/nodejs/node/pull/20611
        self._finishReqResCycle(req, res);
    }

    // We are handling when connection is being closed prematurely outside of
    // restify. It's not because the req is aborted.
    function onResClose() {
        res._flushed = true;

        // Finish may already set the req._timeFlushed
        req._timeFlushed = req._timeFlushed || process.hrtime();

        self._finishReqResCycle(req, res, res.err);
    }

    // Request events
    req.once('aborted', onReqAborted);

    // Response events
    res.once('finish', onResFinish);
    res.once('close', onResClose);

    // attach a listener for the response's 'redirect' event
    res.on('redirect', function onRedirect(redirectLocation) {
        self.emit('redirect', redirectLocation);
    });
};

/**
 * Maintaining the end of the request-response cycle:
 *  - emitting after event
 *  - updating inflight requests metrics
 * Check if the response is finished, and if not, wait for it before firing the
 * response object.
 *
 * @private
 * @memberof Server
 * @instance
 * @function _finishReqResCycle
 * @param {Object} req - the request object
 * @param {Object} res - the response object
 * @param {Object} [err] - a possible error as a result of failed route matching
 * or failed execution of the handler array.
 * @returns {undefined} no return value
 */
Server.prototype._finishReqResCycle = function _finishReqResCycle(
    req,
    res,
    err
) {
    var self = this;
    var route = req.route; // can be undefined when 404 or error

    if (res._finished) {
        return;
    }

    if (res._flushed && res._handlersFinished) {
        // decrement number of requests
        self._inflightRequests--;
        res._finished = true;
        req._timeFinished = process.hrtime();

        // after event has signature of function(req, res, route, err) {...}
        var finalErr = err || res.err;
        req.emit('restifyDone', route, finalErr);
        self.emit('after', req, res, route, finalErr);
    } else {
        // Store error for when the response is flushed and we actually emit the
        // 'after' event. The "err" object passed to this method takes
        // precedence, but in case it's not set, "res.err" may have been already
        // set by another code path and we want to preserve it. The caveat thus
        // is that the 'after' event will be emitted with the latest error that
        // was set before the response is fully flushed. While not ideal, this
        // is on purpose and accepted as a reasonable trade-off for now.
        res.err = err || res.err;
    }
};

/**
 * Helper function to, when on router error, emit error events and then
 * flush the err.
 *
 * @private
 * @memberof Server
 * @instance
 * @function _routeErrorResponse
 * @param    {Request}     req -    the request object
 * @param    {Response}    res -    the response object
 * @param    {Error}       err -    error
 * @param    {boolean}     isUncaught - whether the error is uncaught
 * @returns  {undefined} no return value
 */
Server.prototype._routeErrorResponse = function _routeErrorResponse(
    req,
    res,
    err,
    isUncaught
) {
    var self = this;

    if (
        isUncaught &&
        self.handleUncaughtExceptions &&
        self.listenerCount('uncaughtException') > 1
    ) {
        self.emit(
            'uncaughtException',
            req,
            res,
            req.route,
            err,
            function uncaughtExceptionCompleted() {
                // We provide a callback to listeners of the 'uncaughtException'
                // event and we call _finishReqResCycle when that callback is
                // called so that, in case the actual request/response lifecycle
                // was completed _before_ the error was thrown or emitted, and
                // thus _before_ route handlers were marked as "finished", we
                // can still mark the req/res lifecycle as complete.
                // This edge case can occur when e.g. a client aborts a request
                // and the route handler that handles that request throws an
                // uncaught exception _after_ the request was aborted and the
                // response was closed.
                self._finishReqResCycle(req, res, err);
            }
        );
        return;
    }

    self._emitErrorEvents(req, res, null, err, function emitError() {
        // Prevent double handling
        if (res._sent) {
            return;
        }

        // only automatically send errors that are known (e.g., restify-errors)
        if (err instanceof Error && _.isNumber(err.statusCode)) {
            res.send(err);
            return;
        }

        // if the thrown exception is not really an Error object, e.g.,
        //    "throw 'foo';"
        // try to do best effort here to pass on that value by casting it to a
        // string. This should work even for falsy values like 0, false, null,
        // or undefined.
        res.send(new errors.InternalError(String(err)));
    });
};

/**
 * Emit error events when errors are encountered either while attempting to
 * route the request (via router) or while executing the handler chain.
 *
 * @private
 * @memberof Server
 * @instance
 * @function _emitErrorEvents
 * @param    {Object} req -    the request object
 * @param    {Object} res -    the response object
 * @param    {Object} route -  the current route, if applicable
 * @param    {Object} err -    an error object
 * @param    {Object} cb -     callback function
 * @returns  {undefined} no return value
 * @fires Error#restifyError
 */
Server.prototype._emitErrorEvents = function _emitErrorEvents(
    req,
    res,
    route,
    err,
    cb
) {
    var self = this;
    // Error can be of any type: undefined, Error, Number, etc. so we need
    // to protect ourselves from trying to resolve names from non Error objects
    var errName = err && err.name;
    var normalizedErrName = errName && errEvtNameFromError(err);

    req.log.trace(
        {
            err: err,
            errName: normalizedErrName
        },
        'entering emitErrorEvents',
        errName
    );

    var errEvtNames = [];

    // if we have listeners for the specific error, fire those first.
    // if there's no error name, we should not emit an event
    if (normalizedErrName && self.listeners(normalizedErrName).length > 0) {
        errEvtNames.push(normalizedErrName);
    }

    // or if we have a generic error listener. always fire generic error event
    // listener afterwards.
    if (self.listeners('restifyError').length > 0) {
        errEvtNames.push('restifyError');
    }

    // kick off the async listeners
    return vasync.forEachPipeline(
        {
            inputs: errEvtNames,
            func: function emitError(errEvtName, vasyncCb) {
                self.emit(errEvtName, req, res, err, function emitErrDone() {
                    // the error listener may return arbitrary objects, throw
                    // them away and continue on. don't want vasync to take
                    // that error and stop, we want to emit every single event.
                    return vasyncCb();
                });
            }
        },
        // eslint-disable-next-line handle-callback-err
        function onResult(__, results) {
            // vasync will never return error here since we throw them away.
            return cb();
        }
    );
};

///--- Helpers

/**
 * Verify and flatten a nested array of request handlers.
 *
 * @private
 * @function argumentsToChain
 * @throws   {TypeError}
 * @param    {Function[]} handlers - pass through of funcs from server.[method]
 * @returns  {Array} request handlers
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
            k = mime.getType(k);
        }

        obj[t] = src[k];
        arr.push({
            q: q,
            t: t
        });
    }

    Object.keys(formatters).forEach(addFormatter.bind(this, formatters));
    Object.keys(fmt || {}).forEach(addFormatter.bind(this, fmt || {}));

    arr = arr
        .sort(function sort(a, b) {
            return b.q - a.q;
        })
        .map(function map(a) {
            return a.t;
        });

    return {
        formatters: obj,
        acceptable: arr
    };
}

/**
 * Map an Error's .name property into the actual event name that is emitted
 * by the restify server object.
 *
 * @function
 * @private errEvtNameFromError
 * @param {Object} err - an error object
 * @returns {String} an event name to emit
 */
function errEvtNameFromError(err) {
    if (err.name === 'ResourceNotFoundError') {
        // remap the name for router errors
        return 'NotFound';
    } else if (err.name === 'InvalidVersionError') {
        // remap the name for router errors
        return 'VersionNotAllowed';
    } else if (err.name) {
        return err.name.replace(/Error$/, '');
    }
    // If the err is not an Error, then just return an empty string
    return '';
}

/**
 * Mounts a chain on the given path against this HTTP verb
 *
 * @private
 * @function serverMethodFactory
 * @param {String} method - name of the HTTP method
 * @returns {Function} factory
 */
function serverMethodFactory(method) {
    return function serverMethod(opts) {
        if (opts instanceof RegExp || typeof opts === 'string') {
            opts = {
                path: opts
            };
        } else if (typeof opts === 'object') {
            opts = shallowCopy(opts);
        } else {
            throw new TypeError('path (string) required');
        }

        if (arguments.length < 2) {
            throw new TypeError('handler (function) required');
        }

        opts.method = method;
        opts.path = opts.path || opts.url;

        // We accept both a variable number of handler functions, a
        // variable number of nested arrays of handler functions, or a mix
        // of both
        var handlers = Array.prototype.slice.call(arguments, 1);
        var chain = argumentsToChain(handlers);
        var route = this.router.mount(opts, chain);

        return route.name;
    };
}
