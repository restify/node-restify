// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var d = require('dtrace-provider');
var mime = require('mime');

var log4js = require('../log4js_stub');

var HTTPClient = require('./http_client');
var JSONClient = require('./json_client');
var StringClient = require('./string_client');



///--- API

function createClient(options) {
  var client;
  var dtrace;

  if (typeof(options) !== 'object')
    throw new TypeError('options (Object) required');
  if (!options.log4js)
    options.log4js = log4js;
  if (!options.name)
    options.name = 'restify';
  if (!options.dtrace) {
    dtrace = d.createDTraceProvider(options.name);
    options.dtrace = dtrace;
  }
  if (!options.type)
    options.type = 'application/octet-stream';

  if (options.type.indexOf('/') === -1)
    options.type = mime.lookup(type);

  switch (options.type) {
  case 'application/json':
    client = new JSONClient(options);
    break;
  case 'text/plain':
    client = new StringClient(options);
    break;
  default:
    client = new HTTPClient(options);
    break;
  }

  // If the caller didn't pass in a DTrace provider, then just go ahead and
  // enable the one we created.
  if (dtrace)
    dtrace.enable();

  return client;
}



///--- Exports

module.exports = {

  HTTPClient: HTTPClient,
  JSONClient: JSONClient,
  StringClient: StringClient,

  createClient: createClient
};
