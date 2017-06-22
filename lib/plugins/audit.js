// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var assert = require('assert-plus');
var bunyan = require('bunyan');

var HttpError = require('../errors').HttpError;

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
 * Returns a Bunyan audit logger suitable to be used in a server.on('after')
 * event.  I.e.:
 *
 * server.on('after', restify.auditLogger({ log: myAuditStream }));
 *
 * This logs at the INFO level.
 *
 * @public
 * @function auditLogger
 * @param   {Object}   options at least a bunyan logger (log).
 * @returns {Function}         to be used in server.after.
 */
function auditLogger(options) {
    assert.object(options, 'options');
    assert.object(options.log, 'options.log');
    var errSerializer = bunyan.stdSerializers.err;

    if (options.log.serializers && options.log.serializers.err) {
        errSerializer = options.log.serializers.err;
    }

    var log = options.log.child({
        audit: true,
        serializers: {
            err: errSerializer,
            req: function auditRequestSerializer(req) {
                if (!req) {
                    return (false);
                }

                var timers = {};
                (req.timers || []).forEach(function (time) {
                    var t = time.time;
                    var _t = Math.floor((1000000 * t[0]) +
                        (t[1] / 1000));
                    timers[time.name] = _t;
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
                    body: options.body === true ?
                        req.body : undefined,
                    timers: timers
                });
            },
            res: function auditResponseSerializer(res) {
                if (!res) {
                    return (false);
                }


                var body;

                if (options.body === true) {
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
            _audit: true
        };

        log.info(obj, 'handled: %d', res.statusCode);

        return (true);
    }

    return (audit);
}


///-- Exports

module.exports = auditLogger;
