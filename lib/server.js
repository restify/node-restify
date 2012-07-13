// Copyright 2012 Mark Cavage, Inc.  All rights reserved.


var EventEmitter = require('events').EventEmitter;
var http = require('http');
var https = require('https');
var url = require('url');
var util = require('util');

var assert = require('assert-plus');
var clone = require('clone');
var mime = require('mime');

var dtrace = require('./dtrace');
var errors = require('./errors');
var formatters = require('./formatters');

// Ensure these are loaded
require('./request');
require('./response');



///--- Globals

var sprintf = util.format;

var BadMethodError = errors.BadMethodError;
var InvalidVersionError = errors.InvalidVersionError;
var ResourceNotFoundError = errors.ResourceNotFoundError;

var PROXY_EVENTS = [
        'clientError',
        'close',
        'connection',
        'error',
        'listening',
        'secureConnection',
        'upgrade'
];



///--- Helpers

function argumentsToChain(args, start) {
        assert.ok(args);

        args = Array.prototype.slice.call(args, start);

        if (args.length < 0)
                throw new TypeError('handler (function) required');

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



///--- API

function Server(options) {
        assert.object(options, 'options');
        assert.object(options.dtrace, 'options.dtrace');
        assert.object(options.log, 'options.log');
        assert.object(options.router, 'options.router');

        var self = this;

        EventEmitter.call(this);

        this.acceptable = [];
        this.before = [];
        this.chain = [];
        this.dtp = options.dtrace;
        this.formatters = {};
        this.log = options.log;
        this.name = options.name || 'restify';
        this.router = options.router;
        this.routes = {};
        this.secure = false;
        this._user_dtrace = options._user_dtrace || false;
        this.version = options.version || null;

        if (options.formatters) {
                Object.keys(options.formatters).forEach(function (k) {
                        assert.func(options.formatters[k], 'formatter');

                        if (k.indexOf('/') === -1)
                                k = mime.lookup(k);

                        self.formatters[k] = options.formatters[k];
                        if (self.acceptable.indexOf(k) === -1)
                                self.acceptable.push(k);
                });
        }

        Object.keys(formatters).forEach(function (k) {
                if (!self.formatters[k]) {
                        self.formatters[k] = formatters[k];
                        if (self.acceptable.indexOf(k) === -1)
                                self.acceptable.push(k);
                }
        });

        if (options.certificate && options.key) {
                this.certificate = options.certificate;
                this.key = options.key;
                this.secure = true;

                this.server = https.createServer({
                        cert: options.certificate,
                        key: options.key
                });
        } else {
                this.server = http.createServer();
        }


        var log = this.log;

        PROXY_EVENTS.forEach(function (e) {
                self.server.on(e, self.emit.bind(self, e));
        });


        // Now the things we can't blindly proxy
        this.server.on('checkContinue', function onCheckContinue(req, res) {
                if (log.trace())
                        log.trace({event: 'checkContinue'}, 'event handled');

                if (self.listeners('checkContinue').length > 0)
                        return (self.emit('checkContinue', req, res));

                if (!options.noWriteContinue)
                        res.writeContinue();

                self._setupRequest(req, res);
                return (self._handle(req, res, true));
        });

        this.server.on('request', function onRequest(req, res) {
                if (log.trace())
                        log.trace({event: 'request'}, 'event handled');

                if (self.listeners('request').length > 0)
                        return (self.emit('request', req, res));

                self._setupRequest(req, res);
                return (self._handle(req, res));
        });

        this.__defineGetter__('maxHeadersCount', function () {
                return (self.server.maxHeadersCount);
        });

        this.__defineSetter__('maxHeadersCount', function (c) {
                self.server.maxHeadersCount = c;
                return (c);
        });


        this.__defineGetter__('url', function () {
                if (self.socketPath)
                        return ('http://' + self.socketPath);

                var addr = self.address();
                var str = self.secure ? 'https://' : 'http://';
                str += addr.address;
                str += ':';
                str += addr.port;
                return (str);
        });

}
util.inherits(Server, EventEmitter);
module.exports = Server;


Server.prototype.address = function address() {
        return (this.server.address());
};

/**
 * Gets the server up and listening.
 *
 * You can call like:
 *  server.listen(80)
 *  server.listen(80, '127.0.0.1')
 *  server.listen('/tmp/server.sock')
 *
 * And pass in a callback to any of those forms.  Also, by default, invoking
 * this method will trigger DTrace probes to be enabled; to not do that, pass
 * in 'false' as the second to last parameter.
 *
 * @param {Function} callback optionally get notified when listening.
 * @throws {TypeError} on bad input.
 */
Server.prototype.listen = function listen() {
        var args = Array.prototype.slice.call(arguments);
        var save = args.pop();
        var self = this;

        if (typeof (save) !== 'function' && typeof (save) !== 'undefined')
                args.push(save);

        args.push(function restifyListenCallback() {
                if (!self._user_dtrace)
                        self.dtp.enable();

                self._listening = true;
                if (typeof (save) === 'function')
                        save();
        });

        this.server.listen.apply(this.server, args);
};


/**
 * Shuts down this server, and invokes callback (optionally) when done.
 *
 * @param {Function} callback optional callback to invoke when done.
 */
Server.prototype.close = function close(callback) {
        if (callback)
                assert.func(callback, 'callback');

        if (!this._listening) {
                this.log.warn('server.close called; not listening');
                return (callback ? callback() : false);
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
 * @param {Object} options the URL to handle, at minimum.
 * @return {Route} the newly created route.
 */
['del', 'get', 'head', 'post', 'put', 'patch'].forEach(function (method) {

        Server.prototype[method] = function (opts) {
                if (opts instanceof RegExp || typeof (opts) === 'string') {
                        opts = {
                                path: opts
                        };
                } else if (typeof (opts) === 'object') {
                        opts = clone(opts);
                } else {
                        throw new TypeError('path (string) required');
                }

                if (arguments.length < 2)
                        throw new TypeError('handler (function) required');

                var chain = [];
                var i = 0;
                var probes;
                var route;
                var self = this;

                function addHandler(h) {
                        assert.func(h, 'handler');
                        var name = opts.name + '-' + (h.name || '' + (i + 1));
                        var _probes = dtrace.addProbes(self.dtp, name);

                        chain.push(h);
                        chain[i].fireStart = _probes.start;
                        chain[i].fireDone = _probes.done;
                        i += 1;
                }

                if (method === 'del')
                        method = 'DELETE';
                opts.method = method.toUpperCase();
                if (!opts.name)
                        opts.name = method + '-' + (opts.path || opts.url);
                opts.name = opts.name.replace(/\W/g, '').toLowerCase();
                opts.version = opts.version || self.version;

                if (!(route = this.router.mount(opts)))
                        return (false);

                probes = dtrace.addProbes(this.dtp, opts.name);
                chain.fireStart = probes.start;
                chain.fireDone = probes.done;

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
 * @param {String} The name of the URL param to respond to
 * @param {Function} The middleware function to execute
 */
Server.prototype.param = function param(name, fn) {
        this.use(function _param(req, res, next) {
                if (req.params && req.params[name])
                        return (fn.apply(this, arguments));

                return (next());
        });

        return (this);
};


/**
 * Removes a route from the server.
 *
 * You  pass in the route 'blob' you got from a mount call.
 *
 * @param {String} name the route name.
 * @return {Boolean} true if route was removed, false if not.
 * @throws {TypeError} on bad input.
 */
Server.prototype.rm = function rm(route) {
        var r = this.router.unmount(route);
        if (r && this.routes[r])
                delete this.routes[r];

        return (r);
};


/**
 * Installs a list of handlers to run _before_ the "normal" handlers of all
 * routes.
 *
 * You can pass in any combination of functions or array of functions.
 *
 * @throws {TypeError} on input error.
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
 */
Server.prototype.pre = function pre() {
        var self = this;

        argumentsToChain(arguments).forEach(function (h) {
                self.before.push(h);
        });

        return (this);
};


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
        str += sprintf(LINE_FMT, 'Routes:', '');
        Object.keys(this.routes).forEach(function (k) {
                var handlers = handlersToString(self.routes[k]);
                str += sprintf(SUB_LINE_FMT, k, handlers);
        });
        str += sprintf(LINE_FMT, 'Secure', this.secure);
        str += sprintf(LINE_FMT, 'Url', this.url);
        str += sprintf(LINE_FMT, 'Version', this.version);

        return (str);
};



///--- Private methods

Server.prototype._handle = function _handle(req, res) {
        var log = this.log;
        var self = this;

        function _route() {
                if (log.trace()) {
                        log.trace({
                                req: req,
                                req_id: req.getId()
                        }, 'checking for route');
                }

                self.router.find(req, res, function (err, r, ctx) {
                        if (err) {
                                if (err.statusCode === 405 &&
                                    req.method === 'OPTIONS') {
                                        res.send(200);
                                } else {
                                        log.trace({
                                                err: err,
                                                req: req
                                        }, 'router errored out');
                                        res.send(err);
                                }
                                self.emit('after', req, res, null);
                        } else if (!r || !self.routes[r]) {
                                log.trace({req: res}, 'no route found');
                                res.send(404);
                                self.emit('after', req, res, null);
                        } else {
                                if (log.trace()) {
                                        log.trace({
                                                req_id: req.getId(),
                                                route: r
                                        }, 'route found');
                                }

                                req.context = ctx;
                                var chain = self.routes[r];
                                self._run(req, res, r, chain, function () {
                                        self.emit('after', req, res, r);
                                });
                        }
                });
        }

        // We need to check if should run the _pre_ chain first.
        if (this.before.length > 0) {
                if (log.trace())
                        log.trace({req: req}, 'running pre chain');

                this._run(req, res, null, this.before, function (err) {
                        if (err) {
                                log.trace({
                                        err: err
                                }, 'pre chain errored out. Done.');
                                return (false);
                        }

                        return (_route());
                });
                return (false);
        }

        return (_route());
};


Server.prototype._run = function _run(req, res, route, chain, callback) {
        var i = -1;
        var log = this.log;
        var self = this;

        function next(err) {
                // The goofy checks here are to make sure we fire the DTrace
                // probes after an error might have been sent, as in a handler
                // return next(new Error) is basically shorthand for sending an
                // error via res.send(), so we do that before firing the dtrace
                // probe (namely so the status codes get updated in the
                // response).
                var done = false;
                if (err) {
                        if (log.debug())
                                log.debug({err: err}, 'next(err=%s)',
                                          err.name || 'Error');
                        res.send(err);
                        done = true;
                }

                // Callers can stop the chain from proceding if they do
                // return next(false); This is useful for non-errors, but where
                // a response was sent and you don't want the chain to keep
                // going
                if (err === false)
                        done = true;

                // Fire DTrace done for the previous handler.
                if ((i + 1) > 0 && chain[i] && chain[i].fireDone)
                        chain[i].fireDone(req, res);

                // Run the next handler up
                if (!done && chain[++i]) {
                        if (log.trace())
                                log.trace('running %s', chain[i].name || '?');

                        if (chain[i].fireStart)
                                chain[i].fireStart(req);

                        try {
                                return (chain[i].call(self, req, res, next));
                        } catch (e) {
                                log.debug({err: e}, 'uncaughtException');
                                self.emit('uncaughtException',
                                          req,
                                          res,
                                          route,
                                          e);
                                return (callback ? callback(e) : false);
                        }
                }

                // This is the route -done dtrace probe
                if (chain.fireDone)
                        chain.fireDone(req, res);

                if (route === null) {
                        self.emit('preDone', req, res);
                } else {
                        self.emit('done', req, res, route);
                }

                return (callback ? callback(err) : true);
        }

        // DTrace start for the route
        if (chain.fireStart)
                chain.fireStart(req);

        return (next());
};


Server.prototype._setupRequest = function _setupRequest(req, res) {
        req.log = res.log = this.log;
        req._time = res._time = Date.now();

        res.acceptable = this.acceptable;
        res.formatters = this.formatters;
        res.req = req;
        res.serverName = this.name;
};
