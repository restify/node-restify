// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.
var http = require('http');
var testCase = require('nodeunit').testCase;
var uuid = require('node-uuid');

var common = require('./lib/common');
var restify = require('../lib/restify');

module.exports = testCase({

  setUp: function(callback) {
    common.setup(this);
    this.options.method = 'POST';
    this.options.path = '/test';
    this.server = restify.createServer({
      apiVersion: '1.2.3',
      serverName: 'RESTify'
    });
    // this.server.logLevel(resty.LogLevel.Debug);

    this.server.post('/:name', function(req, res) {
      var obj = {
        name: req.uriParams.name
      };

      if (req.params.query) obj.query = req.params.query;
      if (req.params.json) obj.json = req.params.json;
      if (req.params.form) obj.form = req.params.form;

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
    this.options.method = 'GET';

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

  basicSuccess: function(test) {
    var self = this;

    test.expect(14);
    http.request(this.options, function(res) {
      common.checkResponse(test, res);
      test.equals(res.statusCode, 200);
      test.done();
    }).end();
  },

  queryParam: function(test) {
    var self = this;
    this.options.appendPath('?query=foo');

    test.expect(23);
    http.request(this.options, function(res) {
      common.checkResponse(test, res);
      test.equals(res.statusCode, 200);
      common.checkContent(test, res, function() {
        test.ok(res.params.query);
        test.equal(res.params.query, 'foo');
        test.done();
      });
    }).end();
  },

  jsonParamNoContentLen: function(test) {
    var self = this;
    this.options.headers['Content-Type'] = 'application/json';

    test.expect(23);
    var req = http.request(this.options, function(res) {
      common.checkResponse(test, res);
      test.equals(res.statusCode, 200);
      common.checkContent(test, res, function() {
        test.ok(res.params.json);
        test.equal(res.params.json, 'bar');
        test.done();
      });
    });

    req.write(JSON.stringify({json: 'bar'}));
    req.end();
  },

  jsonParamContentLen: function(test) {
    var self = this;
    var content = JSON.stringify({json: 'bar'});
    this.options.headers['Content-Type'] = 'application/json';
    this.options.headers['Content-Length'] = content.length;

    test.expect(23);
    var req = http.request(this.options, function(res) {
      common.checkResponse(test, res);
      test.equals(res.statusCode, 200);
      common.checkContent(test, res, function() {
        test.ok(res.params.json);
        test.equal(res.params.json, 'bar');
        test.done();
      });
    });

    req.write(content);
    req.end();
  },

  formParamNoContentLen: function(test) {
    var self = this;
    this.options.headers['Content-Type'] = 'application/x-www-form-urlencoded';

    test.expect(23);
    var req = http.request(this.options, function(res) {
      common.checkResponse(test, res);
      test.equals(res.statusCode, 200);
      common.checkContent(test, res, function() {
        test.ok(res.params.form);
        test.equal(res.params.form, 'bar');
        test.done();
      });
    });

    req.write('form=bar');
    req.end();
  },

  formParamContentLen: function(test) {
    var self = this;
    var content = 'form=bar';
    this.options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    this.options.headers['Content-Length'] = content.length;

    test.expect(23);
    var req = http.request(this.options, function(res) {
      common.checkResponse(test, res);
      test.equals(res.statusCode, 200);
      common.checkContent(test, res, function() {
        test.ok(res.params.form);
        test.equal(res.params.form, 'bar');
        test.done();
      });
    });

    req.write(content);
    req.end();
  },

  mergeParams: function(test) {
    var self = this;
    this.options.appendPath('?query=foo');
    var content = 'form=bar';
    this.options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    this.options.headers['Content-Length'] = content.length;

    test.expect(25);
    var req = http.request(this.options, function(res) {
      common.checkResponse(test, res);
      test.equals(res.statusCode, 200);
      common.checkContent(test, res, function() {
        test.ok(res.params.form);
        test.equal(res.params.form, 'bar');
        test.ok(res.params.query);
        test.equal(res.params.query, 'foo');
        test.done();
      });
    });

    req.write(content);
    req.end();
  }


});
