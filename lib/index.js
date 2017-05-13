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
 * creates a server.
 * @public
 * @function createServer
 * @param    {Object} options an options object
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
