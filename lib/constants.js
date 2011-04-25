// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.

module.exports = {
  // Error codes
  InvalidArgument: 'InvalidArgument',
  InvalidCredentials: 'InvalidCredentials',
  InvalidHeader: 'InvalidHeader',
  MissingParameter: 'MissingParameter',
  NotAuthorized: 'NotAuthorized',
  RequestTooLarge: 'RequestTooLarge',
  ResourceNotFound: 'ResourceNotFound',
  UnknownError: 'UnknownError',

  // Headers
  XRequestId: 'X-RequestId',
  XApiVersion: 'X-API-Version',
  XResponseTime: 'X-Response-Time',

  // Misc
  HttpError: 'HttpError',
  ContentTypeJson: 'application/json',
  ContentTypeXml: 'application/xml',
  ContentTypeFormEncoded: 'application/x-www-form-urlencoded',
  DefaultApiVersion: '2011-04-25',
  DefaultServerName: 'node.js'
};
