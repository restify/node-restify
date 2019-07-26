'use strict';

var assert = require('assert-plus');
var once = require('once');

module.exports = Chain;

/**
 * Create a new middleware chain
 *
 * @public
 * @class Chain
 * @param {Object} [options] - options
 * @param {Boolean} [options.onceNext=false] - Prevents calling next multiple
 *  times
 * @param {Boolean} [options.strictNext=false] - Throws error when next() is
 *  called more than once, enables onceNext option
 * @example
 * var chain = new Chain();
 * chain.add(function (req, res, next) { next(); })
 * // chain.add(function (req, res, next) { next(new Error('Foo')); })
 * // chain.add(function (req, res, next) { next(false); })
 *
 * http.createServer((req, res) => {
 *    chain.run(req, res, function done(err) {
 *       res.end(err ? err.message : 'hello world');
 *    });
 * })
 */
function Chain(options) {
    assert.optionalObject(options, 'options');
    options = options || {};
    assert.optionalBool(options.onceNext, 'options.onceNext');
    assert.optionalBool(options.strictNext, 'options.strictNext');

    this.onceNext = !!options.onceNext;
    this.strictNext = !!options.strictNext;

    // strictNext next enforces onceNext
    if (this.strictNext) {
        this.onceNext = true;
    }

    this._stack = [];
    this._once = this.strictNext === false ? once : once.strict;
}

/**
 * Public methods.
 * @private
 */

/**
 * Get handlers of a chain instance
 *
 * @memberof Chain
 * @instance
 * @returns {Function[]} handlers
 */
Chain.prototype.getHandlers = function getHandlers() {
    return this._stack;
};

/**
 * Utilize the given middleware `handler`
 *
 * @public
 * @memberof Chain
 * @instance
 * @param {Function} handler - handler
 * @returns {undefined} no return value
 */
Chain.prototype.add = function add(handler) {
    // _name is assigned in the server and router
    handler._name = handler._name || handler.name;

    // add the middleware
    this._stack.push(handler);
};

/**
 * Returns the number of handlers
 *
 * @public
 * @memberof Chain
 * @instance
 * @returns {Number} number of handlers in the stack
 */
Chain.prototype.count = function count() {
    return this._stack.length;
};

/**
 * Handle server requests, punting them down
 * the middleware stack.
 *
 * @public
 * @memberof Chain
 * @instance
 * @param {Request} req - request
 * @param {Response} res - response
 * @param {Function} done - final handler
 * @returns {undefined} no return value
 */
Chain.prototype.run = function run(req, res, done) {
    var self = this;
    var index = 0;

    function next(err) {
        // next callback
        var handler = self._stack[index++];

        // all done or request closed
        if (!handler || req.closed()) {
            setImmediate(done, err, req, res);
            return;
        }

        // call the handler
        call(handler, err, req, res, self.onceNext ? self._once(next) : next);
    }

    next();
    return;
};

/**
 * Helper functions
 * @private
 */

/**
 * Invoke a handler.
 *
 * @private
 * @param {Function} handler - handler function
 * @param {Error|false|*} err - error, abort when true value or false
 * @param {Request} req - request
 * @param {Response} res - response
 * @param {Function} _next - next handler
 * @returns {undefined} no return value
 */
function call(handler, err, req, res, _next) {
    var arity = handler.length;
    var error = err;
    var hasError = err === false || Boolean(err);

    // Meassure handler timings
    // _name is assigned in the server and router
    req._currentHandler = handler._name;
    req.startHandlerTimer(handler._name);

    function next(nextErr) {
        req.endHandlerTimer(handler._name);
        _next(nextErr, req, res);
    }

    if (hasError && arity === 4) {
        // error-handling middleware
        handler(err, req, res, next);
        return;
    } else if (!hasError && arity < 4) {
        // request-handling middleware
        process.nextTick(function nextTick() {
            handler(req, res, next);
        });
        return;
    }

    // continue
    next(error, req, res);
    return;
}
