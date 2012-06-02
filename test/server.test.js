// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var fs = require('fs');
var http = require('http');

var d = require('dtrace-provider');
var filed = require('filed');
var Logger = require('bunyan');
var test = require('tap').test;
var uuid = require('node-uuid');

var HttpError = require('../lib/errors').HttpError;
var RestError = require('../lib/errors').RestError;
var Request = require('../lib/request');
var Response = require('../lib/response');
var Server = require('../lib/server');
var restify = require('../lib');



///--- Globals

var DTRACE = d.createDTraceProvider('restifyUnitTest');
var LOGGER = new Logger({name: 'restify/test/server'});
var PORT = process.env.UNIT_TEST_PORT || 12345;

///--- Tests

test('throws on missing options', function (t) {
  t.throws(function () {
    return new Server();
  }, new TypeError('options (Object) required'));
  t.end();
});


test('throws on missing dtrace', function (t) {
  t.throws(function () {
    return new Server({});
  }, new TypeError('options.dtrace (Object) required'));
  t.end();
});


test('throws on missing bunyan', function (t) {
  t.throws(function () {
    return new Server({ dtrace: {} });
  }, new TypeError('options.log (Object) required'));
  t.end();
});


test('ok', function (t) {
  t.ok(new Server({ dtrace: DTRACE, log: LOGGER }));
  t.end();
});


test('ok (ssl)', function (t) {
  // Lame, just make sure we go down the https path
  try {
    t.ok(new Server({
      dtrace: DTRACE,
      log: LOGGER,
      certificate: 'hello',
      key: 'world'
    }));
    t.fail('HTTPS server not created');
  } catch (e) {
    // noop
  }
  t.end();
});


test('listen and close (port only)', function (t) {
  var server = new Server({ dtrace: DTRACE, log: LOGGER });

  server.on('listening', function () {
    server.close(function () {
      t.end();
    });
  });

  server.listen(PORT);
});


test('listen and close (port only) w/ port number as string', function (t) {
  var server = new Server({ dtrace: DTRACE, log: LOGGER });
  server.listen(String(PORT), function () {
    server.close(function () {
      t.end();
    });
  });
});


test('listen and close (port and hostname)', function (t) {
  var server = new Server({ dtrace: DTRACE, log: LOGGER });
  server.listen(PORT, '127.0.0.1', function () {
    server.close(function () {
      t.end();
    });
  });
});


test('listen and close (socketPath)', function (t) {
  var server = new Server({ dtrace: DTRACE, log: LOGGER });
  server.listen('/tmp/.' + uuid(), function () {
    server.close(function () {
      t.end();
    });
  });
});


test('get (path only)', function (t) {
  var server = restify.createServer({ dtrace: DTRACE, log: LOGGER });
  server.get('/foo/:id', function tester(req, res, next) {
    t.ok(req.params);
    t.equal(req.params.id, 'bar');
    res.send();
    return next();
  });

  var done = 0;
  server.listen(PORT, function () {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/foo/bar',
      agent: false
    };
    http.get(opts, function (res) {
      t.equal(res.statusCode, 200);
      if (++done == 2) {
        server.close(function () {
          t.end();
        });
      }
    });
  });

  server.on('after', function (req, res) {
    t.ok(req);
    t.ok(res);
    if (++done == 2) {
      server.close(function () {
        t.end();
      });
    }
  });
});


test('get (path and version ok)', function (t) {
  var server = restify.createServer({ dtrace: DTRACE, log: LOGGER });
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
  server.listen(PORT, function () {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/foo/bar',
      agent: false,
      headers: {
        'accept-version': '~1.2'
      }
    };
    http.get(opts, function (res) {
      t.equal(res.statusCode, 200);
      if (++done == 2) {
        server.close(function () {
          t.end();
        });
      }
    });
  });

  server.on('after', function (req, res) {
    t.ok(req);
    t.ok(res);
    if (++done == 2) {
      server.close(function () {
        t.end();
      });
    }
  });
});


