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
        return {
          method: req.method,
          url: req.url,
          headers: req.headers,
          httpVersion: req.httpVersion,
          trailers: req.trailers,
          version: req.version
        };
      },
      res: function auditResponseSerializer(res) {
        return {
          statusCode: res.statusCode,
          headers: res.headers,
          trailer: res._trailer || false
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
    var obj = {
      remoteAddress: req.connection.remoteAddress,
      remotePort: req.connection.remotePort,
      req_id: req.id,
      req: req,
      res: res,
      route: route,
      secure: req.secure
    };
    return log.info(obj, '%s handled: %d',
                    (route ? route.name : 'no route'),
                    res.code);
  };
}



///-- Exports

module.exports = auditLogger;
