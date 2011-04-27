// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.
var http = require('http');
var testCase = require('nodeunit').testCase;
var uuid = require('node-uuid');

var common = require('./lib/common');
var restify = require('../lib/restify');

module.exports = testCase({

  setUp: function(callback) {
    common.setup(this);
    this.options.method = 'PUT';
    this.options.path = '/test/unit';
    this.server = restify.createServer({
      apiVersion: '1.2.3',
      serverName: 'RESTify'
    });

    this.server.put('/test/:name', function(req, res) {
      res.send(204);
    });

    this.server.listen(this.options.socketPath, function() {
      callback();
    });
  },

  tearDown: function(callback) {
    this.server.on('close', function() {
      callback();
    });
    this.server.close();
  },

  invalidMethod: function(test) {
    var self = this;
    this.options.method = 'POST';

    test.expect(14);
    http.request(self.options, function(res) {
      common.checkResponse(test, res);
      test.equals(res.statusCode, 405);
      test.done();
    }).end();
  },

  invalidPath: function(test) {
    var self = this;
    this.options.appendPath('/' + uuid());

    test.expect(13);
    http.request(this.options, function(res) {
      common.checkResponse(test, res);
      test.equals(res.statusCode, 404);
      test.done();
    }).end();
  },

  basicSuccess: function(test) {
    var self = this;

    test.expect(14);
    http.request(this.options, function(res) {
      common.checkResponse(test, res);
      test.equals(res.statusCode, 204);
      test.done();
    }).end();
  }

});