test('get (path and version not ok)', function (t) {
  var server = restify.createServer({ dtrace: DTRACE, log: LOGGER });
  server.get({
    url: '/foo/:id',
    version: '1.2.3'
  }, function (req, res, next) {
    t.ok(req.params);
    t.equal(req.params.id, 'bar');
    res.send();
    return next();
  });

  server.get({
    url: '/foo/:id',
    version: '1.2.4'
  }, function (req, res, next) {
    t.ok(req.params);
    t.equal(req.params.id, 'bar');
    res.send();
    return next();
  });

  server.listen(PORT, function () {
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
    http.get(opts, function (res) {
      t.equal(res.statusCode, 400);
      res.setEncoding('utf8');
      res.body = '';
      res.on('data', function (chunk) {
        res.body += chunk;
      });
      res.on('end', function () {
        t.equal(res.body, 'GET /foo/bar supports versions: 1.2.3, 1.2.4');
        server.close(function () {
          t.end();
        });
      });
    });
  });
});


test('use + get (path only)', function (t) {
  var server = restify.createServer({ dtrace: DTRACE, log: LOGGER });
  var handler = 0;
  server.use(function (req, res, next) {
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

  server.listen(PORT, function () {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/foo/bar',
      agent: false
    };
    http.get(opts, function (res) {
      t.equal(res.statusCode, 200);
      t.equal(handler, 2);
      server.close(function () {
        t.end();
      });
    });
  });
});


test('rm', function (t) {
  var server = restify.createServer({ dtrace: DTRACE, log: LOGGER });

  server.get('/foo/:id', function (req, res, next) {
    return next();
  });

  server.get('/bar/:id', function (req, res, next) {
    t.ok(req.params);
    t.equal(req.params.id, 'foo');
    res.send();
    return next();
  });

  t.ok(server.rm('GET /foo/:id'));

  server.listen(PORT, function () {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/foo/bar',
      agent: false
    };
    http.get(opts, function (res) {
      t.equal(res.statusCode, 404);
      opts.path = '/bar/foo';
      http.get(opts, function (res2) {
        t.equal(res2.statusCode, 200);
        server.close(function () {
          t.end();
        });
      });
    });
  });
});


test('405', function (t) {
  var server = restify.createServer({ dtrace: DTRACE, log: LOGGER });

  server.post('/foo/:id', function tester(req, res, next) {
    t.ok(req.params);
    t.equal(req.params.id, 'bar');
    res.send();
    return next();
  });

  server.listen(PORT, function () {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/foo/bar',
      agent: false
    };
    http.get(opts, function (res) {
      t.equal(res.statusCode, 405);
      t.equal(res.headers.allow, 'POST');
      server.close(function () {
        t.end();
      });
    });
  });
});


test('PUT ok', function (t) {
  var server = restify.createServer({ dtrace: DTRACE, log: LOGGER });

  server.put('/foo/:id', function tester(req, res, next) {
    t.ok(req.params);
    t.equal(req.params.id, 'bar');
    res.send();
    return next();
  });

  server.listen(PORT, function () {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/foo/bar',
      method: 'PUT',
      agent: false
    };
    http.request(opts, function (res) {
      t.equal(res.statusCode, 200);
      server.close(function () {
        t.end();
      });
    }).end();
  });
});


test('PATCH ok', function (t) {
  var server = restify.createServer({ dtrace: DTRACE, log: LOGGER });

  server.patch('/foo/:id', function tester(req, res, next) {
    t.ok(req.params);
    t.equal(req.params.id, 'bar');
    res.send();
    return next();
  });

  server.listen(PORT, function () {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/foo/bar',
      method: 'PATCH',
      agent: false
    };
    http.request(opts, function (res) {
      t.equal(res.statusCode, 200);
      server.close(function () {
        t.end();
      });
    }).end();
  });
});



test('HEAD ok', function (t) {
  var server = restify.createServer({ dtrace: DTRACE, log: LOGGER });

  server.head('/foo/:id', function tester(req, res, next) {
    t.ok(req.params);
    t.equal(req.params.id, 'bar');
    res.send('hi there');
    return next();
  });

  server.listen(PORT, function () {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/foo/bar',
      method: 'HEAD',
      agent: false
    };
    http.request(opts, function (res) {
      t.equal(res.statusCode, 200);
      res.on('data', function (chunk) {
        t.fail('Data was sent on HEAD');
      });
      server.close(function () {
        t.end();
      });
    }).end();
  });
});


test('DELETE ok', function (t) {
  var server = restify.createServer({ dtrace: DTRACE, log: LOGGER });

  server.del('/foo/:id', function tester(req, res, next) {
    t.ok(req.params);
    t.equal(req.params.id, 'bar');
    res.send(204, 'hi there');
    return next();
  });

  server.listen(PORT, function () {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/foo/bar',
      method: 'DELETE',
      agent: false
    };
    http.request(opts, function (res) {
      t.equal(res.statusCode, 204);
      res.on('data', function (chunk) {
        t.fail('Data was sent on 204');
      });
      server.close(function () {
        t.end();
      });
    }).end();
  });
});


