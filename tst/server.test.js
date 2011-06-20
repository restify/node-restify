// Copyright 2011 Mark Cavage <mcavage@gmail.com> All rights reserved.
var fs = require('fs');
var http = require('httpu');
var https = require('httpu');
var uuid = require('node-uuid');

var common = require('./lib/common');
var restify = require('../lib/restify');

var newError = restify.newError;
var log = restify.log;
log.level(log.Level.Trace);



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
      res._skipAllowedMethods = true;
      common.checkResponse(assert, res);
      assert.equal(res.statusCode, 400);
      server.on('close', function() {
        test.finish();
      });
      server.close();
    }).end();
  });
};


exports.test_regex_route = function(test, assert) {
  var server = restify.createServer();
  var socket = '/tmp/.' + uuid();

  server.get(/^\/users?(?:\/(\d+)(?:\.\.(\d+))?)?/, _handler);
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/users/1..15');

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


exports.test_create_ssl = function(test, assert) {
  var server = restify.createServer({
    cert: fs.readFileSync(__dirname + '/test_cert.pem', 'ascii'),
    key: fs.readFileSync(__dirname + '/test_key.pem', 'ascii')
  });
  assert.ok(server);
  assert.ok(server.cert);
  assert.ok(server.key);
  server.get('/', function(req, res, next) { res.send(200); return next(); });
  server.listen(socket, function() {
    // Can't actually drive requests over httpu for SSL.
    server.on('close', function() {
      test.finish();
    });
    server.close();
  });
};


exports.test_abort_pre_send = function(test, assert) {
  var server = restify.createServer();
  var socket = '/tmp/.' + uuid();

  server.get('/',
             [function(req, res, next) {
               res.send(200);
               return next();
             }],
             function(req, res, next) {
               assert.ok(false, 'FAIL! main handler invoked');
             },
             [function(req, res, next) {
               server.on('close', function() {
                 test.finish();
               });
               server.close();
             }]);

  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');

    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.statusCode, 200);
    }).end();
  });
};

exports.test_abort_pre_error = function(test, assert) {
  var server = restify.createServer();
  var socket = '/tmp/.' + uuid();

  server.get('/',
             [function(req, res, next) {
               res.sendError(newError());
               return next();
             }],
             function(req, res, next) {
               assert.ok(false, 'FAIL! main handler invoked');
             },
             [function(req, res, next) {
               server.on('close', function() {
                 test.finish();
               });
               server.close();
             }]);

  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');

    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.statusCode, 500);
    }).end();
  });
};


exports.test_abort_main_error = function(test, assert) {
  var server = restify.createServer();
  var socket = '/tmp/.' + uuid();

  server.get('/',
             [function(req, res, next) {
               return next();
             }],
             function(req, res, next) {
               res.sendError(newError());
               return next();
             },
             function(req, res, next) {
               assert.ok(false, 'FAIL! main handler invoked');
             },
             [function(req, res, next) {
               server.on('close', function() {
                 test.finish();
               });
               server.close();
             }]);

  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');

    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.statusCode, 500);
    }).end();
  });
};


exports.test_main_no_abort = function(test, assert) {
  var server = restify.createServer();
  var socket = '/tmp/.' + uuid();

  var called = false;

  server.get('/',
             [function(req, res, next) {
               return next();
             }],
             function(req, res, next) {
               res.send(200);
               return next();
             },
             function(req, res, next) {
               called = true;
               return next();
             },
             [function(req, res, next) {
               server.on('close', function() {
                 test.finish();
               });
               assert.ok(called);
               server.close();
             }]);

  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/');

    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.statusCode, 200);
    }).end();
  });
};


exports.test_gh_27 = function(test, assert) {
  var server = restify.createServer();

  var called = false;
  function before(req, res, next) {
    function anything() {
      return next();
    }

    return anything();
  }

  server.get('/foo', [before], function(req, res, next) {
    called = true;
    res.send(200);
    return next();
  });

  var socket = '/tmp/.' + uuid();
  server.listen(socket, function() {
    var opts = common.newOptions(socket, '/foo');

    http.request(opts, function(res) {
      common.checkResponse(assert, res);
      assert.equal(res.statusCode, 200);
      server.on('close', function() {
        test.finish();
      });
      assert.ok(called);
      server.close();
    }).end();
  });
};
