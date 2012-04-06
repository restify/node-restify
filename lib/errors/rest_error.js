// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var util = require('util');

var httpErrors = require('./http_error');



///--- Globals

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


///--- Errors

function RestError(statusCode, restCode, message, caller) {
  HttpError.call(this,
                 statusCode || 500,
                 message || '',
                 {
                   code: restCode || 'Error',
                   message: message || 'Unknown error'
                 },
                 caller || this.constructor);

  this.code = this.restCode = restCode;
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

  module.exports[name] = function () {
    var message = util.format.apply(util, arguments);
    RestError.call(this,
                   CODES[k],
                   k,
                   message,
                   this.constructor);
  };
  util.inherits(module.exports[name], RestError);
  module.exports[name].displayName = module.exports[name].prototype.name = name;
});