test('OPTIONS', function (t) {
  var server = restify.createServer({ dtrace: DTRACE, log: LOGGER });

  ['get', 'post', 'put', 'del'].forEach(function (method) {
    server[method]('/foo/:id', function tester(req, res, next) {
      t.ok(req.params);
      t.equal(req.params.id, 'bar');
      res.send();
      return next();
    });
  });

  server.listen(PORT, function () {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/foo/bar',
      method: 'OPTIONS',
      agent: false
    };
    http.request(opts, function (res) {
      t.equal(res.statusCode, 200);
      t.ok(res.headers.allow);
      t.equal(res.headers['access-control-allow-methods'],
              'GET, POST, PUT, DELETE');
      server.close(function () {
        t.end();
      });
    }).end();
  });
});


test('RegExp ok', function (t) {
  var server = restify.createServer({ dtrace: DTRACE, log: LOGGER });

  server.get(/\/foo/, function tester(req, res, next) {
    res.send('hi there');
    return next();
  });

  server.listen(PORT, function () {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/foo',
      method: 'GET',
      agent: false
    };
    http.request(opts, function (res) {
      t.equal(res.statusCode, 200);
      server.close(function () {
        t.end();
      });
    }).end();
  });
});


test('path+flags ok', function (t) {
  var server = restify.createServer({ dtrace: DTRACE, log: LOGGER });

  server.get({path: '/foo', flags: 'i'}, function tester(req, res, next) {
    res.send('hi there');
    return next();
  });

  server.listen(PORT, function () {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/FOO',
      method: 'GET',
      agent: false
    };
    http.request(opts, function (res) {
      t.equal(res.statusCode, 200);
      server.close(function () {
        t.end();
      });
    }).end();
  });
});


test('GH-56 streaming with filed (download)', function (t) {
  var server = restify.createServer({ dtrace: DTRACE, log: LOGGER });

  server.get('/foo.txt', function tester(req, res, next) {
    filed(__filename).pipe(res);
  });

  server.listen(PORT, function () {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/foo.txt',
      method: 'GET',
      agent: false
    };
    http.request(opts, function (res) {
      t.equal(res.statusCode, 200);
      var body = '';
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        body += chunk;
      });
      res.on('end', function () {
        t.ok(body.length > 0);
        server.close(function () {
          t.end();
        });
      });
    }).end();
  });

});


test('GH-59 Query params with / result in a 404', function (t) {
  var server = restify.createServer({ dtrace: DTRACE, log: LOGGER });

  server.get('/', function tester(req, res, next) {
    res.send('hello');
    return next();
  });

  server.listen(PORT, function () {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/?foo=bar/foo',
      method: 'GET',
      agent: false,
      headers: {
        accept: 'text/plain'
      }
    };
    http.request(opts, function (res) {
      t.equal(res.statusCode, 200);
      var body = '';
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        body += chunk;
      });
      res.on('end', function () {
        t.equal(body, 'hello');
        server.close(function () {
          t.end();
        });
      });
    }).end();
  });

});


test('GH-63 res.send 204 is sending a body', function (t) {
  var server = restify.createServer({ dtrace: DTRACE, log: LOGGER });

  server.del('/hello/:name', function tester(req, res, next) {
    res.send(204);
    return next();
  });

  server.listen(PORT, function () {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/hello/mark',
      method: 'DELETE',
      agent: false,
      headers: {
        accept: 'text/plain'
      }
    };
    http.request(opts, function (res) {
      t.equal(res.statusCode, 204);
      var body = '';
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        body += chunk;
      });
      res.on('end', function () {
        t.notOk(body);
        server.close(function () {
          t.end();
        });
      });
    }).end();
  });

});


test('GH-64 prerouting chain', function (t) {
  var server = restify.createServer({ dtrace: DTRACE, log: LOGGER });

  server.pre(function (req, res, next) {
    req.headers.accept = 'application/json';
    return next();
  });

  server.get('/hello/:name', function tester(req, res, next) {
    res.send(req.params.name);
    return next();
  });

  server.listen(PORT, function () {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/hello/mark',
      method: 'GET',
      agent: false,
      headers: {
        accept: 'text/plain'
      }
    };
    http.request(opts, function (res) {
      t.equal(res.statusCode, 200);
      var body = '';
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        body += chunk;
      });
      res.on('end', function () {
        t.equal(body, '\"mark\"');
        server.close(function () {
          t.end();
        });
      });
    }).end();
  });

});


