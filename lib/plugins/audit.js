// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var bunyan = require('bunyan');

var args = require('../args');



///--- Globals

var assertObject = args.assertObject;



///--- API

/**
 * Returns a Bunyan audit logger suitable to be used in a server.on('after')
 * event.  I.e.:
 *
 * server.on('after', restify.auditLogger({ log: myAuditStream }));
 *
 * This logs at the INFO level.
 *
 * @param {Object} options at least a bunyan logger (log).
 * @return {Function} to be used in server.after.
 */
function auditLogger(options) {
        assertObject('options', options);
        assertObject('options.log', options.log);

        var log = options.log.child({
                audit: true,
                serializers: {
                        err: bunyan.stdSerializers.err,
                        req: function auditRequestSerializer(req) {
                                if (!req)
                                        return (false);

                                return ({
                                        method: req.method,
                                        url: req.url,
                                        headers: req.headers,
                                        httpVersion: req.httpVersion,
                                        trailers: req.trailers,
                                        version: req.version,
                                        body: options.body === true ?
                                                req.body : undefined
                                });
                        },
                        res: function auditResponseSerializer(res) {
                                if (!res)
                                        return (false);

                                return ({
                                        statusCode: res.statusCode,
                                        headers: res._headers,
                                        trailer: res._trailer || false,
                                        body: options.body === true ?
                                                res._body : undefined
                                });
                        }
                }
        });

        function audit(req, res, route) {
                var latency = res.getHeader('X-Response-Time');
                if (typeof (latency) !== 'number')
                        latency = Date.now() - req._time;

                var obj = {
                        remoteAddress: req.connection.remoteAddress,
                        remotePort: req.connection.remotePort,
                        req_id: req.id,
                        req: req,
                        res: res,
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
