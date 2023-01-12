// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var assert = require('assert-plus');
var pino = require('pino');
var HttpError = require('restify-errors').HttpError;
var errors = require('restify-errors');
var hrTimeDurationInMs = require('./utils/hrTimeDurationInMs');

/**
 * Utility to get response headers from a given response.
 * Manually generates a POJO from `res.getHeaderNames` and `res.getHeader`,
 * if available, falling back to deprecated `res._headers`, otherwise.
 * Intentionally does not use `res.getHeaders` to avoid deserialization
 * issues with object returned by that method.
 *
 * @param {http.ServerResponse} res - the OutgoingMessage
 * @private
 * @function getResponseHeaders
 * @returns {object} map from header name to header value
 * @see https://github.com/restify/node-restify/issues/1370
 */
function getResponseHeaders(res) {
    if (res.getHeaderNames && res.getHeader) {
        return res.getHeaderNames().reduce(function reduce(prev, curr) {
            var header = {};
            header[curr] = res.getHeader(curr);
            return Object.assign({}, prev, header);
        }, {});
    }
    return res._headers;
}

///--- API

/**
 * @public
 * @function auditLogger
 * @param {Object} opts - The options object.
 * @param {Object} opts.log - The logger.
 * @param {String} opts.event - The event from the server which initiates the
 * log, one of 'pre', 'routed', or 'after'
 * @param {Function} [opts.context] - The optional context function of signature
 * f(req, res, route, err).  Invoked each time an audit log is generated. This
 * function can return an object that customizes the format of anything off the
 * req, res, route, and err objects. The output of this function will be
 * available on the `context` key in the audit object.
 * @param {Object} [opts.server] - The restify server, used to emit
 * the audit log object programmatically
 * @param {boolean} [opts.printLog=true] - Whether to print the log
 * via the logger.
 * @param {Object} [opts.serializers] - Override the default logger serializers
 * for err, req and res
 * @returns {Function} Handler
 * @fires audit when an audit log has been generated
 * @example
 * <caption>
 * Audit logging is a special plugin, as you don't use it with `.use()`
 * but with the `after` event:
 * </caption>
 *
 * server.on('after', restify.plugins.auditLogger({
 *   log: pino(
 *     {name: 'audit'},
 *     process.stdout
 *   ),
 *   event: 'after',
 *   server: SERVER,
 *   logMetrics : logBuffer,
 *   printLog : true
 * }));
 *
 * @example
 * <caption>
 * You pass in the auditor a pino logger, optionally server object,
 * Ringbuffer and a flag printLog indicate if log needs to be print out at info
 * level or not.  By default, without specify printLog flag, it will write out
 * record lookling like this:
 * </caption>
 *
 * {
 *   "name": "audit",
 *   "hostname": "your.host.name",
 *   "audit": true,
 *   "remoteAddress": "127.0.0.1",
 *   "remotePort": 57692,
 *   "req_id": "ed634c3e-1af0-40e4-ad1e-68c2fb67c8e1",
 *   "req": {
 *     "method": "GET",
 *     "url": "/foo",
 *     "headers": {
 *       "authorization": "Basic YWRtaW46am95cGFzczEyMw==",
 *       "user-agent": "curl/7.19.7 (universal-apple-darwin10.0)
 *          libcurl/7.19.7 OpenSSL/0.9.8r zlib/1.2.3",
 *       "host": "localhost:8080",
 *       "accept": "application/json"
 *     },
 *     "httpVersion": "1.1",
 *     "query": {
 *         "foo": "bar"
 *     },
 *     "trailers": {},
 *     "version": "*",
 *     "timers": {
 *       "requestLogger": 52,
 *       "saveAction": 8,
 *       "reqResTracker": 213,
 *       "addContext": 8,
 *       "addModels": 4,
 *       "resNamespaces": 5,
 *       "parseQueryString": 11,
 *       "instanceHeaders": 20,
 *       "xForwardedProto": 7,
 *       "httpsRedirector": 14,
 *       "readBody": 21,
 *       "parseBody": 6,
 *       "xframe": 7,
 *       "restifyCookieParser": 15,
 *       "fooHandler": 23,
 *       "barHandler": 14,
 *       "carHandler": 14
 *     }
 *   },
 *   "res": {
 *     "statusCode": 200,
 *     "headers": {
 *       "access-control-allow-origin": "*",
 *       "access-control-allow-headers": "Accept, Accept-Version,
 *          Content-Length, Content-MD5, Content-Type, Date, Api-Version",
 *       "access-control-expose-headers": "Api-Version, Request-Id,
 *          Response-Time",
 *       "server": "Joyent SmartDataCenter 7.0.0",
 *       "x-request-id": "ed634c3e-1af0-40e4-ad1e-68c2fb67c8e1",
 *       "access-control-allow-methods": "GET",
 *       "x-api-version": "1.0.0",
 *       "connection": "close",
 *       "content-length": 158,
 *       "content-md5": "zkiRn2/k3saflPhxXI7aXA==",
 *       "content-type": "application/json",
 *       "date": "Tue, 07 Feb 2012 20:30:31 GMT",
 *       "x-response-time": 1639
 *     },
 *     "trailer": false
 *   },
 *   "route": {
 *   "name": "GetFoo",
 *   "version": ["1.0.0"]
 *   },
 *   "secure": false,
 *   "level": 30,
 *   "msg": "GetFoo handled: 200",
 *   "time": "2012-02-07T20:30:31.896Z",
 *   "v": 0
 * }
 *
 * @example
 * <caption>
 * The `timers` field shows the time each handler took to run in microseconds.
 * Restify by default will record this information for every handler for each
 * route. However, if you decide to include nested handlers, you can track the
 * timing yourself by utilizing the Request
 * [startHandlerTimer](#starthandlertimerhandlername) and
 * [endHandlerTimer](#endhandlertimerhandlername) API.
 * You can also listen to auditlog event and get same above log object when
 * log event emits. For example
 * </caption>
 * SERVER.on('auditlog', function (data) {
 *     //do some process with log
 * });
 *
 */
