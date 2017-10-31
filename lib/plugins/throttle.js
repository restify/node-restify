// Copyright 2012 Mark Cavage <mcavage@gmail.com> All rights reserved.

'use strict';

var sprintf = require('util').format;

var assert = require('assert-plus');
var LRU = require('lru-cache');
var errors = require('restify-errors');

///--- Globals

var TooManyRequestsError = errors.TooManyRequestsError;

var MESSAGE = 'You have exceeded your request rate of %s r/s.';

///--- Helpers

/**
 * @private
 * @function xor
 * @returns {undefined} no return value
 */
function xor() {
    var x = false;

    for (var i = 0; i < arguments.length; i++) {
        if (arguments[i] && !x) {
            x = true;
        } else if (arguments[i] && x) {
            return false;
        }
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
 * @private
 * @class TokenBucket
 * @param {Object} options - contains the parameters:
 *                   - {Number} capacity the maximum burst.
 *                   - {Number} fillRate the rate to refill tokens.
 */
function TokenBucket(options) {
    assert.object(options, 'options');
    assert.number(options.capacity, 'options.capacity');
    assert.number(options.fillRate, 'options.fillRate');

    this.tokens = this.capacity = options.capacity;
    this.fillRate = options.fillRate;
    this.time = Date.now();
}

/**
 * Consume N tokens from the bucket.
 *
 * If there is not capacity, the tokens are not pulled from the bucket.
 *
 * @private
 * @memberof TokenBucket
 * @instance
 * @function consume
 * @param    {Number}  tokens - the number of tokens to pull out.
 * @returns  {Boolean}        true if capacity, false otherwise.
 */
TokenBucket.prototype.consume = function consume(tokens) {
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
 * @private
 * @memberof TokenBucket
 * @instance
 * @function _fill
 * @returns  {Number} the current number of tokens in the bucket.
 */
TokenBucket.prototype._fill = function _fill() {
    var now = Date.now();

    // reset account for clock drift (like DST)
    if (now < this.time) {
        this.time = now - 1000;
    }

    if (this.tokens < this.capacity) {
        var delta = this.fillRate * ((now - this.time) / 1000);
        this.tokens = Math.min(this.capacity, this.tokens + delta);
    }
    this.time = now;

    return this.tokens;
};

///--- Internal Class (TokenTable)
/**
 * Just a wrapper over LRU that supports put/get to store token -> bucket
 * mappings.
 *
 * @private
 * @class TokenTable
 * @param {Object} options -      an options object
 * @param {Number} options.size - size of the LRU
 */
function TokenTable(options) {
    assert.object(options, 'options');

    this.table = new LRU(options.size || 10000);
}

/**
 * Puts a value in the token table
 *
 * @private
 * @memberof TokenTable
 * @instance
 * @function put
 * @param {String}      key -   a name
 * @param {TokenBucket} value - a TokenBucket
 * @returns {undefined} no return value
 */
TokenTable.prototype.put = function put(key, value) {
    this.table.set(key, value);
};

/**
 * Puts a value in the token table
 *
 * @private
 * @memberof TokenTable
 * @instance
 * @function get
 * @param {String} key - a key
 * @returns {TokenBucket} token bucket instance
 */
TokenTable.prototype.get = function get(key) {
    return this.table.get(key);
};

///--- Exported API

/**
 * Creates an API rate limiter that can be plugged into the standard
 * restify request handling pipeline.
 *
 * `restify` ships with a fairly comprehensive implementation of
 * [Token bucket](http://en.wikipedia.org/wiki/Token_bucket), with the ability
 * to throttle on IP (or x-forwarded-for) and username (from `req.username`).
 * You define "global" request rate and burst rate, and you can define
 * overrides for specific keys.
 * Note that you can always place this on per-URL routes to enable
 * different request rates to different resources (if for example, one route,
 * like `/my/slow/database` is much easier to overwhlem
 * than `/my/fast/memcache`).
 *
 * If a client has consumed all of their available rate/burst, an HTTP response
 * code of `429`
 * [Too Many Requests]
 * (http://tools.ietf.org/html/draft-nottingham-http-new-status-03#section-4)
 * is returned.
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
 * @public
 * @function throttle
 * @throws {TooManyRequestsError}
 * @param {Object} options - required options with:
 * @param {Number} options.burst - burst
 * @param {Number} options.rate - rate
 * @param {Boolean} [options.ip] - ip
 * @param {Boolean} [options.username] - username
 * @param {Boolean} [options.xff] - xff
 * @param {Boolean} [options.setHeaders=false] - Set response headers for rate,
 *                               limit (burst) and remaining.
 * @param {Object} [options.overrides] - overrides
 * @param {Object} options.tokensTable - a storage engine this plugin will
 *                              use to store throttling keys -> bucket mappings.
 *                              If you don't specify this, the default is to
 *                              use an in-memory O(1) LRU, with 10k distinct
 *                              keys.  Any implementation just needs to support
 *                              put/get.
 * @param {Number} [options.maxKeys=10000] - If using the default
 *                              implementation, you can specify how large you
 *                              want the table to be.
 * @returns  {Function} Handler
 * @example
 * <caption>
 * An example options object with overrides:
 * </caption>
 * {
 *   burst: 10,  // Max 10 concurrent requests (if tokens)
 *   rate: 0.5,  // Steady state: 1 request / 2 seconds
 *   ip: true,   // throttle per IP
 *   overrides: {
 *     '192.168.1.1': {
 *       burst: 0,
 *       rate: 0    // unlimited
 *   }
 * }
 */
function throttle(options) {
    assert.object(options, 'options');
    assert.number(options.burst, 'options.burst');
    assert.number(options.rate, 'options.rate');
    assert.optionalBool(options.setHeaders, 'options.setHeaders');

    if (!xor(options.ip, options.xff, options.username)) {
        throw new Error('(ip ^ username ^ xff)');
    }

    var table =
        options.tokensTable || new TokenTable({ size: options.maxKeys });

    function rateLimit(req, res, next) {
        var attr;
        var burst = options.burst;
        var rate = options.rate;

        if (options.ip) {
            attr = req.connection.remoteAddress;
        } else if (options.xff) {
            attr = req.headers['x-forwarded-for'];
        } else if (options.username) {
            attr = req.username;
        } else {
            req.log.warn({ config: options }, 'Invalid throttle configuration');
            return next();
        }

        // Before bothering with overrides, see if this request
        // even matches
        if (!attr) {
            return next();
        }

        // Check the overrides
        if (
            options.overrides &&
            options.overrides[attr] &&
            options.overrides[attr].burst !== undefined &&
            options.overrides[attr].rate !== undefined
        ) {
            burst = options.overrides[attr].burst;
            rate = options.overrides[attr].rate;
        }

        if (!rate || !burst) {
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

        var tooManyRequests = !bucket.consume(1);

        // set throttle headers after consume which changes the remaining tokens
        if (options.setHeaders) {
            res.header('X-RateLimit-Remaining', Math.floor(bucket.tokens));
            res.header('X-RateLimit-Limit', burst);
            res.header('X-RateLimit-Rate', rate);
        }

        if (tooManyRequests) {
            req.log.info(
                {
                    address: req.connection.remoteAddress || '?',
                    method: req.method,
                    url: req.url,
                    user: req.username || '?'
                },
                'Throttling'
            );

            var msg = sprintf(MESSAGE, rate);
            return next(new TooManyRequestsError(msg));
        }

        return next();
    }

    return rateLimit;
}

module.exports = throttle;
