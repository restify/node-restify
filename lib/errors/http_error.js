// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var http = require('http');
var util = require('util');



///--- Helpers

function codeToErrorName(code) {
  if (!code)
    throw new TypeError('code (Number) required');

  var status = http.STATUS_CODES[parseInt(code, 10)];
  if (!status)
    return false;

  var pieces = status.split(/\W+/);
  var str = '';
  pieces.forEach(function(s) {
    str += s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  });

  return str.replace(/\s+/g, '') + 'Error';
}



///--- Error Base class

function HttpError(code, message, body, constructorOpt) {
  if (Error.captureStackTrace)
    Error.captureStackTrace(this, constructorOpt || HttpError);

  this.name = 'HttpError';
  this.message = message || '';
  this.body = body || this.message;

  var self = this;
  this.__defineGetter__('code', function() {
    return parseInt(code, 10);
  });
}
HttpError.prototype = new Error();
HttpError.prototype.constructor = HttpError;



///--- Exports

module.exports = {

  HttpError: HttpError,

  codeToHttpError: function codeToHttpError(code, message, body) {
    var name = codeToErrorName(code);
    if (!name)
      throw new Error(code + ' is not a known HTTP error code');

    return new module.exports[name](message, body, codeToHttpError);
  }

};



// Export all the 4xx and 5xx HTTP Status codes as Errors
Object.keys(http.STATUS_CODES).forEach(function(code) {
  if (code < 400)
    return;

  var name = codeToErrorName(code);

  module.exports[name] = function(message, body, caller) {
    HttpError.call(this,
                   code,
                   message,
                   body || null,
                   caller || this.constructor);

    this.name = name;
  };
  util.inherits(module.exports[name], HttpError);
});

