// Copyright 2012 Mark Cavage <mcavage@gmail.com> All rights reserved.

var assert = require('assert');
var sprintf = require('util').format;

var LRU = require('lru-cache');

var errors = require('../errors');



///--- Globals

var TooManyRequestsError = errors.TooManyRequestsError;

var MESSAGE = 'You have exceeded your request rate of %s r/s.';



///--- Helpers

function xor() {
  var x = false;
  for (var i = 0; i < arguments.length; i++) {
    if (arguments[i] && !x)
      x = true;
    else if (arguments[i] && x)
      return false;
  }
  return x;
}



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
TokenBucket.prototype.consume = function consume(tokens) {
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
TokenBucket.prototype._fill = function _fill() {
  var now = new Date().getTime();
  if (now < this.time) // reset account for clock drift (like DST)
    this.time = now - 1000;

  if (this.tokens < this.capacity) {
    var delta = this.fillRate * ((now - this.time) / 1000);
    this.tokens = Math.min(this.capacity, this.tokens + delta);
  }
  this.time = now;

  return this.tokens;
};



///--- Internal Class (TokenTable)
// Just a wrapper over LRU that supports put/get to store token -> bucket
// mappings

function TokenTable(options) {
  if (typeof (options) !== 'object')
    throw new TypeError('options (Object) required');

  this.table = new LRU(options.size || 10000);
}


TokenTable.prototype.put = function put(key, value) {
  if (typeof (key) !== 'string')
    throw new TypeError('key (String) required');
  if (!value || !(value instanceof TokenBucket))
    throw new TypeError('value (TokenBucket) required');

  this.table.set(key, value);
};


TokenTable.prototype.get = function get(key) {
  if (typeof (key) !== 'string')
    throw new TypeError('key (String) required');

  return this.table.get(key);
};



///--- Exported API

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
 *                   - {Object} tokensTable: a storage engine this plugin will
 *                              use to store throttling keys -> bucket mappings.
 *                              If you don't specify this, the default is to
 *                              use an in-memory O(1) LRU, with 10k distinct
 *                              keys.  Any implementation just needs to support
 *                              put/get.
 *                   - {Number} maxKeys: If using the default implementation,
 *                              you can specify how large you want the table to
 *                              be.  Default is 10000.
 * @return {Function} of type f(req, res, next) to be plugged into a route.
 * @throws {TypeError} on bad input.
 */
function throttle(options) {
  if (!options || typeof (options) !== 'object')
    throw new TypeError('options (Object) is required');
  if (!options.burst || typeof (options.burst) !== 'number')
    throw new TypeError('options.burst (Number) is required');
  if (!options.rate || typeof (options.rate) !== 'number')
    throw new TypeError('options.rate (Number) is required');
  if (!xor(options.ip, options.xff, options.username))
    throw new TypeError('Exactly one of ip, username, xff must be specified');

  var burst = options.burst;
  var rate = options.rate;
  var table = options.tokensTable || new TokenTable({size: options.maxKeys});

  return function rateLimit(req, res, next) {
    var attr;
    if (options.ip) {
      attr = req.connection.remoteAddress;
    } else if (options.xff) {
      attr = req.headers['x-forwarded-for'];
    } else if (options.username) {
      attr = req.username;
    } else {
      req.log.warn('Invalid throttle configuraion (skipping): %j', options);
      return next();
    }

    // Before bothering with overrides, see if this request even matches
    if (!attr) {
      req.log.trace('Throttle: no request attribute found (done)');
      return next();
    }

    // Check the overrides
    if (options.overrides &&
        options.overrides[attr] &&
        options.overrides[attr].burst !== undefined &&
        options.overrides[attr].rate !== undefined) {

      burst = options.overrides[attr].burst;
      rate = options.overrides[attr].rate;
    }

    if (!rate || !burst) {
      req.log.trace('Throttle(%s): unlimited request rate', attr);
      return next();
    }

    var bucket = table.get(attr);
    if (!bucket) {
      bucket = new TokenBucket({
        capacity: burst,
        fillRate: rate
      });
      table.put(attr, bucket);
    }

    req.log.trace('Throttle(%s): num_tokens= %d', attr, bucket.tokens);

    if (!bucket.consume(1)) {
      req.log.info('Throttling %s@%s %s %s',
                   (req.username ? req.username : 'UnknownUser'),
                   (req.connection.remoteAddress ?
                    req.connection.remoteAddress : 'UnknownAddress'),
                   req.method,
                   req.url);

      // Until https://github.com/joyent/node/pull/2371 is in
      return next(new TooManyRequestsError(sprintf(MESSAGE, rate)));
    }

    req.log.trace('Throttle(%s) allowed', attr);

    return next();
  };
}

module.exports = throttle;
