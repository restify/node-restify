// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.

var newError = require('./error').newError;
var log = require('./log');

var HttpCodes = require('./http_codes');
var RestCodes = require('./rest_codes');


module.exports = {

  /**
   * Creates an API rate limiter that can be plugged into the standard
   * restify request handling pipeline.
   *
   * This throttle gives you two options on which to throttle:
   * username and IP address.  IP address is an exact match (i.e. a /32),
   * so keep that in mind if using it.  In both cases, there's a blanket
   * policy put in place by `options.requests` and `options.seconds`.
   * Which obviously translates to M requetss in N seconds.  On the `options`
   * object ip and username are treated as an XOR.
   *
   * @param {Object} options required options with:
   *                   - {Number} requests (required).
   *                   - {Number} seconds (required).
   *                   - {String} ip (optional).
   *                   - {String} username (optional).
   *                   - {Object} overrides (optional).
   *
   * @return {Function} of type f(req, res, next) to be plugged into a route.
   * @throws {TypeError} on bad input.
   */
  createThrottle: function(options) {
    if (!options) throw new TypeError('options is required');
    if (!options.requests) throw new TypeError('options.requests is required');
    if (!options.seconds) throw new TypeError('options.seconds is required');
    if (!options.ip && !options.username ||
        options.ip && options.username)
      throw new TypeError('options.ip ^ options.username');

    var checked = new Date().getTime();
    var hash = {};

    return function(req, res, next) {
      var requests = options.requests;
      var seconds = options.seconds;
      var rate = requests / seconds;

      var attr = null;
      if (options.ip) {
        attr = req.connection.remoteAddress;
      } else if (options.username) {
        if (options.username === '*' || options.username === true) {
          attr = req.username;
        } else {
          if (options.username !== req.username)
            return next();

          attr = options.username;
        }
      } else {
        log.trace('throttle(%o): not actionable, skipping', options);
        return next();
      }

      if (options.overrides &&
          options.overrides[attr] &&
          options.overrides[attr].requests !== undefined &&
          options.overrides[attr].seconds !== undefined) {

        requests = options.overrides[attr].requests;
        seconds = options.overrides[attr].seconds;
        log.trace('throttle(%o): attr=%s, using overrides r=%d, s=%d',
                  options, attr, requests, seconds);
      }

      if (seconds === 0) {
        log.trace('throttle(%o): attr=%s, seconds=0. unlimited',
                  options, attr);
        return next();
      }

      if (!hash[attr])
        hash[attr] = requests + 1;

      var now = new Date().getTime();
      var delta = (now - checked) / 1000;

      if (delta > seconds) {
        log.trace('throttle(%o): attr=%s => resetting counter');
        hash[attr] = requests + 1;
        checked = now;
        return next();
      }

      hash[attr] -= 1;
      log.trace('throttle(%o): attr=%s, current=%d, requests=%d',
                options, attr, hash[attr], requests);

      if (hash[attr] <= 0) {
        return res.sendError(newError({
          httpCode: HttpCodes.Forbidden,
          restCode: RestCodes.RequestThrottled,
          message: 'You have exceeded ' + requests +
            ' requests per ' + seconds + ' seconds.'
        }));
      }
      return next();
    };
  }

};
