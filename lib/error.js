// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.
var Constants = require('./constants');

module.exports = {

  /**
   *
   * @param {Object} options:
   *                   - httpCode {Number} HTTP Status code.
   *                   - restCode {String} REST code.
   *                   - message {String} Human Message.
   *                   - error {Error} Exception.
   */
  newError: function(options) {
    if (!options) options = {};

    var e = new Error();
    e._isError = true;
    e.name = Constants.HttpError;
    e.httpCode = options.httpCode ? options.httpCode : 500;
    if (options.restCode) {
      e.restCode = options.restCode;
    } else {
      switch (e.httpCode) {
      case 404:
        e.restCode = Constants.ResourceNotFound;
        break;
      case 400:
      case 409:
        e.restCode = Constants.InvalidArgument;
        break;
      default:
        e.restCode = Constants.UnknownError;
      }
    }
    e.message = options.message ? options.message : 'Unknown error occured.';

    if (options.error) e.cause = options.error;

    return e;
  }

};
