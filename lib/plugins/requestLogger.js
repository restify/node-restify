// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var assert = require('assert-plus');

var shallowCopy = require('./utils/shallowCopy');

///--- API

/**
 * Sets up a child [logger](https://github.com/pinojs/pino) logger with
 * the current request id filled in, along with any other parameters you define.
 *
 * You can pass in no options to this, in which case only the request id will be
 * appended, and no serializers appended (this is also the most performant); the
 * logger created at server creation time will be used as the parent logger.
 * This logger can be used normally, with [req.log](#request-api).
 *
 * This plugin does _not_ log each individual request. Use the Audit Logging
 * plugin or a custom middleware for that use.
 *
 * @public
 * @function requestLogger
 * @param    {Object}   [options] - an options object
 * @param    {Array}    [options.headers] - A list of headers to transfer from
 *                                  the request to top level props on the log.
 * @param    {Object}   [options.properties] - A set of key-values to pass to the child logger
 * @param    {Object}   [options.serializers] - Override serializers to use in the child logger
 * @param    {Object}   [options.log] - A logger to use as a fallback if req.log is missing
 * @param    {String}   [options.requestIdFieldName] - The name of the request id property attached
 *                                   to log lines. Defaults to "req_id".
 * @returns  {Function} Handler
 * @example
 * server.use(restify.plugins.requestLogger({
 *     properties: {
 *         foo: 'bar'
 *     },
 *     serializers: {...}
 * }));
 */
function requestLogger(options) {
    assert.optionalObject(options);
    var opts = options || {};

    var props;

    if (opts.properties) {
        props = shallowCopy(opts.properties);
    } else {
        props = {};
    }

    if (opts.serializers) {
        props.serializers = opts.serializers;
    }

    var headersToCopy = opts.headers || [];
    const requestIdFieldName = opts.requestIdFieldName || 'req_id';

    return function logger(req, res, next) {
        if (!req.log && !opts.log) {
            next();
            return;
        }

        var log = req.log || opts.log;

        props[requestIdFieldName] = req.getId();

        headersToCopy.forEach(function forEach(k) {
            if (req.headers[k]) {
                props[k] = req.headers[k];
            }
        });
        const childOptions = {};
        if (props.serializers) {
            childOptions.serializers = props.serializers;
        }
        req.log = log.child(props, childOptions);

        if (props[requestIdFieldName]) {
            delete props[requestIdFieldName];
        }

        next();
    };
}

///--- Exports

module.exports = requestLogger;
