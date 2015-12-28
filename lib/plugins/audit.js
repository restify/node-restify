// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var assert = require('assert-plus');
var bunyan = require('bunyan');
var HttpError = require('restify-errors').HttpError;


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
 * optionally .server object to emit log. .logBuffer which is a
 * ringbuffer object to store certain amount of log,
 * printLog flag, default is true,
 * if printlog set to false, user need to pass in server object
 * listen to auditlog event to get log information
 * @returns {Function}         to be used in server.after.
 */
function auditLogger(options) {
    assert.object(options, 'options');
    assert.object(options.log, 'options.log');
    assert.optionalObject(options.server, 'options.server');
    assert.optionalObject(options.logBuffer, 'options.logBuffer');
    assert.optionalBool(options.printLog, 'options.printLog');
    //use server object to emit log data
    var server = options.server;
    //use logMetrics ringbuffer to store certain period of log records
    var logMetrics = options.logBuffer;
    //default always print log
    var printLog = options.printLog;

    if (typeof printLog === 'undefined') {
        printLog = true;
    }
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
                    timers: timers,
                    clientClosed: req.clientClosed
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
                    headers: res._headers,
                    trailer: res._trailer || false,
                    body: body
                });
            }
        }
    });

    function audit(req, res, route, err) {
        var latency = res.get('Response-Time');
        var timestamp = new Date().getTime();

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

        if (printLog) {
            log.info(obj, 'handled: %d', res.statusCode);
        }

        if (logMetrics && logMetrics instanceof bunyan.RingBuffer) {
            obj.timestamp = timestamp;
            logMetrics.write(obj);
        }

        if (server) {
            server.emit('auditlog', obj);
        }
        return (true);
    }

    return (audit);
}


///-- Exports

module.exports = auditLogger;
