// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.
var util = require('util');

var Constants = require('./constants');
var HttpCodes = require('./http_codes');
var RestCodes = require('./rest_codes');



module.exports = {

  /**
   *
   * @param {Object} options:
   *                   - httpCode {Number} HTTP Status code.
   *                   - restCode {String} REST code.
   *                   - message {String} Human Message.
   *                   - headers {Object} extra HTTP headers.
   *                   - error {Error} Exception.
   *                   - details {Object} Whatever you want.
   */
  newError: function(options) {
    if (!options) options = {};

    var e = new Error();
    e._isError = true;
    e.name = Constants.HttpError;
    e.httpCode = options.httpCode ? options.httpCode : HttpCodes.InternalError;
    if (options.restCode) {
      e.restCode = options.restCode;
    } else {
      switch (e.httpCode) {
      case HttpCodes.NotFound:
        e.restCode = RestCodes.ResourceNotFound;
        break;
      case HttpCodes.BadRequest:
      case HttpCodes.Conflict:
        e.restCode = RestCodes.InvalidArgument;
        break;
      default:
        e.restCode = RestCodes.UnknownError;
      }
    }
    e.message = options.message ? options.message : 'Unknown error occured.';

    if (options.error) e.cause = options.error;
    if (options.details) e.details = options.details;
    if (options.headers) e.headers = options.headers;

    return e;
  }

};


///--- Error Base class

function RESTError(httpCode, restCode, message, extra, caller) {
  if (Error.captureStackTrace)
    Error.captureStackTrace(this, caller);

  this.__defineGetter__('httpCode', function() {
    return httpCode;
  });
  this.__defineGetter__('restCode', function() {
    return restCode;
  });
  this.__defineGetter__('name', function() {
    return restCode;
  });
  this.__defineGetter__('message', function() {
    return message || restCode;
  });
  this.__defineGetter__('details', function() {
    return extra || {};
  });
}
util.inherits(RESTError, Error);

module.exports.RESTError = RESTError;

Object.keys(RestCodes).forEach(function(c) {
  var err = '' + c;
  if (!/\w+Error$/.test(err))
    err += 'Error';

  module.exports[err] = function(code, message, details) {
    if (typeof(code) !== 'number') {
      details = message;
      message = code;
      code = RestCodes[c].httpCode;
    }

    RESTError.call(this,
                   code,
                   c,
                   typeof(message) === 'string' ? message : err,
                   typeof(details) === 'object' ? details : null,
                   arguments.callee);
  };
  util.inherits(module.exports[err], RESTError);
});
