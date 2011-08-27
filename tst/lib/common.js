// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.
var crypto = require('crypto');
var uuid = require('node-uuid');

module.exports = {

  checkResponse: function(assert, response) {
    assert.ok(response);
    assert.ok(response.headers['access-control-allow-origin']);
    if (response.statusCode !== 400 &&
        response.statusCode !== 404 &&
        response.statusCode !== 406 &&
        !response._skipAllowedMethods) {
      assert.ok(response.headers['access-control-allow-methods']);
    }
    assert.ok(response.headers.server);
    assert.ok(response.headers.connection);
    assert.ok(response.headers.date);
    assert.ok(response.headers['x-request-id']);
    assert.ok(response.headers['x-response-time']);

    assert.equal(response.headers.connection, 'close');

    assert.equal(response.httpVersion, '1.1');
  },

  checkContent: function(assert, response, callback, contentType) {
    assert.ok(response.headers['content-length']);
    assert.ok(response.headers['content-type']);
    assert.ok(response.headers['content-md5']);

    if (!contentType)
      contentType = 'application/json';
    assert.equal(response.headers['content-type'], contentType);
    assert.equal(response.headers.connection, 'close');

    response.setEncoding(encoding = 'utf8');
    response.body = '';
    response.on('data', function(chunk) {
      response.body = response.body + chunk;
    });

    response.on('end', function() {
      assert.equal(Buffer.byteLength(response.body),
                   response.headers['content-length']);

      var hash = crypto.createHash('md5');
      hash.update(response.body);
      assert.equal(hash.digest(encoding = 'base64'),
                 response.headers['content-md5']);

      if (response.body.length > 0) {
        response.params = JSON.parse(response.body);
      }
      callback();
    });
  },


  newOptions: function(socket, path) {
    return {
      socketPath: socket,
      path: path || '/',
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Api-Version': '1.2.3'
      }
    };
  }

};
