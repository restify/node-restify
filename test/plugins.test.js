// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var http = require('http');

var d = require('dtrace-provider');
var Logger = require('bunyan');
var test = require('tap').test;
var uuid = require('node-uuid');

var HttpError = require('../lib/errors').HttpError;
var RestError = require('../lib/errors').RestError;
var plugins = require('../lib/plugins');
var Request = require('../lib/request');
var Response = require('../lib/response');
var restify = require('../lib');



///--- Globals

var DTRACE = d.createDTraceProvider('restifyUnitTest');
var PORT = process.env.UNIT_TEST_PORT || 12345;
var SERVER;



///--- Helpers

function request(path, headers, callback) {
  if (typeof (path) === 'function') {
    callback = path;
    path = headers = false;
  }
  if (typeof (headers) === 'function') {
    callback = headers;
    headers = false;
  }

  var opts = {
    hostname: '127.0.0.1',
    port: PORT,
    path: path || '/foo/bar',
    agent: false,
    method: 'GET',
    headers: headers || {}
  };

  return http.request(opts, callback);
}




///--- Tests

test('setup', function (t) {
  SERVER = restify.createServer({
    dtrace: DTRACE,
    log: new Logger({name: 'restify/test/plugins'})
  });

  SERVER.use(plugins.acceptParser(SERVER.acceptable));
  SERVER.use(plugins.authorizationParser());
  SERVER.use(plugins.dateParser());
  SERVER.use(plugins.queryParser());


  SERVER.get('/foo/:id', function (req, res, next) {
    res.send();
    return next();
  });

  SERVER.listen(PORT, '127.0.0.1', function () {
    t.end();
  });
});


test('accept ok', function (t) {
  request(function (res) {
    t.equal(res.statusCode, 200);
    t.end();
  }).end();
});


test('406', function (t) {
  request('/foo/bar', { accept: 'foo/bar' }, function (res) {
    t.equal(res.statusCode, 406);
    t.end();
  }).end();
});

test('authorization basic ok', function (t) {
  var authz = 'Basic ' + new Buffer('user:secret').toString('base64');
  request('/foo/bar', { authorization: authz }, function (res) {
    t.equal(res.statusCode, 200);
    t.end();
  }).end();
});


test('authorization basic invalid', function (t) {
  var authz = 'Basic ';
  request('/foo/bar', { authorization: authz }, function (res) {
    t.equal(res.statusCode, 400);
    t.end();
  }).end();
});


test('query ok', function (t) {
  SERVER.get('/query/:id', function (req, res, next) {
    t.equal(req.params.id, 'foo');
    t.equal(req.params.name, 'markc');
    t.equal(req.params.name, 'markc');
    res.send();
    return next();
  });

  request('/query/foo?id=bar&name=markc', function (res) {
    t.equal(res.statusCode, 200);
    t.end();
  }).end();
});


test('GH-124 query ok no query string', function (t) {
  SERVER.get('/query/:id', function (req, res, next) {
    t.ok(req.query);
    t.equal(typeof (req.query), 'object');
    res.send();
    return next();
  });

  request('/query/foo', function (res) {
    t.equal(res.statusCode, 200);
    t.end();
  }).end();
});


test('query object', function (t) {
  SERVER.get('/query/:id', function (req, res, next) {
    t.equal(req.params.id, 'foo');
    t.ok(req.params.name);
    t.equal(req.params.name.first, 'mark');
    t.equal(req.query.name.last, 'cavage');
    res.send();
    return next();
  });

  request('/query/foo?name[first]=mark&name[last]=cavage', function (res) {
    t.equal(res.statusCode, 200);
    t.end();
  }).end();
});


test('body url-encoded ok', function (t) {
  SERVER.post('/bodyurl/:id', plugins.bodyParser(), function (req, res, next) {
    t.equal(req.params.id, 'foo');
    t.equal(req.params.name, 'markc');
    t.equal(req.params.phone, '(206) 555-1212');
    res.send();
    return next();
  });

  var opts = {
    hostname: '127.0.0.1',
    port: PORT,
    path: '/bodyurl/foo?name=markc',
    agent: false,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  };
  var client = http.request(opts, function (res) {
    t.equal(res.statusCode, 200);
    t.end();
  });
  client.write('phone=(206)%20555-1212&name=somethingelse');
  client.end();
});


