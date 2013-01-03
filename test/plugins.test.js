// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var http = require('http');

var restify = require('../lib');

if (require.cache[__dirname + '/lib/helper.js'])
        delete require.cache[__dirname + '/lib/helper.js'];
var helper = require('./lib/helper.js');



///--- Globals

var after = helper.after;
var before = helper.before;
var test = helper.test;

var PORT = process.env.UNIT_TEST_PORT || 0;
var CLIENT;
var SERVER;



///--- Tests

before(function (callback) {
        try {
                SERVER = restify.createServer({
                        dtrace: helper.dtrace,
                        log: helper.getLog('server')
                });

                SERVER.use(restify.acceptParser(SERVER.acceptable));
                SERVER.use(restify.authorizationParser());
                SERVER.use(restify.dateParser());
                SERVER.use(restify.queryParser());

                SERVER.get('/foo/:id', function respond(req, res, next) {
                        res.send();
                        next();
                });

                SERVER.listen(PORT, '127.0.0.1', function () {
                        PORT = SERVER.address().port;
                        CLIENT = restify.createJsonClient({
                                url: 'http://127.0.0.1:' + PORT,
                                dtrace: helper.dtrace,
                                retry: false
                        });

                        process.nextTick(callback);
                });
        } catch (e) {
                console.error(e.stack);
                process.exit(1);
        }
});


after(function (callback) {
        try {
                SERVER.close(callback);
        } catch (e) {
                console.error(e.stack);
                process.exit(1);
        }
});


test('accept ok', function (t) {
        CLIENT.get('/foo/bar', function (err, _, res) {
                t.ifError(err);
                t.equal(res.statusCode, 200);
                t.end();
        });
});


test('406', function (t) {
        var opts = {
                path: '/foo/bar',
                headers: {
                        accept: 'foo/bar'
                }
        };
        CLIENT.get(opts, function (err, _, res) {
                t.equal(res.statusCode, 406);
                t.end();
        });
});


test('authorization basic ok', function (t) {
        var authz = 'Basic ' + new Buffer('user:secret').toString('base64');
        var opts = {
                path: '/foo/bar',
                headers: {
                        authorization: authz
                }
        };
        CLIENT.get(opts, function (err, _, res) {
                t.equal(res.statusCode, 200);
                t.end();
        });
});


test('authorization basic invalid', function (t) {
        var opts = {
                path: '/foo/bar',
                headers: {
                        authorization: 'Basic '
                }
        };
        CLIENT.get(opts, function (err, _, res) {
                t.equal(res.statusCode, 400);
                t.end();
        });
});


test('query ok', function (t) {
        SERVER.get('/query/:id', function (req, res, next) {
                t.equal(req.params.id, 'foo');
                t.equal(req.params.name, 'markc');
                t.equal(req.params.name, 'markc');
                res.send();
                next();
        });

        CLIENT.get('/query/foo?id=bar&name=markc', function (err, _, res) {
                t.ifError(err);
                t.equal(res.statusCode, 200);
                t.end();
        });
});


test('GH-124 query ok no query string', function (t) {
        SERVER.get('/query/:id', function (req, res, next) {
                t.ok(req.getQuery());
                t.equal(typeof (req.getQuery()), 'object');
                res.send();
                next();
        });

        CLIENT.get('/query/foo', function (err, _, res) {
                t.ifError(err);
                t.equal(res.statusCode, 200);
                t.end();
        });
});


test('query object', function (t) {
        SERVER.get('/query/:id', function (req, res, next) {
                t.equal(req.params.id, 'foo');
                t.ok(req.params.name);
                t.equal(req.params.name.first, 'mark');
                t.equal(req.query.name.last, 'cavage');
                res.send();
                next();
        });

        var path = '/query/foo?name[first]=mark&name[last]=cavage';
        CLIENT.get(path, function (err, _, res) {
                t.ifError(err);
                t.equal(res.statusCode, 200);
                t.end();
        });
});


