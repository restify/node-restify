// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert-plus');

var bunyan = require('bunyan');
var clone = require('clone');


var clients = require('./clients');
var errors = require('./errors');
var httpDate = require('./http_date');
var plugins = require('./plugins');
var Router = require('./router');



///--- Globals

var DTRACE;

var HttpClient = clients.HttpClient;
var JsonClient = clients.JsonClient;
var StringClient = clients.StringClient;
var PoolingClient = clients.PoolingClient;


///--- Helpers

function bunyanResponseSerializer(res) {
        if (!res)
                return ('');

        return (res.toString());
}


function bunyanClientRequestSerializer(req) {
        var host;

        try {
                host = req.host.split(':')[0];
        } catch (e) {
                host = false;
        }

        return ({
                method: req ? req.method : false,
                url: req ? req.path : false,
                address: host,
                port: req ? req.port : false,
                headers: req ? req.headers : false
        });
}


function createDTrace(name) {
        // see https://github.com/mcavage/node-restify/issues/80 and
        // https://github.com/mcavage/node-restify/issues/100
        if (!DTRACE) {
                try {
                        var d = require('dtrace-provider');
                        name = name.replace(/\W+/g, '-');
                        DTRACE = d.createDTraceProvider(name);
                } catch (e) {
                        DTRACE = {
                                addProbe: function addProbe() {},
                                enable: function enable() {},
                                fire: function fire() {}
                        };
                }
        }

        return (DTRACE);
}


function createLogger(name) {
        return (bunyan.createLogger({
                level: 'warn',
                name: name,
                serializers: module.exports.bunyan.serializers,
                stream: process.stderr
        }));
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

        bunyan: {
                serializers: {
                        err: bunyan.stdSerializers.err,
                        req: bunyan.stdSerializers.req,
                        res: bunyan.stdSerializers.res,
                        client_req: bunyanClientRequestSerializer
                }
        },

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
                opts.log = opts.log ? options.log : createLogger(opts.name);
                opts.router = opts.router ? options.router : createRouter(opts);

                server = new Server(opts);
                server.on('uncaughtException', onUncaughtException);

                return (server);
        },


        createClient: function createClient(options) {
                assert.object(options, 'options');

                var client;
                var opts = clone(options);
                opts.name = opts.name || 'restify';
                opts.type = opts.type || 'application/octet-stream';
                opts.dtrace = options.dtrace || createDTrace(opts.name);
                opts.log = options.log || createLogger(opts.name);

                if (options.pooling) {
                        client = new PoolingClient(opts);
                        return (client);
                }

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
                opts.type = 'json';
                return (module.exports.createClient(opts));
        },


        createStringClient: function createStringClient(options) {
                assert.object(options, 'options');

                var opts = clone(options);
                opts.type = 'string';
                return (module.exports.createClient(opts));
        },


        HttpClient: HttpClient,
        JsonClient: JsonClient,
        StringClient: StringClient,
        PoolingClient: PoolingClient,

        plugins: {},
        httpDate: httpDate
};

Object.keys(errors).forEach(function (k) {
        module.exports[k] = errors[k];
});

Object.keys(plugins).forEach(function (k) {
        module.exports.plugins[k] = plugins[k];
        module.exports[k] = plugins[k];
});
