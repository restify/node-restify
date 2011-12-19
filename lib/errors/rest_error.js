// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var util = require('util');

var httpErrors = require('./http_error');



///--- Globals

var HttpError = httpErrors.HttpError;



///--- Errors

function BadRequestError(message) {
  var self = this;
  var body = {
    code: self.name,
    message: message
  };
  httpErrors.BadRequestError.call(this, message, body, BadRequestError);
};
util.inherits(BadRequestError, httpErrors.BadRequestError);


function InvalidHeaderError(message) {
  var self = this;
  var body = {
    code: self.name,
    message: message
  };
  httpErrors.BadRequestError.call(this, message, body, InvalidHeaderError);
};
util.inherits(InvalidHeaderError, httpErrors.BadRequestError);




///--- exports

// module.exports = {
//   BadRequestError: BadRequestError,
//   InvalidHeaderError: InvalidHeaderError
// };

function RestError(code, name, message) {
  httpErrors.HttpError.call(this, code, message, {
    code: name,
    message: message
  }, arguments.callee);
}
util.inherits(RestError, httpErrors.HttpError);
module.exports = RestError;
