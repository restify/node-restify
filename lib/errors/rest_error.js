// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var util = require('util');

var assert = require('assert-plus');

var httpErrors = require('./http_error');



///--- Globals

var slice = Function.prototype.call.bind(Array.prototype.slice);

var HttpError = httpErrors.HttpError;

var CODES = {
        BadDigest: 400,
        BadMethod: 405,
        Internal: 500, // Don't have InternalErrorError
        InvalidArgument: 409,
        InvalidContent: 400,
        InvalidCredentials: 401,
        InvalidHeader: 400,
        InvalidVersion: 400,
        MissingParameter: 409,
        NotAuthorized: 403,
        PreconditionFailed: 412,
        RequestExpired: 400,
        RequestThrottled: 429,
        ResourceNotFound: 404,
        WrongAccept: 406
};



///--- API

function RestError(options) {
        assert.object(options, 'options');

        options.constructorOpt = options.constructorOpt || RestError;
        HttpError.apply(this, arguments);

        var self = this;
        this.restCode = options.restCode || 'Error';
        this.body = options.body || {
                code: self.restCode,
                message: options.message || self.message
        };
}
util.inherits(RestError, HttpError);
RestError.prototype.name = 'RestError';



///--- Exports

module.exports = {
        RestError: RestError
};

Object.keys(CODES).forEach(function (k) {
        var name = k;
        if (!/\w+Error$/.test(name))
                name += 'Error';

        module.exports[name] = function (cause, message) {
                var index = 1;
                var opts = {
                        restCode: (k === 'Internal' ? 'InternalError' : k),
                        statusCode: CODES[k]
                };

                if (cause && cause instanceof Error) {
                        opts.cause = cause;
                        opts.constructorOpt = arguments.callee;
                } else if (typeof (cause) === 'object') {
                        opts.body = cause.body;
                        opts.cause = cause.cause;
                        opts.constructorOpt = opts.constructorOpt;
                        opts.message = cause.message;
                        opts.statusCode = cause.statusCode || CODES[k];
                } else {
                        opts.constructorOpt = arguments.callee;
                        index = 0;
                }

                var args = slice(arguments, index);
                args.unshift(opts);
                RestError.apply(this, args);
        };
        util.inherits(module.exports[name], RestError);
        module.exports[name].displayName =
                module.exports[name].prototype.name =
                name;
});
