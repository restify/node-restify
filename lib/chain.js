'use strict';

var assert = require('assert-plus');
var once = require('once');
var customErrorTypes = require('./errorTypes');

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
    assert.func(handler);
    var handlerId = handler._identifier || handler._name || handler.name;
    if (handler.length <= 2) {
        // arity <= 2, must be AsyncFunction
        assert.equal(
            handler.constructor.name,
            'AsyncFunction',
            `Handler [${handlerId}] is missing a third argument (the ` +
                '"next" callback) but is not an async function. Middleware ' +
                'handlers can be either async/await or callback-based.' +
                'Callback-based (non-async) handlers should accept three ' +
                'arguments: (req, res, next). Async handler functions should ' +
                'accept maximum of 2 arguments: (req, res).'
        );
    } else {
        // otherwise shouldn't be AsyncFunction
        assert.notEqual(
            handler.constructor.name,
            'AsyncFunction',
            `Handler [${handlerId}] accepts a third argument (the 'next" ` +
                'callback) but is also an async function. Middleware ' +
                'handlers can be either async/await or callback-based. Async ' +
                'handler functions should accept maximum of 2 arguments: ' +
                '(req, res). Non-async handlers should accept three ' +
                'arguments: (req, res, next).'
        );
    }

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
        if (!handler || req.connectionState() === 'close') {
            process.nextTick(function nextTick() {
                return done(err, req, res);
            });
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
    var hasError = err === false || Boolean(err);

    // Meassure handler timings
    // _name is assigned in the server and router
    req._currentHandler = handler._name;
    req.startHandlerTimer(handler._name);

    function next(nextErr) {
        req.endHandlerTimer(handler._name);
        _next(nextErr, req, res);
    }

    function resolve(value) {
        if (value && req.log) {
            // logs resolved value
            req.log.warn(
                { value },
                'Discarded returned value from async handler'
            );
        }

        return next();
    }

    function reject(error) {
        if (!(error instanceof Error)) {
            error = new customErrorTypes.AsyncError(
                {
                    info: {
                        cause: error,
                        handler: handler._name,
                        method: req.method,
                        path: req.path ? req.path() : undefined
                    }
                },
                'Async middleware rejected without an error'
            );
        }
        return next(error);
    }

    if (hasError && arity === 4) {
        // error-handling middleware
        handler(err, req, res, next);
        return;
    } else if (!hasError && arity < 4) {
        // request-handling middleware
        process.nextTick(function nextTick() {
            const result = handler(req, res, next);
            if (result && typeof result.then === 'function') {
                result.then(resolve, reject);
            }
        });
        return;
    }

    // continue
    next(err);
}
