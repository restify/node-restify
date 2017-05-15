// Copyright 2016 Restify. All rights reserved.

'use strict';

var assert = require('assert-plus');

///--- API

/**
 * Provides req.set() and req.get() methods for handlers to share context
 * across the lifetime of a request.
 *
 * @returns {Function}
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
