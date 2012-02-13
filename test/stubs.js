// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var EventEmitter = require('events').EventEmitter;
var Logger = require('bunyan');

var Request = require('../lib/request');
var Response = require('../lib/response');
var restify = require('../lib');


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
    stub.path = '/foo/bar';
    stub.url = '//foo/bar';

    var r = new Request({
      log: new Logger({name: 'restify/test'}),
      request: stub
    });
    r.accept = [
      {
        type: 'application',
        subtype: 'json'
      },
      {
        type: 'text',
        subtype: '*'
      },
      {
        type: '*',
        subtype: 'foo'
      }
    ];
    return r;
  },


  getResponse: function getResponse() {
    var stub = new EventEmitter();
    stub.data = [];
    stub._headers = {};
    stub.writeContinue = function () {};
    stub.setHeader = function (k, v) {
      stub._headers[k] = v;
    };
    stub.getHeader = function (k) {
      return stub._headers[k];
    };
    stub.removeHeader = function (k) {
      delete stub._headers[k];
    };
    stub.writeHead = function (status, headers) {
      if (status)
        stub.statusCode = status;
      if (headers)
        stub._headers = headers;
    };
    stub.write = function (data) {
      stub.data.push(data);
    };
    stub.addTrailers = function () {};
    stub.end = function (data) {
      if (data)
        stub.data.push(data);
      stub.emit('end', stub.statusCode, stub._headers, stub.data);
    };
    stub.statusCode = 200;
    stub.writeable = true;

    return new Response({
      log: new Logger({
        name: 'restify/test/response/stub',
        serializers: Logger.stdSerializers
      }),
      request: module.exports.getRequest(),
      response: stub
    });
  }

};
