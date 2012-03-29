// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var Logger = require('bunyan');



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
  if (typeof (options) !== 'object')
    throw new TypeError('options (Object) required');
  if (typeof (options.log) !== 'object')
    throw new TypeError('options.log (Object) required');

  var log = options.log.child({
    audit: true,
    serializers: {
      err: Logger.stdSerializers.err,
      req: function auditRequestSerializer(req) {
        if (!req)
          return false;

        return {
          method: req.method,
          url: req.url,
          headers: req.headers,
          httpVersion: req.httpVersion,
          trailers: req.trailers,
          version: req.version,
          body: options.body === true ? req.body : undefined
        };
      },
      res: function auditResponseSerializer(res) {
        if (!res)
          return false;

        return {
          statusCode: res.statusCode,
          headers: res._headers,
          trailer: res._trailer || false,
          body: options.body === true ? res._body : undefined
        };
      },
      route: function serializeRoute(route) {
        if (!route)
          return false;

        return {
          name: route.name,
          version: route.version
        };
      }
    }
  });

  return function audit(req, res, route) {
    var latency = res.getHeader(res.responseTimeHeader);
    if (typeof (latency) !== 'number')
      latency = new Date().getTime() - req.time.getTime();

    var obj = {
      remoteAddress: req.connection.remoteAddress,
      remotePort: req.connection.remotePort,
      req_id: req.id,
      req: req,
      res: res,
      route: route,
      latency: latency,
      secure: req.secure,
      _audit: true
    };

    return log.info(obj, '%s handled: %d',
                    (route ? route.name : 'no route'),
                    res.statusCode);
  };
}



///-- Exports

module.exports = auditLogger;
