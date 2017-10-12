// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var assert = require('assert-plus');
var errors = require('restify-errors');

var bunyan = require('./bunyan_helper');
var Router = require('./router');
var Server = require('./server');
var shallowCopy = require('./utils').shallowCopy;

var InternalError = errors.InternalError;
require('./errorTypes');

/**
 * A restify server object is the main interface through which you will register
 * routes and handlers for incoming requests.
 *
 * @public
 * @function createServer
 * @param {Object} options  - an options object
 * @param {String} [options.name="restify"] - Name of the server.
 * @param {Router} [options.router=new Router(opts)] - Router
 * @param {Object} [options.log=bunyan.createLogger(options.name || "restify")]
 * - [bunyan](https://github.com/trentm/node-bunyan) instance.
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
 * @returns  {Server}
 */
function createServer(options) {

    assert.optionalObject(options, 'options');

    var opts = shallowCopy(options || {});
    var server;

    // empty string should override default value.
    opts.name = (opts.hasOwnProperty('name')) ? opts.name : 'restify';
    opts.log = opts.log || bunyan.createLogger(opts.name || 'restify');
    opts.router = opts.router || new Router(opts);

    server = new Server(opts);

    if (opts.handleUncaughtExceptions) {
        server.on('uncaughtException', function (req, res, route, e) {
            if (this.listeners('uncaughtException').length > 1 ||
                res.headersSent) {
                return (false);
            }

            res.send(new InternalError(e, e.message || 'unexpected error'));
            return (true);
        });
    }

    return (server);
}


///--- Exports

module.exports.bunyan = bunyan;
module.exports.createServer = createServer;
module.exports.formatters = require('./formatters');
module.exports.plugins = require('./plugins');
module.exports.pre = require('./plugins').pre;