test('GH-64 prerouting chain with error', function (t) {
  var server = restify.createServer({ dtrace: DTRACE, log: LOGGER });

  server.pre(function (req, res, next) {
    return next(new RestError(400, 'BadRequest', 'screw you client'));
  });

  server.get('/hello/:name', function tester(req, res, next) {
    res.send(req.params.name);
    return next();
  });

  server.listen(PORT, function () {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/hello/mark',
      method: 'GET',
      agent: false,
      headers: {
        accept: 'text/plain'
      }
    };
    http.request(opts, function (res) {
      t.equal(res.statusCode, 400);
      var body = '';
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        body += chunk;
      });
      res.on('end', function () {
        t.equal(body, 'screw you client');
        server.close(function () {
          t.end();
        });
      });
    }).end();
  });

});


test('GH-67 extend access-control headers', function (t) {
  var server = restify.createServer({ dtrace: DTRACE, log: LOGGER });

  server.get('/hello/:name', function tester(req, res, next) {
    res.header('Access-Control-Allow-Headers',
               (res.header('Access-Control-Allow-Headers') +
                ', If-Match, If-None-Match'));

    res.send(req.params.name);
    return next();
  });

  server.listen(PORT, function () {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/hello/mark',
      method: 'GET',
      agent: false,
      headers: {
        accept: 'text/plain'
      }
    };
    http.request(opts, function (res) {
      t.equal(res.statusCode, 200);
      var body = '';
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        body += chunk;
      });
      res.on('end', function () {
        t.equal(body, 'mark');
        server.close(function () {
          t.ok(res.headers['access-control-allow-headers'].indexOf('If-Match'));
          t.end();
        });
      });
    }).end();
  });

});


test('GH-77 uncaughtException (default behavior)', function (t) {
  var server = restify.createServer({ dtrace: DTRACE, log: LOGGER });

  server.get('/', function (req, res, next) {
    throw new Error('Catch me!');
  });

  server.listen(PORT, function () {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/',
      method: 'GET',
      agent: false,
      headers: {
        accept: 'text/plain'
      }
    };
    http.request(opts, function (res) {
      t.equal(res.statusCode, 500);
      var body = '';
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        body += chunk;
      });
      res.on('end', function () {
        t.equal(body, 'Catch me!');
        server.close(function () {
          t.end();
        });
      });
    }).end();
  });
});


test('GH-77 uncaughtException (with custom handler)', function (t) {
  var server = restify.createServer({ dtrace: DTRACE, log: LOGGER });
  server.on('uncaughtException', function (req, res, route, err) {
    res.send(204);
  });
  server.get('/', function (req, res, next) {
    throw new Error('Catch me!');
  });

  server.listen(PORT, function () {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/',
      method: 'GET',
      agent: false,
      headers: {
        accept: 'text/plain'
      }
    };
    http.request(opts, function (res) {
      t.equal(res.statusCode, 204);
      var body = '';
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        body += chunk;
      });
      res.on('end', function () {
        t.equal(body, '');
        server.close(function () {
          t.end();
        });
      });
    }).end();
  });
});


test('GH-77 uncaughtException (with custom handler)', function (t) {
  var server = restify.createServer({ dtrace: DTRACE, log: LOGGER });
  server.on('uncaughtException', function (req, res, route, err) {
    res.send(204);
  });
  server.get('/', function (req, res, next) {
    throw new Error('Catch me!');
  });

  server.listen(PORT, function () {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/',
      method: 'GET',
      agent: false,
      headers: {
        accept: 'text/plain'
      }
    };
    http.request(opts, function (res) {
      t.equal(res.statusCode, 204);
      var body = '';
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        body += chunk;
      });
      res.on('end', function () {
        t.equal(body, '');
        server.close(function () {
          t.end();
        });
      });
    }).end();
  });
});


test('GH-97 malformed URI breaks server', function (t) {
  var server = restify.createServer({ dtrace: DTRACE, log: LOGGER });
  server.get('/echo/:name', function (req, res, next) {
    res.send(200);
    return next();
  });

  server.listen(PORT, function () {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/echo/mark%',
      method: 'GET',
      agent: false,
      headers: {
        accept: 'text/plain'
      }
    };
    http.request(opts, function (res) {
      t.equal(res.statusCode, 400);
      var body = '';
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        body += chunk;
      });
      res.on('end', function () {
        t.ok(body);
        server.close(function () {
          t.end();
        });
      });
    }).end();
  });
});


