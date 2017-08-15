// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var assert = require('assert-plus');
var bunyan = require('bunyan');
var HttpError = require('restify-errors').HttpError;
var VError = require('verror');

/**
 * Utility to get response headers from a given response.
 * Manually generates a POJO from `res.getHeaderNames` and `res.getHeader`,
 * if available, falling back to deprecated `res._headers`, otherwise.
 * Intentionally does not use `res.getHeaders` to avoid deserialization
 * issues with object returned by that method.
 * @param {http.ServerResponse} res the OutgoingMessage
 * @private
 * @function getResponseHeaders
 * @returns {object} map from header name to header value
 * @see https://github.com/restify/node-restify/issues/1370
 */
function getResponseHeaders(res) {
    if (res.getHeaderNames && res.getHeader) {
        return res.getHeaderNames().reduce(function (prev, curr) {
            var header = {};
            header[curr] = res.getHeader(curr);
            return Object.assign({}, prev, header);
        }, {});
    }
    return res._headers;
}

///--- API


/**
 * @param {object} opts The options object.
 * @param {object} opts.log The logger.
 * @param {string} opts.event The event from the server which initiates the
 * log, one of 'pre', 'routed', or 'after'
 * @param {object} [opts.server] The restify server, used to emit the audit log
 * object programttically
 * @param {boolean} [opts.printLog] Whether to print the log via the logger.
 *
 * @public
 * @function auditLogger
 * @returns {Function}
 * @emits audit when an audit log has been generated
 */
function auditLogger(opts) {
    assert.object(opts, 'opts');
    assert.object(opts.log, 'opts.log');
    assert.string(opts.event, 'opts.event');
    assert.optionalObject(opts.server, 'opts.server');
    assert.optionalBool(opts.printLog, 'opts.printLog');

    if (opts.event !== 'after' && opts.event !== 'pre' &&
        opts.event !== 'routed') {
        throw new VError('opts.event must be %s, %s, or %s, but is %s', 'pre',
            'routed', 'after', opts.event);
    }

    var server = opts.server;
    var printLog = opts.printLog;

    if (typeof printLog === 'undefined') {
        printLog = true;
    }
    var errSerializer = bunyan.stdSerializers.err;

    if (opts.log.serializers && opts.log.serializers.err) {
        errSerializer = opts.log.serializers.err;
    }

    var log = opts.log.child({
        audit: true,
        component: opts.event,
        serializers: {
            err: errSerializer,
            req: function auditRequestSerializer(req) {
                if (!req) {
                    return (false);
                }

                var timers = {};
                (req.timers || []).forEach(function (time) {
                    var t = time.time;
                    var _t = Math.floor((1000000 * t[0]) + (t[1] / 1000));
                    timers[time.name] = (timers[time.name] || 0) + _t;
                });
                return ({
                    // account for native and queryParser plugin usage
                    query: (typeof req.query === 'function') ?
                            req.query() : req.query,
                    method: req.method,
                    url: req.url,
                    headers: req.headers,
                    httpVersion: req.httpVersion,
                    trailers: req.trailers,
                    version: req.version(),
                    body: opts.body === true ? req.body : undefined,
                    timers: timers,
                    connectionState: (req.connectionState &&
                                     req.connectionState())
                });
            },
            res: function auditResponseSerializer(res) {
                if (!res) {
                    return (false);
                }

                var body;

                if (opts.body === true) {
                    if (res._body instanceof HttpError) {
                        body = res._body.body;
                    } else {
                        body = res._body;
                    }
                }

                return ({
                    statusCode: res.statusCode,
                    headers: getResponseHeaders(res),
                    trailer: res._trailer || false,
                    body: body
                });
            }
        }
    });

    function audit(req, res, route, err) {
        var latency = res.get('Response-Time');

        if (typeof (latency) !== 'number') {
            latency = Date.now() - req._time;
        }

        var obj = {
            remoteAddress: req.connection.remoteAddress,
            remotePort: req.connection.remotePort,
            req_id: req.getId(),
            req: req,
            res: res,
            err: err,
            latency: latency,
            secure: req.secure,
            _audit: true,
            event: opts.event
        };

        if (printLog) {
            switch (opts.event) {
                case 'after':
                    log.info(obj, 'handled: %d', res.statusCode);
                    break;
                case 'pre':
                    log.info(obj, 'pre');
                    break;
                case 'routed':
                    log.info(obj, 'routed');
                    break;
                default:
                    throw new Error('Unexpected audit event: ' + opts.event);
            }
        }

        if (server) {
            server.emit('audit', obj);
        }

        return (true);
    }

    return (audit);
}


///-- Exports


module.exports = auditLogger;
