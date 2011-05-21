// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.
var http = require('httpu');
var uuid = require('node-uuid');

var common = require('./lib/common');
var restify = require('../lib/restify');

restify.log.level(restify.LogLevel.Trace);



// --- Globals

var socket = '/tmp/.' + uuid();


var _handler = function(req, res, next) {
  res.send(200);
  return next();
};



// --- Helpers

function _pad(val) {
  if (parseInt(val, 10) < 10) {
    val = '0' + val;
  }
  return val;
}


function _rfc822(date) {
  var months = ['Jan',
                'Feb',
                'Mar',
                'Apr',
                'May',
                'Jun',
                'Jul',
                'Aug',
                'Sep',
                'Oct',
                'Nov',
                'Dec'];
  var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[date.getUTCDay()] + ', ' +
    _pad(date.getUTCDate()) + ' ' +
    months[date.getUTCMonth()] + ' ' +
    date.getUTCFullYear() + ' ' +
    _pad(date.getUTCHours()) + ':' +
    _pad(date.getUTCMinutes()) + ':' +
    _pad(date.getUTCSeconds()) +
    ' GMT';
}



// --- Tests

exports.test_create_no_options = function(test, assert) {
  var server = restify.createServer();
  var socket = '/tmp/.' + uuid();

  server.get('/', _handler);
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');
    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.headers.server, 'node.js');
      assert.equal(res.statusCode, 200);
      server.on('close', function() {
        test.finish();
      });
      server.close();
    }).end();
  });
};


exports.test_create_empty_options = function(test, assert) {
  var server = restify.createServer({});
  var socket = '/tmp/.' + uuid();

  server.get('/', _handler);
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');
    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.headers.server, 'node.js');
      assert.equal(res.statusCode, 200);
      server.on('close', function() {
        test.finish();
      });
      server.close();
    }).end();
  });
};


exports.test_create_default_error_handler = function(test, assert) {
  var server = restify.createServer();
  var socket = '/tmp/.' + uuid();

  server.get('/', function(req, res, next) { throw new Error('Default me!'); });
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');
    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.headers.server, 'node.js');
      assert.equal(res.statusCode, 500);
      server.on('close', function() {
        test.finish();
      });
      server.close();
    }).end();
  });
};


exports.test_create_user_error_handler = function(test, assert) {
  var server = restify.createServer({
    onError: function(res) {
      assert.ok(res);
      res.send(503);
    }
  });
  var socket = '/tmp/.' + uuid();

  server.get('/', function(req, res, next) { throw new Error('503 me!'); });
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');
    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.headers.server, 'node.js');
      assert.equal(res.statusCode, 503);
      server.on('close', function() {
        test.finish();
      });
      server.close();
    }).end();
  });
};


exports.test_accept_default = function(test, assert) {
  var server = restify.createServer();
  var socket = '/tmp/.' + uuid();

  server.get('/', _handler);
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');
    opts.headers.accept = 'application/json';

    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.headers.server, 'node.js');
      assert.equal(res.statusCode, 200);
      server.on('close', function() {
        test.finish();
      });
      server.close();
    }).end();
  });
};


exports.test_accept_bad = function(test, assert) {
  var server = restify.createServer();
  var socket = '/tmp/.' + uuid();

  server.get('/', _handler);
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');
    opts.headers.accept = 'application/xml';

    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.headers.server, 'node.js');
      assert.equal(res.statusCode, 406);
      server.on('close', function() {
        test.finish();
      });
      server.close();
    }).end();
  });
};


exports.test_accept_partial_wildcard = function(test, assert) {
  var server = restify.createServer();
  var socket = '/tmp/.' + uuid();

  server.get('/', _handler);
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');
    opts.headers.accept = 'application/*';

    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.headers.server, 'node.js');
      assert.equal(res.statusCode, 200);
      server.on('close', function() {
        test.finish();
      });
      server.close();
    }).end();
  });
};


exports.test_accept_double_wildcard = function(test, assert) {
  var server = restify.createServer();
  var socket = '/tmp/.' + uuid();

  server.get('/', _handler);
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');
    opts.headers.accept = '*/*';

    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.headers.server, 'node.js');
      assert.equal(res.statusCode, 200);
      server.on('close', function() {
        test.finish();
      });
      server.close();
    }).end();
  });
};


exports.test_accept_explicit = function(test, assert) {
  var server = restify.createServer({
    accept: ['text/html']
  });
  var socket = '/tmp/.' + uuid();

  server.get('/', _handler);
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');
    opts.headers.accept = 'text/html';

    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.headers.server, 'node.js');
      assert.equal(res.statusCode, 200);
      server.on('close', function() {
        test.finish();
      });
      server.close();
    }).end();
  });
};


exports.test_multiple_accept = function(test, assert) {
  var server = restify.createServer({
    accept: ['text/html', 'text/xml']
  });
  var socket = '/tmp/.' + uuid();

  server.get('/', _handler);
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');
    opts.headers.accept = 'text/xml';

    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.headers.server, 'node.js');
      assert.equal(res.statusCode, 200);
      server.on('close', function() {
        test.finish();
      });
      server.close();
    }).end();
  });
};


exports.test_server_name = function(test, assert) {
  var server = restify.createServer({
    serverName: 'foo'
  });
  var socket = '/tmp/.' + uuid();

  server.get('/', _handler);
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');

    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.headers.server, 'foo');
      assert.equal(res.statusCode, 200);
      server.on('close', function() {
        test.finish();
      });
      server.close();
    }).end();
  });
};


exports.test_max_request_size = function(test, assert) {
  var server = restify.createServer({
    maxRequestSize: 5
  });
  var socket = '/tmp/.' + uuid();

  server.post('/', _handler);
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');
    opts.method = 'POST';

    var req = http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.statusCode, 413);
      server.on('close', function() {
        test.finish();
      });
      server.close();
    });

    req.write(JSON.stringify({ ThisIsALongString: uuid()}, null, 2));
    req.end();
  });
};


exports.test_clock_ok = function(test, assert) {
  var server = restify.createServer();
  var socket = '/tmp/.' + uuid();

  server.get('/', _handler);
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');
    opts.headers.Date = _rfc822(new Date());

    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.statusCode, 200);
      server.on('close', function() {
        test.finish();
      });
      server.close();
    }).end();
  });
};


exports.test_clock_skew = function(test, assert) {
  var server = restify.createServer();
  var socket = '/tmp/.' + uuid();

  server.get('/', _handler);
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');
    opts.headers.Date = _rfc822(new Date(1995, 11, 17, 3, 24, 0));

    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.statusCode, 400);
      server.on('close', function() {
        test.finish();
      });
      server.close();
    }).end();
  });
};
