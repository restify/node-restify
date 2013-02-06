// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert-plus');

var shallowCopy = require('../utils').shallowCopy;



///--- API

function requestLogger(options) {
        assert.optionalObject(options);
        options = options || {};

        var props;
        if (options.properties) {
                props = shallowCopy(options.properties);
        } else {
                props = {};
        }
        if (options.serializers)
                props.serializers = options.serializers;

        function bunyan(req, res, next) {
                if (!req.log && !options.log) {
                        next();
                        return;
                }

                var log = req.log || options.log;

                props.req_id = req.getId();
                req.log = log.child(props, props.serializers ? false : true);
                if (props.req_id)
                        delete props.req_id;

                next();
        }

        return (bunyan);
}



///--- Exports

module.exports = requestLogger;
