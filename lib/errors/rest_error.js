// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var util = require('util');

var httpErrors = require('./http_error');



///--- Globals

var HttpError = httpErrors.HttpError;

var CODES = {
  BadDigest: 400,
  BadMethod: 405,
  InternalError: 500,
  InvalidArgument: 409,
  InvalidContent: 400,
  InvalidCredentials: 401,
  InvalidHeader: 400,
  InvalidVersion: 400,
  MissingParameter: 409,
  NotAuthorized: 403,
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

  this.name = 'RestError';
  this.code = restCode;
}
util.inherits(RestError, HttpError);



///--- Exports

module.exports = {
  RestError: RestError
};

Object.keys(CODES).forEach(function(k) {
  var name = k + 'Error';
  module.exports[name] = function(message, caller) {
    RestError.call(this,
                   CODES[k],
                   k,
                   message,
                   caller || this.constructor);

    this.name = name;
  };
  util.inherits(module.exports[name], RestError);
});
