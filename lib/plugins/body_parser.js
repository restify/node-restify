// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var jsonParser = require('./json_body_parser');
var formParser = require('./form_body_parser');
var multipartParser = require('./multipart_parser');

var errors = require('../errors');

var UnsupportedMediaTypeError = errors.UnsupportedMediaTypeError;


function bodyParser(options) {

  var parseForm = formParser(options);
  var parseJson = jsonParser(options);
  var parseMultipart = multipartParser(options);

  return function parseBody(req, res, next) {
    if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH')
      return next();

    if (req.contentLength === 0 && !req.chunked)
      return next();

    if (req.contentType === 'application/json') {
      return parseJson(req, res, next);
    } else if (req.contentType === 'application/x-www-form-urlencoded') {
      return parseForm(req, res, next);
    } else if (req.contentType === 'multipart/form-data') {
      return parseMultipart(req, res, next);
    } else if (options && options.rejectUnknown !== false) {
      return next(new UnsupportedMediaTypeError('Unsupported Content-Type: ' +
                                                req.contentType));
    }

    return next();
  };
}

module.exports = bodyParser;
