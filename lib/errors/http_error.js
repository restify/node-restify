// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var http = require('http');
var util = require('util');



///--- Helpers

function codeToErrorName(code) {
        code = parseInt(code, 10);
        var status = http.STATUS_CODES[code];
        if (!status) {
                // Until https://github.com/joyent/node/pull/2371 is in
                switch (code) {
                case 428:
                        status = 'Precondition Required';
                        break;
                case 429:
                        status = 'Too Many Requests';
                        break;
                case 431:
                        status = 'Request Header Fields Too Large';
                        break;
                case 511:
                        status = 'Network Authentication Required';
                        break;
                default:
                        return (false);
                }
        }


        var pieces = status.split(/\s+/);
        var str = '';
        pieces.forEach(function (s) {
                str += s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
        });

        str = str.replace(/\W+/g, '');
        if (!/\w+Error$/.test(str))
                str += 'Error';

        return (str);
}



///--- Error Base class

function HttpError(code, message, body, constructorOpt) {
        if (Error.captureStackTrace)
                Error.captureStackTrace(this, constructorOpt || HttpError);

        var self = this;
        code = parseInt(code, 10);

        this.message = message || '';
        this.body = body || {
                code: codeToErrorName(code),
                message: self.message
        };
        this.statusCode = code;
}
util.inherits(HttpError, Error);
HttpError.prototype.name = 'HttpError';



///--- Exports

module.exports = {

        HttpError: HttpError,

        codeToHttpError: function codeToHttpError(code, message, body) {
                var err;
                var name = codeToErrorName(code);
                if (!name)
                        throw new Error('%d is not an HTTP status code', code);

                err = new module.exports[name](message,
                                               body,
                                               codeToHttpError);

                return (err);
        }

};



// Export all the 4xx and 5xx HTTP Status codes as Errors

var codes = Object.keys(http.STATUS_CODES);

// Until https://github.com/joyent/node/pull/2371 is in
codes.push(428, 429, 431, 511);
codes.forEach(function (code) {
        if (code < 400)
                return;

        var name = codeToErrorName(code);

        module.exports[name] = function (message, body, caller) {
                HttpError.call(this,
                               code,
                               message,
                               body || null,
                               caller || this.constructor);
        };
        util.inherits(module.exports[name], HttpError);
        module.exports[name].displayName =
                module.exports[name].prototype.name =
                name;
});