test('body url-encoded ok (no params)', function (t) {
  SERVER.post('/bodyurl2/:id',
              plugins.bodyParser({ mapParams: false }),
              function (req, res, next) {
                t.equal(req.params.id, 'foo');
                t.equal(req.params.name, 'markc');
                t.notOk(req.params.phone);
                t.equal(req.body.phone, '(206) 555-1212');
                res.send();
                return next();
              });

  var opts = {
    hostname: '127.0.0.1',
    port: PORT,
    path: '/bodyurl2/foo?name=markc',
    agent: false,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  };
  var client = http.request(opts, function (res) {
    t.equal(res.statusCode, 200);
    t.end();
  });
  client.write('phone=(206)%20555-1212&name=somethingelse');
  client.end();
});


test('body json ok', function (t) {
  SERVER.post('/bodyjson/:id',
              plugins.bodyParser(),
              function (req, res, next) {
    t.equal(req.params.id, 'foo');
    t.equal(req.params.name, 'markc');
    t.equal(req.params.phone, '(206) 555-1212');
    res.send();
    return next();
  });

  var opts = {
    hostname: '127.0.0.1',
    port: PORT,
    path: '/bodyjson/foo?name=markc',
    agent: false,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  var client = http.request(opts, function (res) {
    t.equal(res.statusCode, 200);
    t.end();
  });
  client.write(JSON.stringify({
    phone: '(206) 555-1212',
    name: 'somethingelse'
  }));
  client.end();
});


test('body json ok (no params)', function (t) {
  SERVER.post('/bodyjson2/:id',
              plugins.bodyParser({ mapParams: false }),
              function (req, res, next) {
                t.equal(req.params.id, 'foo');
                t.equal(req.params.name, 'markc');
                t.notOk(req.params.phone);
                t.equal(req.body.phone, '(206) 555-1212');
                res.send();
                return next();
              });

  var opts = {
    hostname: '127.0.0.1',
    port: PORT,
    path: '/bodyjson2/foo?name=markc',
    agent: false,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  var client = http.request(opts, function (res) {
    t.equal(res.statusCode, 200);
    t.end();
  });
  client.write(JSON.stringify({
    phone: '(206) 555-1212',
    name: 'somethingelse'
  }));
  client.end();
});



test('GH-111 JSON Parser not right for arrays', function (t) {
  SERVER.post('/gh111',
              plugins.bodyParser(),
              function (req, res, next) {
                t.ok(Array.isArray(req.params));
                t.equal(req.params[0], 'foo');
                t.equal(req.params[1], 'bar');
                res.send();
                return next();
              });

  var opts = {
    hostname: '127.0.0.1',
    port: PORT,
    path: '/gh111',
    agent: false,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  var client = http.request(opts, function (res) {
    t.equal(res.statusCode, 200);
    t.end();
  });
  client.write(JSON.stringify(['foo', 'bar']));
  client.end();
});


test('date expired', function (t) {
  var _ = { date: 'Tue, 15 Nov 1994 08:12:31 GMT' };
  request('/foo/bar', _, function (res) {
    t.equal(res.statusCode, 400);
    res.setEncoding('utf8');
    res.body = '';
    res.on('data', function (chunk) {
      res.body += chunk;
    });
    res.on('end', function () {
      t.equal(JSON.parse(res.body).message, 'Date header is too old');
      t.end();
    });
  }).end();
});


test('Conditional Request with correct Etag and headers', function (t) {
  SERVER.get('/bodyurl3/:id',
             function (req, res, next) {
               res.etag = 'testETag';
               next();
             },
             plugins.conditionalRequest(),
             function (req, res, next) {
               res.body = 'testing 304';
               res.send();
               return next();
             });

  var opts = {
    hostname: '127.0.0.1',
    port: PORT,
    path: '/bodyurl3/foo',
    agent: false,
    method: 'GET',
    headers: {
      'If-Match': 'testETag',
      'If-None-Match': 'testETag'
    }
  };
  var client = http.request(opts, function (res) {
    t.equal(res.statusCode, 304);
    t.end();
  });
  client.end();
});

test('Conditional Request with mismatched Etag and If-Match', function (t) {
  SERVER.get('/bodyurl4/:id',
             function (req, res, next) {
               res.etag = 'testETag';
               next();
             },
             plugins.conditionalRequest(),
             function (req, res, next) {
               res.body = 'testing 304';
               res.send();
               return next();
             });

  var opts = {
    hostname: '127.0.0.1',
    port: PORT,
    path: '/bodyurl4/foo',
    agent: false,
    method: 'GET',
    headers: {
      'If-Match': 'testETag2'
    }
  };
  var client = http.request(opts, function (res) {
    t.equal(res.statusCode, 412);
    t.end();
  });
  client.end();
});

test('cdntl req  If-Modified header & !modified content', function (t) {
  var now = new Date();
  SERVER.get('/bodyurl5/:id',
             function (req, res, next) {
               var yesterday = new Date(now.setDate(now.getDate()-1));
               res.header('Last-Modified', yesterday);
               next();
             },
             plugins.conditionalRequest(),
             function (req, res, next) {
               res.body = 'testing 304';
               res.send();
               return next();
             });

  var opts = {
    hostname: '127.0.0.1',
    port: PORT,
    path: '/bodyurl5/foo',
    agent: false,
    method: 'GET',
    headers: {
      'If-Modified-Since': new Date()
    }
  };
  var client = http.request(opts, function (res) {
    t.equal(res.statusCode, 304);
    t.end();
  });
  client.end();
});


test('cdtl req  If-Unmodified-Since header,modified content', function (t) {
  var now = new Date();
  var yesterday = new Date(now.setDate(now.getDate()-1));
  SERVER.get('/bodyurl6/:id',
             function (req, res, next) {
               res.header('Last-Modified', new Date());
               next();
             },
             plugins.conditionalRequest(),
             function (req, res, next) {
               res.body = 'testing 412';
               res.send();
               return next();
             });

  var opts = {
    hostname: '127.0.0.1',
    port: PORT,
    path: '/bodyurl6/foo',
    agent: false,
    method: 'GET',
    headers: {
      'If-Unmodified-Since': yesterday
    }
  };
  var client = http.request(opts, function (res) {
    t.equal(res.statusCode, 412);
    t.end();
  });
  client.end();
});

test('cdtl req valid headers, ahead Timezone, unmodified OK', function (t) {
  SERVER.get('/bodyurl7/:id',
             function (req, res, next) {
               res.header('Last-Modified', new Date());
               next();
             },
             plugins.conditionalRequest(),
             function (req, res, next) {
               res.body = 'testing 412';
               res.send();
               return next();
             });

  var now = new Date();
  var ahead = new Date(now.setHours(now.getHours()+5));

  var opts = {
    hostname: '127.0.0.1',
    port: PORT,
    path: '/bodyurl7/foo',
    agent: false,
    method: 'GET',
    headers: {
      'If-Modified-Since': ahead
    }
  };
  var client = http.request(opts, function (res) {
    t.equal(res.statusCode, 200);
    t.end();
  });
  client.end();
});

test('cdtl req valid headers, ahead Timezone, modified content', function (t) {
  SERVER.get('/bodyurl8/:id',
             function (req, res, next) {
               res.header('Last-Modified', new Date());
               next();
             },
             plugins.conditionalRequest(),
             function (req, res, next) {
               res.body = 'testing 412';
               res.send();
               return next();
             });

  var now = new Date();
  var ahead = new Date(now.setHours(now.getHours()+5));

  var opts = {
    hostname: '127.0.0.1',
    port: PORT,
    path: '/bodyurl8/foo',
    agent: false,
    method: 'GET',
    headers: {
      'If-Unmodified-Since': ahead
    }
  };
  var client = http.request(opts, function (res) {
    t.equal(res.statusCode, 200);
    t.end();
  });
  client.end();
});

test('Conditional PUT with matched Etag and headers', function (t) {
  SERVER.put('/bodyurl9/:id',
             function (req, res, next) {
               res.etag = 'testETag';
               next();
             },
             plugins.conditionalRequest(),
             function (req, res, next) {
               res.body = 'testing 304';
               res.send();
               return next();
             });

  var opts = {
    hostname: '127.0.0.1',
    port: PORT,
    path: '/bodyurl9/foo',
    agent: false,
    method: 'PUT',
    headers: {
      'If-Match': 'testETag',
      'If-None-Match': 'testETag'
    }
  };
  var client = http.request(opts, function (res) {
    t.equal(res.statusCode, 412);
    t.end();
  });
  client.end();
});


test('teardown', function (t) {
  SERVER.close(function () {
    t.end();
  });
});
