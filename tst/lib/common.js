// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.
var crypto = require('crypto');
var uuid = require('node-uuid');

module.exports = {
  checkResponse: function(test, response) {
    test.ok(response);
    test.ok(response.headers['access-control-allow-origin']);
    if (response.statusCode !== 404) {
      test.ok(response.headers['access-control-allow-methods']);
    }
    test.ok(response.headers.server);
    test.ok(response.headers.connection);
    test.ok(response.headers.date);
    test.ok(response.headers['x-api-version']);
    test.ok(response.headers['x-request-id']);
    test.ok(response.headers['x-response-time']);

    test.equal(response.headers.server, 'RESTify');
    test.equal(response.headers.connection, 'close');
    test.equal(response.headers['x-api-version'], '1.2.3');

    test.equal(response.httpVersion, '1.1');
  },

  checkContent: function(test, response, callback) {
    test.ok(response.headers['content-length']);
    test.ok(response.headers['content-type']);
    test.ok(response.headers['content-md5']);

    test.equal(response.headers['content-type'], 'application/json');
    test.equal(response.headers.connection, 'close');

    response.setEncoding(encoding = 'utf8');
    response.body = '';
    response.on('data', function(chunk) {
      response.body = response.body + chunk;
    });

    response.on('end', function() {
      test.equal(response.body.length, response.headers['content-length']);

      var hash = crypto.createHash('md5');
      hash.update(response.body);
      test.equal(hash.digest(encoding = 'base64'),
                 response.headers['content-md5']);

      if (response.body.length > 0) {
        response.params = JSON.parse(response.body);
      }
      callback();
    });
  },


  setup: function(_this) {
    _this.options = {
      socketPath: socketPath = '/tmp/.' + uuid(),
      path: '/',
      method: 'GET',
      headers: {
        Accept: 'application/json'
      },

      appendPath: function(path) {
        if (path) {
          _this.options.path = _this.options.path + path;
        }
      }
    };

    _this.options.headers['X-Api-Version'] = '1.2.3';
  }

};
