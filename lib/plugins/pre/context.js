// Copyright 2018 Restify. All rights reserved.

'use strict';

var assert = require('assert-plus');

///--- API

/**
 * This plugin creates `req.set(key, val)` and `req.get(key)` methods for
 * setting and retrieving request specific data.
 *
 * @public
 * @function context
 * @returns {Function} Handler
 * @example
 * server.pre(restify.plugins.pre.context());
 * server.get('/', [
 *     function(req, res, next) {
 *         req.set(myMessage, 'hello world');
 *         return next();
 *     },
 *     function two(req, res, next) {
 *         res.send(req.get(myMessage)); // => sends 'hello world'
 *         return next();
 *     }
 * ]);
 */
function ctx() {
    return function context(req, res, next) {
        var data = {};

        /**
         * Set context value by key
         * Requires the context plugin.
         *
         * @public
         * @memberof Request
         * @instance
         * @function req.set
         * @param    {String} key - key
         * @param    {*} value - value
         * @returns  {undefined} no return value
         */
        req.set = function set(key, value) {
            assert.string(key, 'key must be string');

            if (key === '') {
                assert.fail('key must not be empty string');
            }
            data[key] = value;
        };

        /**
         * Get context value by key.
         * Requires the context plugin.
         *
         * @public
         * @memberof Request
         * @instance
         * @function req.get
         * @param    {String} key - key
         * @returns  {*} value stored in context
         */
        req.get = function get(key) {
            assert.string(key, 'key must be string');

            if (key === '') {
                assert.fail('key must not be empty string');
            }
            return data[key];
        };

        /**
         * Get all context
         * Requires the context plugin.
         *
         * @public
         * @memberof Request
         * @instance
         * @function req.getAll
         * @returns  {*} value stored in context
         */
        req.getAll = function getAll() {
            return data;
        };

        return next();
    };
}

///--- Exports

module.exports = ctx;
