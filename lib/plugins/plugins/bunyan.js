// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var assert = require('assert-plus');

var shallowCopy = require('../utils/shallowCopy');


///--- API

/**
 * attaches bunyan logger to the request.
 * @public
 * @function requestLogger
 * @param    {Object}   options an options object
 * @returns  {Function}
 */
function requestLogger(options) {
    assert.optionalObject(options);
    var opts = options || {};

    var props;

    if (opts.properties) {
        props = shallowCopy(opts.properties);
    } else {
        props = {};
    }

    if (opts.serializers) {
        props.serializers = opts.serializers;
    }

    var headersToCopy = opts.headers || [];

    return function bunyan(req, res, next) {
        if (!req.log && !opts.log) {
            next();
            return;
        }

        var log = req.log || opts.log;

        props.req_id = req.getId();
        headersToCopy.forEach(function (k) {

            if (req.headers[k]) {
                props[k] = req.headers[k];
            }
        });
        req.log = log.child(props, props.serializers ? false : true);

        if (props.req_id) {
            delete props.req_id;
        }

        next();
    };
}


///--- Exports

module.exports = requestLogger;
