// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.
var http = require('http');
var testCase = require('nodeunit').testCase;
var uuid = require('node-uuid');

var common = require('./lib/common');
var restify = require('../lib/restify');

module.exports = testCase({

  setUp: function(callback) {
    common.setup(this);
    this.options.headers['X-Api-Version'] = '1.2.3';
    this.server = restify.createServer({
      apiVersion: '1.2.3',
      serverName: 'RESTify',
      requireApiVersion: true
    });
    // this.server.logLevel(restify.LogLevel.Trace);

    this.server.get('/', function(req, res) {
      res.send(200);
    });
    this.server.get('/test/:name', function(req, res) {
      var obj = {
        name: req.params.name
      };

      if (req.params.query) obj.query = req.params.query;

      res.send(200, obj);
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

    test.expect(14);
    http.request(this.options, function(res) {
      common.checkResponse(test, res);
      test.equals(res.statusCode, 404);
      test.done();
    }).end();
  },

  getRootSuccess: function(test) {
    var self = this;

    test.expect(14);
    http.get(this.options, function(res) {
      common.checkResponse(test, res);
      test.equals(res.statusCode, 200);
      test.done();
    }).end();
  },

  getWithUriParam: function(test) {
    var self = this;
    this.options.appendPath('test/foo');

    test.expect(23);
    http.get(this.options, function(res) {
      common.checkResponse(test, res);
      test.equals(res.statusCode, 200);
      common.checkContent(test, res, function() {
        test.ok(res.params.name);
        test.equal(res.params.name, 'foo');
        test.done();
      });
    }).end();
  },

  getWithQueryParam: function(test) {
    var self = this;
    this.options.appendPath('/test/foo?query=bar');

    test.expect(25);
    http.get(this.options, function(res) {
      common.checkResponse(test, res);
      test.equals(res.statusCode, 200);
      common.checkContent(test, res, function() {
        test.ok(res.params.name);
        test.equal(res.params.name, 'foo');
        test.ok(res.params.query);
        test.equal(res.params.query, 'bar');
        test.done();
      });
    }).end();
  }

});