test('GH-109 RegExp flags not honored', function (t) {
  var server = restify.createServer({ dtrace: DTRACE, log: LOGGER });
  server.get(/\/echo\/(\w+)/i, function (req, res, next) {
    res.send(200, req.params[0]);
    return next();
  });

  server.listen(PORT, function () {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/ECHO/mark',
      method: 'GET',
      agent: false,
      headers: {
        accept: 'text/plain'
      }
    };
    http.request(opts, function (res) {
      t.equal(res.statusCode, 200);
      var body = '';
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        body += chunk;
      });
      res.on('end', function () {
        t.equal(body, 'mark');
        server.close(function () {
          t.end();
        });
      });
    }).end();
  });
});


test('GH-141 return next(err) not working', function (t) {
  var server = restify.createServer({ dtrace: DTRACE, log: LOGGER });
  server.use(restify.authorizationParser());
  server.use(function authenticate(req, res, next) {
    if (req.username !== 'admin' ||
        !req.authorization.basic ||
        req.authorization.basic.password !== 'admin') {
      return next(new restify.NotAuthorizedError('invalid credentials'));
    }
    return next();
  });

  server.get('/', function (req, res, next) {
    res.send(200, req.username);
    return next();
  });

  server.listen(PORT, function () {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/',
      method: 'GET',
      agent: false,
      headers: {
        accept: 'text/plain',
        authorization: 'Basic ' + new Buffer('admin:foo').toString('base64')
      }
    };
    http.request(opts, function (res) {
      t.equal(res.statusCode, 403);
      var body = '';
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        body += chunk;
      });
      res.on('end', function () {
        t.equal(body, 'invalid credentials');
        server.close(function () {
          t.end();
        });
      });
    }).end();
  });
});


//
// Disabled, as Heroku (travis) doesn't allow us to write to /tmp
//
// test('GH-56 streaming with filed (upload)', function (t) {
//   var server = restify.createServer({ dtrace: DTRACE, log: LOGGER });
//   var file = '/tmp/.' + uuid();
//   server.put('/foo', function tester(req, res, next) {
//     req.pipe(filed(file)).pipe(res);
//   });

//   server.listen(PORT, function () {
//     var opts = {
//       hostname: 'localhost',
//       port: PORT,
//       path: '/foo',
//       method: 'PUT',
//       agent: false
//     };

//     var req = http.request(opts, function (res) {
//       t.equal(res.statusCode, 201);
//       res.on('end', function () {
//         fs.readFile(file, 'utf8', function (err, data) {
//           t.ifError(err);
//           t.equal(data, 'hello world');
//           server.close(function () {
//             fs.unlink(file, function () {
//               t.end();
//             });
//           });
//         });
//       });
//     });

//     req.write('hello world');
//     req.end();
//   });

// });
//


test('GH-149 limit request body size (form)', function (t) {
  var server = restify.createServer();
  server.use(restify.bodyParser({maxBodySize: 1024}));

  server.post('/', function (req, res, next) {
    res.send(200, {length: req.body.length});
    return next();
  });

  server.listen(PORT, function () {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/',
      method: 'POST',
      agent: false,
      headers: {
        'accept': 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
        'transfer-encoding': 'chunked'
      }
    };
    var req = http.request(opts, function (res) {
      t.equal(res.statusCode, 413);
      res.on('end', function () {
        server.close(function () {
          t.end();
        });
      });
    });
    req.write(new Array(1026).join('x'));
    req.end();
  });
});


test('GH-149 limit request body size (json)', function (t) {
  var server = restify.createServer();
  server.use(restify.bodyParser({maxBodySize: 1024}));

  server.post('/', function (req, res, next) {
    res.send(200, {length: req.body.length});
    return next();
  });

  server.listen(PORT, function () {
    var opts = {
      hostname: 'localhost',
      port: PORT,
      path: '/',
      method: 'POST',
      agent: false,
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'transfer-encoding': 'chunked'
      }
    };
    var req = http.request(opts, function (res) {
      t.equal(res.statusCode, 413);
      res.on('end', function () {
        server.close(function () {
          t.end();
        });
      });
    });
    req.write('{"a":[' + new Array(512).join('1,') + '0]}');
    req.end();
  });
});
