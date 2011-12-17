// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var EventEmitter = require('events').EventEmitter;

var log4js = require('../lib/log4js_stub');
var Request = require('../lib/request');
var Response = require('../lib/response');



///--- API

module.exports = {

  getRequest: function getRequest() {
    var stub = new EventEmitter();
    stub.connection = {
      encrypted: true
    };
    stub.headers = {
      'content-type': 'application/xml; charset=en_us'
    };
    stub.httpVersion = '1.1';
    stub.method = 'GET';
    stub.url = '//foo/bar';

    var r = new Request({
      log4js: log4js,
      request: stub
    });
    r.accept = [
      {
        type: 'application',
        subtype: 'json'
      },
      {
        type: 'text',
        subtype: '*',
      },
      {
        type: '*',
        subtype: 'foo',
      }
    ];
    return r;
  },


  getResponse: function getResponse() {
    var stub = new EventEmitter();
    stub.data = [];
    stub.headers = {};
    stub.writeContinue = function() {};
    stub.setHeader = function(k, v) {
      stub.headers[k] = v;
    };
    stub.getHeader = function(k) {
      return stub.headers[k];
    };
    stub.removeHeader = function(k) {
      delete stub.headers[k];
    };
    stub.writeHead = function(status, headers) {
      stub.statusCode = status;
      stub.headers = headers;
    };
    stub.write = function(data) {
      stub.data.push(data);
    };
    stub.addTrailers = function() {};
    stub.end = function(data) {
      if (data)
        stub.data.push(data);
      stub.emit('end', stub.statusCode, stub.headers, stub.data);
    };
    stub.statusCode = 200;
    stub.writeable = true;

    return new Response({
      log4js: log4js,
      request: module.exports.getRequest(),
      response: stub
    });
  }

};
