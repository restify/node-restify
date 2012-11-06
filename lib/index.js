// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert-plus');

var clone = require('clone');


var bunyan = require('./bunyan_helper');
var clients = require('./clients');
var errors = require('./errors');
var httpDate = require('./http_date');
var plugins = require('./plugins');
var Router = require('./router');

var utils = require('./utils');


///--- Globals

var DTRACE;

var HttpClient = clients.HttpClient;
var JsonClient = clients.JsonClient;
var StringClient = clients.StringClient;



///--- Helpers

function createDTrace(name) {
        if (!DTRACE) {
                var d = require('dtrace-provider');
                var n = name.replace(/\W+/g, '-');
                DTRACE = d.createDTraceProvider(n);
        }

        return (DTRACE);
}


function createRouter(opts) {
        return (new Router(opts));
}


function onUncaughtException(req, res, route, e) {
        if (this.listeners('uncaughtException').length > 1)
                return (false);

        res.send(new errors.InternalError(e.message));
        return (true);
}



///--- Exported API

module.exports = {
        bunyan: bunyan,

        createServer: function createServer(options) {
                var Server = require('./server');

                var opts = clone(options || {});
                var server;

                opts.name = opts.name || 'restify';
                if (opts.dtrace) {
                        // We shouldn't call enable on the DTrace provider if
                        // the user passed it in.
                        opts.dtrace = options.dtrace;
                        opts._user_dtrace = true;
                } else {
                        opts.dtrace = createDTrace(opts.name);
                }

                // clone can't clone something with prototypes so we need to
                // manually set opts.log and opts.router to the right objects:
                opts.log =
                        opts.log ? options.log : bunyan.createLogger(opts.name);
                opts.router = opts.router ? options.router : createRouter(opts);

                server = new Server(opts);
                server.on('uncaughtException', onUncaughtException);

                return (server);
        },


        createClient: function createClient(options) {
                assert.object(options, 'options');

                var client;
                var opts = clone(options);
                opts.agent = options.agent;
                opts.name = opts.name || 'restify';
                opts.type = opts.type || 'application/octet-stream';
                if (opts.dtrace) {
                        opts.dtrace = options.dtrace;
                } else {
                        opts.dtrace = createDTrace(opts.name);
                }
                opts.log = options.log || bunyan.createLogger(opts.name);

                switch (opts.type) {
                case 'json':
                        client = new JsonClient(opts);
                        break;

                case 'string':
                        client = new StringClient(opts);
                        break;

                case 'http':
                default:
                        client = new HttpClient(opts);
                        break;
                }

                return (client);
        },


        createJsonClient: function createJsonClient(options) {
                assert.object(options, 'options');

                var opts = clone(options);
                opts.agent = options.agent;
                opts.log = options.log;
                opts.type = 'json';
                return (module.exports.createClient(opts));
        },


        createStringClient: function createStringClient(options) {
                assert.object(options, 'options');

                var opts = clone(options);
                opts.agent = options.agent;
                opts.log = options.log;
                opts.type = 'string';
                return (module.exports.createClient(opts));
        },


        HttpClient: HttpClient,
        JsonClient: JsonClient,
        StringClient: StringClient,

        plugins: {},
        httpDate: httpDate,

        /**
         * Returns a string representation of a URL pattern , with its
         * parameters filled in by the passed hash.
         *
         * If a key is not found in the hash for a param, it is left alone.
         *
         * @param {Object} a hash of parameter names to values for substitution.
         */
        realizeUrl: function realizeUrl(pattern, params) {
                var p = pattern.replace(/\/:([^/]+)/g, function (match, k) {
                        return (params.hasOwnProperty(k) ?
                                '/' + params[k] :
                                match);
                });
                return (utils.sanitizePath(p));
        }
};


Object.keys(errors).forEach(function (k) {
        module.exports[k] = errors[k];
});

Object.keys(plugins).forEach(function (k) {
        module.exports.plugins[k] = plugins[k];
        module.exports[k] = plugins[k];
});

// restify 1.0 backwards compatibility.  You probably don't want to use this.
module.exports.__defineSetter__('defaultResponseHeaders', function (f) {
        if (f === false || f === null || f === undefined) {
                f = function stub() {};
        } else if (f === true) {
                return;
        } else if (typeof (f) !== 'function') {
                var msg = 'defaultResponseHeaders must be a function';
                throw new TypeError(msg);
        }

        require('http').ServerResponse.prototype.defaultResponseHeaders = f;
});
