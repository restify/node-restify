// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.

var HttpCodes = require('./http_codes');


function RestCode(code, message) {
  this.__defineGetter__('httpCode', function() {
    return code;
  });
  this.__defineGetter__('message', function() {
    return message;
  });
}


RestCode.prototype.toString = function() {
  return this.message;
};


RestCode.prototype.valueOf = function() {
  return this.toString().valueOf();
};



///--- API

module.exports = {
  BadRequest: new RestCode(HttpCodes.BadRequest, 'BadRequest'),
  InternalError: new RestCode(HttpCodes.InternalError, 'InternalError'),
  InvalidArgument: new RestCode(HttpCodes.Conflict, 'InvalidArgument'),
  InvalidCredentials: new RestCode(HttpCodes.NotAuthorized,
                                   'InvalidCredentials'),
  InvalidHeader: new RestCode(HttpCodes.BadRequest, 'InvalidHeader'),
  InvalidVersion: new RestCode(HttpCodes.RetryWith, 'InvalidVersion'),
  MissingParameter: new RestCode(HttpCodes.Conflict, 'MissingParameter'),
  NotAuthorized: new RestCode(HttpCodes.Forbidden, 'NotAuthorized'),
  RequestThrottled: new RestCode(HttpCodes.Throttle, 'RequestThrottled'),
  RequestTooLarge: new RestCode(HttpCodes.RequestTooLarge, 'RequestTooLarge'),
  ResourceMoved: new RestCode(HttpCodes.Redirect, 'ResourceMoved'),
  ResourceNotFound: new RestCode(HttpCodes.NotFound, 'ResourceNotFound'),
  RetriesExceeded: new RestCode(HttpCodes.ServiceUnavailable,
                                'RetriesExceeded'),
  UnknownError: new RestCode(HttpCodes.InternalError, 'UnknownError')
};
