// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.
var util = require('util');

var Constants = require('./constants');
var HttpCodes = require('./http_codes');
var RestCodes = require('./rest_codes');


///--- Error Base class

function RESTError(restCode, httpCode, message, caller) {
  if (Error.captureStackTrace)
    Error.captureStackTrace(this, caller || RESTError);

  this.__defineGetter__('httpCode', function() {
    return httpCode;
  });
  this.__defineGetter__('restCode', function() {
    return restCode;
  });
  this.__defineGetter__('message', function() {
    return message || restCode;
  });
}
util.inherits(RESTError, Error);



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


Object.keys(RestCodes).forEach(function(code) {

  var err = '' + code;
  if (!/\w+Error$/.test(err))
    err += 'Error';

  // At this point LDAP_OPERATIONS_ERROR is now OperationsError in $err
  // and 'Operations Error' in $msg
  module.exports[err] = function(code, message, caller) {
    RESTError.call(this,
                   err,
                   code,
                   (typeof(message) === 'string' ? message : ''),
                   caller || module.exports[err]);
  }
  module.exports[err].constructor = module.exports[err];
  util.inherits(module.exports[err], RESTError);
});
