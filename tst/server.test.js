// Copyright 2011 Mark Cavage, Inc.  All rights reserved.

var fs = require('fs');
var http = require('http');

var d = require('dtrace-provider');
var filed = require('filed');
var test = require('tap').test;
var uuid = require('node-uuid');

var HttpError = require('../lib/errors').HttpError;
var RestError = require('../lib/errors').RestError;
var log4js = require('../lib/log4js_stub');
var Request = require('../lib/request');
var Response = require('../lib/response');
var Server = require('../lib/server');



///--- Globals

var DTRACE = d.createDTraceProvider('restifyUnitTest');
var PORT = process.env.UNIT_TEST_PORT || 12345;



///--- Tests

test('throws on missing options', function(t) {
  t.throws(function() {
    return new Server();
  }, new TypeError('options (Object) required'));
  t.end();
});


test('throws on missing dtrace', function(t) {
  t.throws(function() {
    return new Server({});
  }, new TypeError('options.dtrace (Object) required'));
  t.end();
});


test('throws on missing log4js', function(t) {
  t.throws(function() {
    return new Server({ dtrace: {} });
  }, new TypeError('options.log4js (Object) required'));
  t.end();
});


test('ok', function(t) {
  t.ok(new Server({ dtrace: DTRACE, log4js: log4js }));
  t.end();
});


test('ok (ssl)', function(t) {
  // Lame, just make sure we go down the https path
  try {
    t.ok(new Server({
      dtrace: DTRACE,
      log4js: log4js,
      certificate: 'hello',
      key: 'world'
    }));
    t.fail('HTTPS server not created');
  } catch (e) {
    // noop
  }
  t.end();
});


test('listen and close (port only)', function(t) {
  var server = new Server({ dtrace: DTRACE, log4js: log4js });
  server.listen(PORT, function() {
    server.close(function() {
      t.end();
    });
  });
});


test('listen and close (port and hostname)', function(t) {
  var server = new Server({ dtrace: DTRACE, log4js: log4js });
  server.listen(PORT, '127.0.0.1', function() {
    server.close(function() {
      t.end();
    });
  });
});


test('listen and close (socketPath)', function(t) {
  var server = new Server({ dtrace: DTRACE, log4js: log4js });
  server.listen('/tmp/.' + uuid(), function() {
    server.close(function() {
      t.end();
    });
  });
});


test('get (path only)', function(t) {
  var server = new Server({ dtrace: DTRACE, log4js: log4js });
  server.get('/foo/:id', function tester(req, res, next) {
    t.ok(req.params);
    t.equal(req.params.id, 'bar');
    res.send();
    return next();
  });

  var done = 0;
  server.listen(PORT, function() {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/foo/bar',
      agent: false
    };
    http.get(opts, function(res) {
      t.equal(res.statusCode, 200);
      if (++done == 2) {
        server.close(function() {
          t.end();
        });
      }
    });
  });

  server.on('after', function(req, res) {
    t.ok(req);
    t.ok(res);
    if (++done == 2) {
      server.close(function() {
        t.end();
      });
    }
  });
});


test('get (path and version ok)', function(t) {
  var server = new Server({ dtrace: DTRACE, log4js: log4js });
  server.get({
    url: '/foo/:id',
    version: '1.2.3'
  }, function tester(req, res, next) {
    t.ok(req.params);
    t.equal(req.params.id, 'bar');
    res.send();
    return next();
  });

  var done = 0;
  server.listen(PORT, function() {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/foo/bar',
      agent: false,
      headers: {
        'accept-version': '~1.2'
      }
    };
    http.get(opts, function(res) {
      t.equal(res.statusCode, 200);
      if (++done == 2) {
        server.close(function() {
          t.end();
        });
      }
    });
  });

  server.on('after', function(req, res) {
    t.ok(req);
    t.ok(res);
    if (++done == 2) {
      server.close(function() {
        t.end();
      });
    }
  });
});


test('get (path and version not ok)', function(t) {
  var server = new Server({ dtrace: DTRACE, log4js: log4js });
  server.get({
    url: '/foo/:id',
    version: '1.2.3'
  }, function(req, res, next) {
    t.ok(req.params);
    t.equal(req.params.id, 'bar');
    res.send();
    return next();
  });

  server.get({
    url: '/foo/:id',
    version: '1.2.4'
  }, function(req, res, next) {
    t.ok(req.params);
    t.equal(req.params.id, 'bar');
    res.send();
    return next();
  });

  server.listen(PORT, function() {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/foo/bar',
      agent: false,
      headers: {
        'accept': 'text/plain',
        'accept-version': '~2.1'
      }
    };
    http.get(opts, function(res) {
      t.equal(res.statusCode, 400);
      res.setEncoding('utf8');
      res.body = '';
      res.on('data', function(chunk) {
        res.body += chunk;
      });
      res.on('end', function() {
        t.equal(res.body, 'GET /foo/bar supports versions: 1.2.3, 1.2.4');
        server.close(function() {
          t.end();
        });
      });
    });
  });
});


test('use + get (path only)', function(t) {
  var server = new Server({ dtrace: DTRACE, log4js: log4js });
  var handler = 0;
  server.use(function(req, res, next) {
    handler++;
    return next();
  });
  server.get('/foo/:id', function tester(req, res, next) {
    t.ok(req.params);
    t.equal(req.params.id, 'bar');
    handler++;
    res.send();
    return next();
  });

  server.listen(PORT, function() {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/foo/bar',
      agent: false
    };
    http.get(opts, function(res) {
      t.equal(res.statusCode, 200);
      t.equal(handler, 2);
      server.close(function() {
        t.end();
      });
    });
  });
});


