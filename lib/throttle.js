// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.

var assert = require('assert');

var error = require('./error');
var log = require('./log');
var sprintf = require('./sprintf').sprintf;
var utils = require('./utils');



///--- Globals

var MSG = 'You have exceeded your request rate of %s r/s.';




///--- Internal Class (TokenBucket)

/**
 * An implementation of the Token Bucket algorithm.
 *
 * Basically, in network throttling, there are two "mainstream"
 * algorithms for throttling requests, Token Bucket and Leaky Bucket.
 * For restify, I went with Token Bucket.  For a good description of the
 * algorithm, see: http://en.wikipedia.org/wiki/Token_bucket
 *
 * In the options object, you pass in the total tokens and the fill rate.
 * Practically speaking, this means "allow `fill rate` requests/second,
 * with bursts up to `total tokens`".  Note that the bucket is initialized
 * to full.
 *
 * Also, in googling, I came across a concise python implementation, so this
 * is just a port of that. Thanks http://code.activestate.com/recipes/511490 !
 *
 * @param {Object} options contains the parameters:
 *                   - {Number} capacity the maximum burst.
 *                   - {Number} fillRate the rate to refill tokens.
 */
function TokenBucket(options) {
  assert.ok(options);
  assert.ok(options.capacity);
  assert.ok(options.fillRate);

  this.tokens = this.capacity = options.capacity;
  this.fillRate = options.fillRate;
  this.time = new Date().getTime();
}


/**
 * Consume N tokens from the bucket.
 *
 * If there is not capacity, the tokens are not pulled from the bucket.
 *
 * @param {Number} tokens the number of tokens to pull out.
 * @return {Boolean} true if capacity, false otherwise.
 */
TokenBucket.prototype.consume = function(tokens) {
  assert.ok(tokens);

  if (tokens <= this._fill()) {
    this.tokens -= tokens;
    return true;
  }

  return false;
};


/**
 * Fills the bucket with more tokens.
 *
 * Rather than do some whacky setTimeout() deal, we just approximate refilling
 * the bucket by tracking elapsed time from the last time we touched the bucket.
 *
 * Simply, we set the bucket size to min(totalTokens,
 *                                       current + (fillRate * elapsed time)).
 *
 * @return {Number} the current number of tokens in the bucket.
 */
TokenBucket.prototype._fill = function() {
  var now = new Date().getTime();

  if (this.tokens < this.capacity) {
    var delta = this.fillRate * ((now - this.time) / 1000);
    this.tokens = Math.min(this.capacity, this.tokens + delta);
  }
  this.time = now;

  return this.tokens;
};



///--- Exported API

module.exports = {

  TokenBucket: TokenBucket,

  /**
   * Creates an API rate limiter that can be plugged into the standard
   * restify request handling pipeline.
   *
   * This throttle gives you three options on which to throttle:
   * username, IP address and 'X-Forwarded-For'. IP/XFF is a /32 match,
   * so keep that in mind if using it.  Username takes the user specified
   * on req.username (which gets automagically set for supported Authorization
   * types; otherwise set it yourself with a filter that runs before this).
   *
   * In both cases, you can set a `burst` and a `rate` (in requests/seconds),
   * as an integer/float.  Those really translate to the `TokenBucket`
   * algorithm, so read up on that (or see the comments above...).
   *
   * In either case, the top level options burst/rate set a blanket throttling
   * rate, and then you can pass in an `overrides` object with rates for
   * specific users/IPs.  You should use overrides sparingly, as we make a new
   * TokenBucket to track each.
   *
   * On the `options` object ip and username are treated as an XOR.
   *
   * An example options object with overrides:
   *
   *  {
   *    burst: 10,  // Max 10 concurrent requests (if tokens)
   *    rate: 0.5,  // Steady state: 1 request / 2 seconds
   *    ip: true,   // throttle per IP
   *    overrides: {
   *      '192.168.1.1': {
   *        burst: 0,
   *        rate: 0    // unlimited
   *    }
   *  }
   *
   *
   * @param {Object} options required options with:
   *                   - {Number} burst (required).
   *                   - {Number} rate (required).
   *                   - {Boolean} ip (optional).
   *                   - {Boolean} username (optional).
   *                   - {Boolean} xff (optional).
   *                   - {Object} overrides (optional).
   * @return {Function} of type f(req, res, next) to be plugged into a route.
   * @throws {TypeError} on bad input.
   */
  createThrottle: function(options) {
    if (!options || typeof(options) !== 'object')
      throw new TypeError('options (object) is required');
    if (!options.burst || typeof(options.burst) !== 'number')
      throw new TypeError('options.burst (number) is required');
    if (!options.rate || typeof(options.rate) !== 'number')
      throw new TypeError('options.rate (number) is required');
    if (!utils.xor(options.ip, options.xff, options.username))
      throw new TypeError('Exactly one of options paramas: ip, .username, xff' +
                          ' must be specified');

    var burst = options.burst;
    var rate = options.rate;
    var hash = {};

    return function(req, res, next) {
      assert.ok(req);
      assert.ok(res);
      assert.ok(next);

      var attr;
      if (options.ip) {
        attr = req.connection.remoteAddress;
      } else if (options.xff) {
        attr = req.headers['x-forwarded-for'];
      } else if (options.username) {
        attr = req.username;
      } else {
        log.warn('Invalid throttle configuraion (skipping): %o', options);
        return next();
      }

      // Before bothering with overrides, see if this request even matches
      if (!attr) {
        log.trace('Throttle(%o): no request attribute found (done)', options);
        return next();
      }
      // Ok, check the overrides
      if (options.overrides &&
          options.overrides[attr] &&
          options.overrides[attr].burst !== undefined &&
          options.overrides[attr].rate !== undefined) {

        burst = options.overrides[attr].burst;
        rate = options.overrides[attr].rate;
      }

      if (!rate || !burst) {
        log.trace('Throttle(%o): unlimited request rate for %s', options, attr);
        return next();
      }

      if (!hash[attr]) {
        hash[attr] = new TokenBucket({
          capacity: burst,
          fillRate: rate
        });
      }

      log.trace('Throttle(%o) attr=%s: number of tokens): %d',
                options, attr, hash[attr].tokens);

      if (!hash[attr].consume(1)) {
        log.info('Throttling %s@%s %s %s',
                 (req.username ? req.username : 'UnknownUser'),
                 (req.connection.remoteAddress ?
                  req.connection.remoteAddress : 'UnknownAddress'),
                 req.method,
                 req.url);
        return next(new error.RequestThrottledError(sprintf(MSG, rate)));
      }

      log.trace('Throttle(%o) attr=%s: allowed (tokens=%d).', options, attr,
               hash[attr].tokens);
      return next();
    };
  }

};