test('body url-encoded ok', function (t) {
        SERVER.post('/bodyurl/:id',
                    restify.bodyParser(),
                    function (req, res, next) {
                            t.equal(req.params.id, 'foo');
                            t.equal(req.params.name, 'markc');
                            t.equal(req.params.phone, '(206) 555-1212');
                            res.send();
                            next();
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
                    restify.bodyParser({ mapParams: false }),
                    function (req, res, next) {
                            t.equal(req.params.id, 'foo');
                            t.equal(req.params.name, 'markc');
                            t.notOk(req.params.phone);
                            t.equal(req.body.phone, '(206) 555-1212');
                            res.send();
                            next();
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
        SERVER.post('/body/:id',
                    restify.bodyParser(),
                    function (req, res, next) {
                            t.equal(req.params.id, 'foo');
                            t.equal(req.params.name, 'markc');
                            t.equal(req.params.phone, '(206) 555-1212');
                            res.send();
                            next();
                    });

        var obj = {
                phone: '(206) 555-1212',
                name: 'somethingelse'
        };
        CLIENT.post('/body/foo?name=markc', obj, function (err, _, res) {
                t.ifError(err);
                t.equal(res.statusCode, 200);
                t.end();
        });

});

test('body json ok (no params)', function (t) {
        SERVER.post('/body/:id',
                    restify.bodyParser({ mapParams: false }),
                    function (req, res, next) {
                            t.equal(req.params.id, 'foo');
                            t.equal(req.params.name, 'markc');
                            t.notOk(req.params.phone);
                            t.equal(req.body.phone, '(206) 555-1212');
                            res.send();
                            next();
                    });

        var obj = {
                phone: '(206) 555-1212',
                name: 'somethingelse'
        };
        CLIENT.post('/body/foo?name=markc', obj, function (err, _, res) {
                t.ifError(err);
                t.equal(res.statusCode, 200);
                t.end();
        });
});



test('GH-111 JSON Parser not right for arrays', function (t) {
        SERVER.post('/gh111',
                    restify.bodyParser(),
                    function (req, res, next) {
                            t.ok(Array.isArray(req.params));
                            t.equal(req.params[0], 'foo');
                            t.equal(req.params[1], 'bar');
                            res.send();
                            next();
                    });

        var obj = ['foo', 'bar'];
        CLIENT.post('/gh111', obj, function (err, _, res) {
                t.ifError(err);
                t.end();
                t.equal(res.statusCode, 200);
        });
});


test('GH-279 more JSON Arrays', function (t) {
        function respond(req, res, next) {
                t.ok(Array.isArray(req.params));
                t.equal(req.params[0].id, '123654');
                t.ok(req.params[0].name, 'mimi');
                t.ok(req.params[1].id, '987654');
                t.ok(req.params[1].name, 'pijama');
                res.send(200);
                next();
        }

        SERVER.post('/gh279', restify.jsonBodyParser(), respond);

        var obj = [ {
                'id': '123654',
                'name': 'mimi'
        }, {
                id: '987654',
                name: 'pijama'
        }];
        CLIENT.post('/gh279', obj, function (err, _, res) {
                t.ifError(err);
                t.end();
                t.equal(res.statusCode, 200);
        });
});

test('date expired', function (t) {
        var opts = {
                path: '/foo/bar',
                headers: {
                        date: 'Tue, 15 Nov 1994 08:12:31 GMT'
                }
        };
        CLIENT.get(opts, function (err, _, res) {
                t.ok(err);
                t.ok(/Date header .+ is too old/.test(err.message));
                t.equal(res.statusCode, 400);
                t.end();
        });
});


test('Conditional Request with correct Etag and headers', function (t) {
        SERVER.get('/etag/:id',
                   function (req, res, next) {
                           res.etag = 'testETag';
                           next();
                   },
                   restify.conditionalRequest(),
                   function (req, res, next) {
                           res.body = 'testing 304';
                           res.send();
                           next();
                   });

        var opts = {
                path: '/etag/foo',
                headers: {
                        'If-Match': 'testETag',
                        'If-None-Match': 'testETag'
                }
        };
        CLIENT.get(opts, function (err, _, res) {
                t.equal(res.statusCode, 304);
                t.end();
        });
});


test('Conditional Request with mismatched Etag and If-Match', function (t) {
        SERVER.get('/etag/:id',
                   function setEtag(req, res, next) {
                           res.etag = 'testEtag';
                           next();
                   },
                   restify.conditionalRequest(),
                   function respond(req, res, next) {
                           res.send();
                           next();
                   });

        var opts = {
                path: '/etag/foo',
                headers: {
                        'If-Match': 'testETag2'
                }
        };
        CLIENT.get(opts, function (err, _, res) {
                t.equal(res.statusCode, 412);
                t.end();
        });
});


test('cdntl req If-Modified header & !modified content', function (t) {
        var now = new Date();
        var yesterday = new Date(now.setDate(now.getDate() - 1));
        SERVER.get('/etag/:id',
                   function (req, res, next) {
                           res.header('Last-Modified', yesterday);
                           next();
                   },
                   restify.conditionalRequest(),
                   function (req, res, next) {
                           res.send('testing 304');
                           next();
                   });

        var opts = {
                path: '/etag/foo',
                headers: {
                        'If-Modified-Since': new Date()
                }
        };
        CLIENT.get(opts, function (err, _, res) {
                t.equal(res.statusCode, 304);
                t.end();
        });
});


test('cdtl req  If-Unmodified-Since header,modified content', function (t) {
        var now = new Date();
        var yesterday = new Date(now.setDate(now.getDate() - 1));
        SERVER.get('/etag/:id',
                   function (req, res, next) {
                           res.header('Last-Modified', new Date());
                           next();
                   },
                   restify.conditionalRequest(),
                   function (req, res, next) {
                           res.send('testing 412');
                           next();
                   });

        var opts = {
                path: '/etag/foo',
                headers: {
                        'If-Unmodified-Since': yesterday
                }
        };
        CLIENT.get(opts, function (err, _, res) {
                t.equal(res.statusCode, 412);
                t.end();
        });
});


test('cdtl req valid headers, ahead time, unmodified OK', function (t) {
        var now = new Date();
        var ahead = new Date(now.getTime() + 1000);
        SERVER.get('/etag/:id',
                   function (req, res, next) {
                           res.header('Last-Modified', now);
                           next();
                   },
                   restify.conditionalRequest(),
                   function (req, res, next) {
                           res.send();
                           next();
                   });

        var opts = {
                path: '/etag/foo',
                headers: {
                        'If-Modified-Since': ahead
                }
        };

        CLIENT.get(opts, function (err, _, res) {
                t.equal(res.statusCode, 304);
                t.end();
        });
});


test('cdtl req valid headers, ahead Timezone, modified content', function (t) {
        var now = new Date();
        var ahead = new Date(now.setHours(now.getHours() + 5));
        SERVER.get('/etag/:id',
                   function (req, res, next) {
                           res.header('Last-Modified', now);
                           next();
                   },
                   restify.conditionalRequest(),
                   function (req, res, next) {
                           res.send();
                           next();
             });

        var opts = {
                path: '/etag/foo',
                headers: {
                        'If-Unmodified-Since': ahead
                }
        };
        CLIENT.get(opts, function (err, _, res) {
                t.equal(res.statusCode, 200);
                t.end();
        });
});


test('Conditional PUT with matched Etag and headers', function (t) {
        SERVER.put('/etag/:id',
                   function (req, res, next) {
                           res.etag = 'testETag';
                           next();
                   },
                   restify.conditionalRequest(),
                   function (req, res, next) {
                           res.send();
                           next();
                   });

        var opts = {
                path: '/etag/foo',
                headers: {
                        'If-Match': 'testETag',
                        'If-None-Match': 'testETag'
                }
        };
        CLIENT.put(opts, {}, function (err, _, res) {
                t.equal(res.statusCode, 412);
                t.end();
        });
});


test('gzip response', function (t) {
        SERVER.get('/gzip/:id',
                   restify.gzipResponse(),
                   function (req, res, next) {
                           res.send({
                                   hello: 'world'
                           });
                           next();
                   });

        var opts = {
                path: '/gzip/foo',
                headers: {
                        'Accept-Encoding': 'gzip'
                }
        };
        CLIENT.get(opts, function (err, _, res, obj) {
                t.ifError(err);
                t.deepEqual({hello: 'world'}, obj);
                t.end();
        });
});


test('gzip body json ok', function (t) {
        SERVER.post('/body/:id',
                    restify.bodyParser(),
                    function (req, res, next) {
                            t.equal(req.params.id, 'foo');
                            t.equal(req.params.name, 'markc');
                            t.equal(req.params.phone, '(206) 555-1212');
                            res.send();
                            next();
                    });

        var obj = {
                phone: '(206) 555-1212',
                name: 'somethingelse'
        };
        CLIENT.gzip = {};
        CLIENT.post('/body/foo?name=markc', obj, function (err, _, res) {
                t.ifError(err);
                t.ok(res);
                if (res)
                        t.equal(res.statusCode, 200);
                t.end();
        });
});