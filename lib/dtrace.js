// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert-plus');
var dtrace = require('dtrace-provider');



///--- Globals

var DTraceProvider = dtrace.DTraceProvider;

var PROBES = {
        // server_name, route_name, fd, method, url, headers (json)
        'route-start': ['char *', 'char *', 'int', 'char *', 'char *',
                        'char *'],

        // server_name, route_name, handler_name, fd
        'handler-start': ['char *', 'char *', 'char *', 'int'],

        // server_name, route_name, handler_name, fd
        'handler-done': ['char *', 'char *', 'char *', 'int'],

        // server_name, route_name, fd, statusCode, headers (json)
        'route-done': ['char *', 'char *', 'int', 'int', 'char *']
};
var PROVIDER;



///--- API

module.exports = function exportStaticProvider() {
        if (!PROVIDER) {
                PROVIDER = dtrace.createDTraceProvider('restify');

                PROVIDER._rstfy_probes = {};

                Object.keys(PROBES).forEach(function (p) {
                        var args = PROBES[p].splice(0);
                        args.unshift(p);

                        var probe = PROVIDER.addProbe.apply(PROVIDER, args);
                        PROVIDER._rstfy_probes[p] = probe;
                });

                PROVIDER.enable();
        }

        return (PROVIDER);
}();
