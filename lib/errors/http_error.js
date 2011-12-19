// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var http = require('http');
var util = require('util');



///--- Error Base class

function HttpError(code, message, body, caller) {
  var self = this;
  Error.call(this, message);

  if (Error.captureStackTrace)
    Error.captureStackTrace(this, caller);

  this.__defineGetter__('code', function() {
    return parseInt(code, 10);
  });
  this.__defineGetter__('message', function() {
    return message || '';
  });
  this.__defineGetter__('body', function() {
    return body || self.message;
  });
}
util.inherits(HttpError, Error);
module.exports.HttpError = HttpError;


// Export all the HTTP Status codes
Object.keys(http.STATUS_CODES).forEach(function(code) {
  if (code < 400)
    return;

  var name = http.STATUS_CODES[code].replace(/(\s|\W)+/g, '') + 'Error';

  module.exports[name] = function(message, body, caller) {
    HttpError.call(this,
                   code,
                   message,
                   body || null,
                   caller || arguments.callee);
  };
  util.inherits(module.exports[name], HttpError);
});
