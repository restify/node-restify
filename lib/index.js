// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');

var bunyan = require('bunyan');
var clone = require('clone');


var args = require('./args');
var clients = require('./clients');
var errors = require('./errors');
var plugins = require('./plugins');
var Router = require('./router');



///--- Globals

var DTRACE;
var LOG;

var assertObject = args.assertObject;
var HttpClient = clients.HttpClient;
var JsonClient = clients.JsonClient;
var StringClient = clients.StringClient;



///--- Helpers

function bunyanResponseSerializer(res) {
        var serialized = {
                statusCode: res ? res.statusCode : false,
                headers: res ? res.getHeaders() : false
        };
        return (serialized);
}


function bunyanClientRequestSerializer(req) {
        var host;

        try {
                host = req.host.split(':')[0];
        } catch (e) {
                host = false;
        }

        var serialized = {
                method: req ? req.method : false,
                url: req ? req.path : false,
                address: host,
                port: req ? req.port : false,
                headers: req ? req.headers : false
        };

        return (serialized);
}


function defaultLogger(name) {
        if (!LOG) {
                LOG = bunyan.createLogger({
                        level: 'warn',
                        name: name,
                        serializers: module.exports.bunyan.serializers,
                        stream: process.stderr
                });
        }

        return (LOG);
}


function defaultDTrace(name) {
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


function defaultRouter(opts) {
        return (new Router(opts));
}



///--- Exported API

module.exports = {

        bunyan: {
                serializers: {
                        err: bunyan.stdSerializers.err,
                        req: bunyan.stdSerializers.req,
                        res: bunyanResponseSerializer,
                        client_req: bunyanClientRequestSerializer
                }
        },

        createServer: function createServer(options) {
                options = options || {};
                var opts = {};
                opts.name = options.name || 'restify';
                opts.log = options.log || defaultLogger(opts.name);
                opts.dtrace = options.dtrace || defaultDTrace(opts.name);
                opts.router = options.router || defaultRouter(opts);

                var Server = require('./server');

                return (new Server(opts));
        },


        createClient: function createClient(options) {
                assertObject('options', options);

                var client;
                var opts = clone(options);
                opts.name = opts.name || 'restify';
                opts.type = opts.type || 'application/octet-stream';
                opts.dtrace = opts.dtrace || defaultDTrace(opts.name);
                opts.log = opts.log || defaultLogger(opts.name);

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
                assertObject('options', options);

                var opts = clone(options);
                opts.type = 'json';
                return (module.exports.createClient(opts));
        },


        createStringClient: function createStringClient(options) {
                assertObject('options', options);

                var opts = clone(options);
                opts.type = 'string';
                return (module.exports.createClient(opts));
        },


        HttpClient: HttpClient,
        JsonClient: JsonClient,
        StringClient: StringClient,

        plugins: {}
};

Object.keys(errors).forEach(function (k) {
        module.exports[k] = errors[k];
});

Object.keys(plugins).forEach(function (k) {
        module.exports.plugins[k] = plugins[k];
});

module.exports.__defineSetter__('defaultResponseHeaders', function (f) {
        if (f === false || f === null || f === undefined) {
                f = function () {};
        } else if (f === true) {
                return;
        } else if (typeof (f) !== 'function') {
                throw new TypeError('defaultResponseHeaders must be a function');
        }

        require('http').ServerResponse.prototype.defaultHeaders = f;
});
