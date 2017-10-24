// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

///--- Globals

'use strict';

var ID = 0;
var MAX_INT = Math.pow(2, 32) - 1;

var PROBES = {
    // server_name, route_name, id, method, url, headers (json)
    'route-start': ['char *', 'char *', 'int', 'char *', 'char *', 'json'],

    // server_name, route_name, handler_name, id
    'handler-start': ['char *', 'char *', 'char *', 'int'],

    // server_name, route_name, handler_name, id
    'handler-done': ['char *', 'char *', 'char *', 'int'],

    // server_name, route_name, id, statusCode, headers (json)
    'route-done': ['char *', 'char *', 'int', 'int', 'json'],

    // Client probes
    // method, url, headers, id
    'client-request': ['char *', 'char *', 'json', 'int'],

    // id, statusCode, headers
    'client-response': ['int', 'int', 'json'],

    // id, Error.toString()
    'client-error': ['id', 'char *']
};
var PROVIDER;

///--- API

// eslint-disable-next-line wrap-iife
module.exports = (function exportStaticProvider() {
    if (!PROVIDER) {
        try {
            var dtrace = require('dtrace-provider');
            PROVIDER = dtrace.createDTraceProvider('restify');
        } catch (e) {
            PROVIDER = {
                fire: function fire() {},
                enable: function enable() {},
                addProbe: function addProbe() {
                    var p = {
                        fire: function fire() {}
                    };
                    return p;
                },
                removeProbe: function removeProbe() {},
                disable: function disable() {}
            };
        }

        PROVIDER._rstfy_probes = {};

        Object.keys(PROBES).forEach(function forEach(p) {
            var args = PROBES[p].splice(0);
            args.unshift(p);

            var probe = PROVIDER.addProbe.apply(PROVIDER, args);
            PROVIDER._rstfy_probes[p] = probe;
        });

        PROVIDER.enable();

        PROVIDER.nextId = function nextId() {
            if (++ID >= MAX_INT) {
                ID = 1;
            }

            return ID;
        };
    }

    return PROVIDER;
})();
