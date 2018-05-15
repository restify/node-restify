'use strict';
/* eslint-disable func-names */

var Chain = require('../chain');
var _ = require('lodash');

module.exports = composeHandlerChain;

/**
 * Builds a function with the signature of a handler
 * function(req,resp,callback).
 * which internally executes the passed in array of handler function as a chain.
 *
 * @param {Array} [handlers] - handlers Array of
 * function(req,resp,callback) handlers.
 * @param {Object} [options] - options Optional option object that is
 * passed to Chain.
 * @returns {Function} Handler function that executes the handler chain when run
 */
function composeHandlerChain(handlers, options) {
    var chain = new Chain(options);
    if (_.isArray(handlers)) {
        handlers = _.flattenDeep(handlers);
        handlers.forEach(function(handler) {
            chain.add(handler);
        });
    } else {
        chain.add(handlers);
    }

    return function handlerChain(req, resp, callback) {
        chain.run(req, resp, callback);
    };
}
