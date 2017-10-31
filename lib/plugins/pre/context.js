// Copyright 2016 Restify. All rights reserved.

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

        req.set = function set(key, value) {
            assert.string(key, 'key must be string');

            if (key === '') {
                assert.fail('key must not be empty string');
            }
            data[key] = value;
        };

        req.get = function get(key) {
            assert.string(key, 'key must be string');

            if (key === '') {
                assert.fail('key must not be empty string');
            }
            return data[key];
        };

        // private method which returns the entire context object
        req._getAllContext = function _getAllContext() {
            return data;
        };

        return next();
    };
}

///--- Exports

module.exports = ctx;
