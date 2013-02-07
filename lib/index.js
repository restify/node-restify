// Copyright 2012 Mark Cavage, Inc.  All rights reserved.
//
// Restify supports both a client and server API, and in the essence of not
// loading the kitchen sink on clients, the exports here is chunked up into
// client and server; note clients will have to opt in by setting the env
// var "RESTIFY_CLIENT_ONLY", but if you're in that boat, it's not hard to do,
// and enables much faster load times
//

var shallowCopy = require('./utils').shallowCopy;


function createClient(options) {
        var assert = require('assert-plus');
        var bunyan = require('./bunyan_helper');
        var clients = require('./clients');

        assert.object(options, 'options');

        var client;
        var opts = shallowCopy(options);
        opts.agent = options.agent;
        opts.name = opts.name || 'restify';
        opts.type = opts.type || 'application/octet-stream';
        opts.log = opts.log || bunyan.createLogger(opts.name);

        switch (opts.type) {
        case 'json':
                client = new clients.JsonClient(opts);
                break;

        case 'string':
                client = new clients.StringClient(opts);
                break;

        case 'http':
        default:
                client = new clients.HttpClient(opts);
                break;
        }

        return (client);
}


function createJsonClient(options) {
        options = options ? shallowCopy(options) : {};
        options.type = 'json';
        return (createClient(options));
}


function createStringClient(options) {
        options = options ? shallowCopy(options) : {};
        options.type = 'string';
        return (createClient(options));
}


function createHttpClient(options) {
        options = options ? shallowCopy(options) : {};
        options.type = 'http';
        return (createClient(options));
}


function createServer(options) {
        var bunyan = require('./bunyan_helper');
        var InternalError = require('./errors').InternalError;
        var Router = require('./router');
        var Server = require('./server');

        var opts = shallowCopy(options || {});
        var server;

        opts.name = opts.name || 'restify';
        opts.log = opts.log || bunyan.createLogger(opts.name);
        opts.router = opts.router || new Router(opts);

        server = new Server(opts);
        server.on('uncaughtException', function (req, res, route, e) {
                if (this.listeners('uncaughtException').length > 1 ||
                    res._headerSent) {
                        return (false);
                }

                res.send(new InternalError(e, e.message || 'unexpected error'));
                return (true);
        });

        return (server);
}


/**
 * Returns a string representation of a URL pattern , with its
 * parameters filled in by the passed hash.
 *
 * If a key is not found in the hash for a param, it is left alone.
 *
 * @param {Object} a hash of parameter names to values for substitution.
 */
function realizeUrl(pattern, params) {
        var p = pattern.replace(/\/:([^/]+)/g, function (match, k) {
                return (params.hasOwnProperty(k) ? '/' + params[k] : match);
        });


        return (require('./utils').sanitizePath(p));
}



///--- Exports

module.exports = {
        // Client API
        createClient: createClient,
        createJsonClient: createJsonClient,
        createJSONClient: createJsonClient,
        createStringClient: createStringClient,
        createHttpClient: createHttpClient,
        get HttpClient() {
                return (require('./clients').HttpClient);
        },
        get JsonClient() {
                return (require('./clients').JsonClient);
        },
        get StringClient() {
                return (require('./clients').StringClient);
        },

        // Miscellaneous API
        get bunyan() {
                return (require('./bunyan_helper'));
        },

        errors: {}

};

var errors = require('./errors');
Object.keys(errors).forEach(function (k) {
        module.exports.errors[k] = errors[k];
        module.exports[k] = errors[k];
});

if (!process.env.RESTIFY_CLIENT_ONLY) {

        module.exports.createServer = createServer;
        module.exports.httpDate = require('./http_date');
        module.exports.realizeUrl = realizeUrl;
        module.exports.formatters = require('./formatters');
        module.exports.plugins = {};
        var plugins = require('./plugins');
        Object.keys(plugins).forEach(function (k) {
                module.exports.plugins[k] = plugins[k];
                module.exports[k] = plugins[k];
        });
}
