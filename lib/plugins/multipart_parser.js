// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var formidable = require('formidable');

var errors = require('../errors');



///--- Globals

var BadRequestError = errors.BadRequestError;



///--- API

/**
 * Returns a plugin that will parse the HTTP request body IFF the
 * contentType is multipart/form-data
 *
 * If req.params already contains a given key, that key is skipped and an
 * error is logged.
 *
 * @return {Function} restify handler.
 * @throws {TypeError} on bad input
 */
function multipartBodyParser(options) {
  if (!options)
    options = {};
  if (typeof (options) !== 'object')
    throw new TypeError('options (Object) required');

  return function parseMultipartBody(req, res, next) {
    if (req.contentType !== 'multipart/form-data' ||
        (req.contentLength === 0 && !req.chunked))
      return next();

    var form = new formidable.IncomingForm();
    form.keepExtensions = options.keepExtensions ? true : false;

    return form.parse(req, function (err, fields, files) {
      if (err)
        return next(new BadRequestError(err.toString()));

      req.body = fields;
      req.files = files;

      if (options.mapParams !== false) {
        Object.keys(fields).forEach(function (k) {
          if (req.params[k] && !options.overrideParams) {
            req.log.warn('parameter %s was already sent', k);
            return;
          }

          req.params[k] = fields[k];
        });

        if (req.params.files && !options.overrideParams) {
          req.log.warn('parameter files was already sent');
          return;
        }
        req.params.files = files;
      }

      req.log.trace('(multipart): fields=%j', fields);
      req.log.trace('(multipart): files=%j', files);
      return next();
    });
  };
}



///--- Exports

module.exports = multipartBodyParser;
