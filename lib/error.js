// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.
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

    return e;
  }

};