function auditLogger(opts) {
    assert.object(opts, 'opts');
    assert.object(opts.log, 'opts.log');
    assert.string(opts.event, 'opts.event');
    assert.optionalFunc(opts.context, 'opts.context');
    assert.optionalObject(opts.server, 'opts.server');
    assert.optionalBool(opts.printLog, 'opts.printLog');
    assert.optionalObject(opts.serializers, 'opts.serializers');

    if (
        opts.event !== 'after' &&
        opts.event !== 'pre' &&
        opts.event !== 'routed'
    ) {
        throw new errors.VError(
            'opts.event must be %s, %s, or %s, but is %s',
            'pre',
            'routed',
            'after',
            opts.event
        );
    }

    var server = opts.server;
    var printLog = opts.printLog;

    if (typeof printLog === 'undefined') {
        printLog = true;
    }
    var errSerializer = pino.stdSerializers.err;

    // don't break legacy use, where there was no top level opts.serializer
    if (opts.log.serializers && opts.log.serializers.err) {
        errSerializer = opts.log.serializers.err;
    }

    var DEFAULT_SERIALIZERS = {
        err: errSerializer,
        req: function auditRequestSerializer(req) {
            if (!req) {
                return false;
            }

            var timers = {};
            (req.timers || []).forEach(function forEach(time) {
                var t = time.time;
                var _t = Math.floor(1000000 * t[0] + t[1] / 1000);
                timers[time.name] = (timers[time.name] || 0) + _t;
            });
            return {
                // account for native and queryParser plugin usage
                query:
                    typeof req.query === 'function' ? req.query() : req.query,
                method: req.method,
                url: req.url,
                headers: req.headers,
                httpVersion: req.httpVersion,
                trailers: req.trailers,
                version: req.version(),
                body: opts.body === true ? req.body : undefined,
                timers: timers,
                connectionState: req.connectionState && req.connectionState()
            };
        },
        res: function auditResponseSerializer(res) {
            if (!res) {
                return false;
            }

            var body;

            if (opts.body === true) {
                if (res._body instanceof HttpError) {
                    body = res._body.body;
                } else {
                    body = res._body;
                }
            }

            return {
                statusCode: res.statusCode,
                headers: getResponseHeaders(res),
                trailer: res._trailer || false,
                body: body
            };
        }
    };

    var serializers = Object.assign({}, DEFAULT_SERIALIZERS, opts.serializers);

    function audit(req, res, route, err) {
        var latency = res.get('Response-Time');

        if (typeof latency !== 'number') {
            latency = hrTimeDurationInMs(req._timeStart, req._timeFlushed);
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

        // run through the custom context function
        if (opts.context) {
            obj.context = opts.context(req, res, route, err);
        }

        const origLog = (req && req.log) || opts.log;
        if (printLog && origLog) {
            const log = origLog.child(
                {
                    audit: true,
                    component: opts.event
                },
                {
                    serializers: serializers
                }
            );
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

        return true;
    }

    return audit;
}

///-- Exports

module.exports = auditLogger;