test('rm', function(t) {
  var server = new Server({ dtrace: DTRACE, log4js: log4js });

  server.get('/foo/:id', function(req, res, next) {
    return next();
  });

  server.get('/bar/:id', function(req, res, next) {
    t.ok(req.params);
    t.equal(req.params.id, 'foo');
    res.send();
    return next();
  });

  t.ok(server.rm('GET /foo/:id'));

  server.listen(PORT, function() {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/foo/bar',
      agent: false
    };
    http.get(opts, function(res) {
      t.equal(res.statusCode, 404);
      opts.path = '/bar/foo';
      http.get(opts, function(res2) {
        t.equal(res2.statusCode, 200);
        server.close(function() {
          t.end();
        });
      });
    });
  });
});


test('405', function(t) {
  var server = new Server({ dtrace: DTRACE, log4js: log4js });

  server.post('/foo/:id', function tester(req, res, next) {
    t.ok(req.params);
    t.equal(req.params.id, 'bar');
    res.send();
    return next();
  });

  server.listen(PORT, function() {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/foo/bar',
      agent: false
    };
    http.get(opts, function(res) {
      t.equal(res.statusCode, 405);
      t.equal(res.headers.allow, 'POST');
      server.close(function() {
        t.end();
      });
    });
  });
});


test('PUT ok', function(t) {
  var server = new Server({ dtrace: DTRACE, log4js: log4js });

  server.put('/foo/:id', function tester(req, res, next) {
    t.ok(req.params);
    t.equal(req.params.id, 'bar');
    res.send();
    return next();
  });

  server.listen(PORT, function() {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/foo/bar',
      method: 'PUT',
      agent: false
    };
    http.request(opts, function(res) {
      t.equal(res.statusCode, 200);
      server.close(function() {
        t.end();
      });
    }).end();
  });
});


test('HEAD ok', function(t) {
  var server = new Server({ dtrace: DTRACE, log4js: log4js });

  server.head('/foo/:id', function tester(req, res, next) {
    t.ok(req.params);
    t.equal(req.params.id, 'bar');
    res.send('hi there');
    return next();
  });

  server.listen(PORT, function() {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/foo/bar',
      method: 'HEAD',
      agent: false
    };
    http.request(opts, function(res) {
      t.equal(res.statusCode, 200);
      res.on('data', function(chunk) {
        t.fail('Data was sent on HEAD');
      });
      server.close(function() {
        t.end();
      });
    }).end();
  });
});


test('DELETE ok', function(t) {
  var server = new Server({ dtrace: DTRACE, log4js: log4js });

  server.del('/foo/:id', function tester(req, res, next) {
    t.ok(req.params);
    t.equal(req.params.id, 'bar');
    res.send(204, 'hi there');
    return next();
  });

  server.listen(PORT, function() {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/foo/bar',
      method: 'DELETE',
      agent: false
    };
    http.request(opts, function(res) {
      t.equal(res.statusCode, 204);
      res.on('data', function(chunk) {
        t.fail('Data was sent on 204');
      });
      server.close(function() {
        t.end();
      });
    }).end();
  });
});


test('OPTIONS', function(t) {
  var server = new Server({ dtrace: DTRACE, log4js: log4js });

  server.get('/foo/:id', function tester(req, res, next) {
    t.ok(req.params);
    t.equal(req.params.id, 'bar');
    res.send();
    return next();
  });

  server.listen(PORT, function() {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/foo/bar',
      method: 'OPTIONS',
      agent: false
    };
    http.request(opts, function(res) {
      t.equal(res.statusCode, 200);
      t.ok(res.headers.allow);
      server.close(function() {
        t.end();
      });
    }).end();
  });
});


test('GH-56 streaming with filed (download)', function(t) {
  var server = new Server({ dtrace: DTRACE, log4js: log4js });

  server.get('/foo.txt', function tester(req, res, next) {
    filed(__filename).pipe(res);
  });

  server.listen(PORT, function() {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/foo.txt',
      method: 'GET',
      agent: false
    };
    http.request(opts, function(res) {
      t.equal(res.statusCode, 200);
      var body = '';
      res.setEncoding('utf8');
      res.on('data', function(chunk) {
        body += chunk;
      });
      res.on('end', function() {
        t.ok(body.length > 0);
        server.close(function() {
          t.end();
        });
      });
    }).end();
  });

});

/*
 * Disabled, as Heroku (travis) doesn't allow us to write to /tmp
 *
test('GH-56 streaming with filed (upload)', function(t) {
  var server = new Server({ dtrace: DTRACE, log4js: log4js });
  var file = '/tmp/.' + uuid();
  server.put('/foo', function tester(req, res, next) {
    req.pipe(filed(file)).pipe(res);
  });

  server.listen(PORT, function() {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/foo',
      method: 'PUT',
      agent: false
    };

    var req = http.request(opts, function(res) {
      t.equal(res.statusCode, 201);
      res.on('end', function() {
        fs.readFile(file, 'utf8', function(err, data) {
          t.ifError(err);
          t.equal(data, 'hello world');
          server.close(function() {
            fs.unlink(file, function() {
              t.end();
            });
          });
        });
      });
    });

    req.write('hello world');
    req.end();
  });

});
*/
