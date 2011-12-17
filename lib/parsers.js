// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert');
var querystring = require('querystring');
var url = require('url');

var httpErrors = require('./err/http_error');
var restErrors = require('./err/rest_error');



///--- Globals

var BadRequestError = restErrors.BadRequestError;
var InvalidHeaderError = restErrors.InvalidHeaderError;
var NotAcceptableError = httpErrors.NotAcceptableError;



// The following three functions are courtesy of expressjs
// as is req.accepts(), and req.is() below.
//
// https://github.com/visionmedia/express
//
function parseAccept(str){
  return parseQuality(str).map(function(obj){
    var parts = obj.value.split('/');
    obj.type = parts[0];
    obj.subtype = parts[1];
    return obj;
  });
};


function parseQuality(str){
  return str.split(/ *, */).map(quality).filter(function(obj){
    return obj.quality;
  }).sort(function(a, b){
    return b.quality - a.quality;
  });
};


function quality(str) {
  var parts = str.split(/ *; */);
  var val = parts[0];
  var q = parts[1] ? parseFloat(parts[1].split(/ *= */)[1]) : 1;

  return { value: val, quality: q };
}



///--- "Middleware"

function getAcceptParser(acceptable) {
  if (!acceptable)
    throw new TypeError('acceptable ([String]) required');
  if (!Array.isArray(acceptable))
    acceptable = [acceptable];

  acceptable.forEach(function(a) {
    if (typeof(a) !== 'string')
      throw new TypeError('accept types must be strings');
  });

  return function acceptParser(req, res, next) {
    if (!req.headers.accept) {
      req.accept = ['*/*'];
      return next();
    }

    req.accept = parseAccept(req.headers.accept);
    for (var i = 0; i < acceptable.length; i++)
      if (req.accepts(acceptable[i]))
        return next();

    return next(new NotAcceptableError('Server accepts: ' + acceptable.join()));
  };
}


function getAuthorizationParser() {

  return function parseAuthorization(req, res, next) {
    req.authorization = {};
    req.username = 'anonymous';

    if (!req.headers.authorization) {
      req.log.trace('No authorization header present.');
      return next();
    }

    var pieces = req.headers.authorization.split(' ', 2);
    if (!pieces || pieces.length !== 2)
      return next(new BadRequestError('BasicAuth content is invalid.'));

    req.authorization = {
      scheme: pieces[0],
      credentials: pieces[1]
    };

    if (pieces[0] === 'Basic') {
      var decoded = (new Buffer(pieces[1], 'base64')).toString('utf8');
      if (!decoded) {
        res.sendError(new InvalidHeaderError('Authorization: Basic content ' +
                                             'is invalid (not base64).'));
        return false;
      }

      if (decoded !== null) {
        var idx = decoded.indexOf(':');
        if (idx === -1) {
          pieces = [decoded];
        } else {
          pieces = [decoded.slice(0, idx), decoded.slice(idx + 1)];
        }
      }

      if (!(pieces !== null ? pieces[0] : null) ||
          !(pieces !== null ? pieces[1] : null)) {
        res.sendError(new InvalidHeaderError('Authorization: Basic content' +
                                             'is invalid.'));
        return false;
      }

      req.authorization.basic = {
        username: pieces[0],
        password: pieces[1]
      };
      req.username = pieces[0];
    } else {
      req.log.debug('Unknown authorization scheme %s. Skipping processing',
                    req.authorization.scheme);
    }

    return next();
  };
}


function getDateParser(clockSkew) {
  if (clockSkew === undefined || clockSkew === null)
    clockSkew = 300;
  if (clockSkew === false)
    clockSkew = 0;

  if (typeof(clockSkew) !== 'number')
    throw new TypeError('clockSkew (Number) required');

  clockSkew = clockSkew * 1000;

  return function parseDate(req, res, next) {
    if (clockSkew === 0)
      return next();

    if (req.headers.date) {
      try {
        var date = new Date(req.headers.date);
        var now = new Date();

        if (req.log.isTraceEnabled())
          req.log.trace('Date: sent=%d, now=%d, allowed=%d',
                        date.getTime(), now.getTime(), clockSkew);

        if ((now.getTime() - date.getTime()) > clockSkew)
          return next(new BadRequestError('Date header is too old'));

      } catch (e) {
        if (req.log.isTraceenabled())
          req.log.trace('Bad Date header: %s' + e.stack);

        return next(new BadRequestError('Date header is invalid'));
      }
    }

    return next();
  };
}


function getQueryParser() {
  return function parseQueryString(req, res, next) {
    var _url = url.parse(req.url);
    if (_url.query) {
      var qs = querystring.parse(_url.query);
      Object.keys(qs).forEach(function(k) {
        if (req.params[k]) {
          req.log.warn('%s is a URL parameter, but was on the querystring', k);
          return;
        }
        req.params[k] = qs[k];
      });
    }

    if (req.log.isTraceEnabled())
      req.log.trace('req.params now: %j', req.params);
    return next();
  }
}



///--- Exports

module.exports = {

  getAcceptParser: getAcceptParser,
  getAuthorizationParser: getAuthorizationParser,
  getDateParser: getDateParser,
  getQueryParser: getQueryParser

};
