// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

var fs = require('fs');
var http = require('http');
var net = require('net');
var path = require('path');

var bunyan = require('bunyan');
var restifyClients = require('restify-clients');

var restify = require('../lib');


if (require.cache[__dirname + '/lib/helper.js']) {
    delete require.cache[__dirname + '/lib/helper.js'];
}
var helper = require('./lib/helper.js');


///--- Globals

var after = helper.after;
var before = helper.before;
var test = helper.test;

var PORT = process.env.UNIT_TEST_PORT || 0;
var CLIENT;
var SERVER;

var FILES_TO_DELETE = [];
var DIRS_TO_DELETE = [];

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
        SERVER.use(restify.jsonp());

        SERVER.get('/foo/:id', function respond(req, res, next) {
            res.send();
            next();
        });

        SERVER.listen(PORT, '127.0.0.1', function () {
            PORT = SERVER.address().port;
            CLIENT = restifyClients.createJsonClient({
                url: 'http://127.0.0.1:' + PORT,
                dtrace: helper.dtrace,
                retry: false,
                agent: false
            });

            process.nextTick(callback);
        });
    } catch (e) {
        console.error(e.stack);
        process.exit(1);
    }
});


after(function (callback) {
    var i;

    try {
        for (i = 0; i < FILES_TO_DELETE.length; ++i) {
            try {
                fs.unlinkSync(FILES_TO_DELETE[i]);
            }
            catch (err) { /* normal */
            }
        }

        for (i = 0; i < DIRS_TO_DELETE.length; ++i) {
            try {
                fs.rmdirSync(DIRS_TO_DELETE[i]);
            }
            catch (err) { /* normal */
            }
        }
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
        t.equal(req.getQuery(), '');
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

    var p = '/query/foo?name[first]=mark&name[last]=cavage';
    CLIENT.get(p, function (err, _, res) {
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

test('body multipart ok', function (t) {
    SERVER.post('/multipart/:id',
        restify.bodyParser(),
        function (req, res, next) {
            t.equal(req.params.id, 'foo');
            t.equal(req.params.mood, 'happy');
            t.equal(req.params.endorphins, '9000');
            res.send();
            next();
        });

    var opts = {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/multipart/foo?mood=happy',
        agent: false,
        method: 'POST',
        headers: {
            'Content-Type': 'multipart/form-data; boundary=huff'
        }
    };

    var client = http.request(opts, function (res) {
        t.equal(res.statusCode, 200);
        t.end();
    });

    client.write('--huff\r\nContent-Disposition: form-data; ' +
                 'name="endorphins"\r\n\r\n9000\r\n--huff--');
    client.end();
});

test('gh-847 body multipart no files ok', function (t) {
    SERVER.post('/multipart/:id',
        restify.bodyParser({
            mapFiles: true,
            mapParams: true,
            keepExtensions: true,
            uploadDir: '/tmp/',
            override: true
        }),
        function (req, res, next) {
            t.equal(req.params.id, 'foo');
            t.equal(req.params.mood, 'happy');
            t.equal(req.params.endorphins, '9000');
            res.send();
            next();
        });

    var opts = {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/multipart/foo?mood=happy',
        agent: false,
        method: 'POST',
        headers: {
            'Content-Type': 'multipart/form-data; boundary=huff'
        }
    };

    var client = http.request(opts, function (res) {
        t.equal(res.statusCode, 200);
        t.end();
    });

    // don't actually upload a file
    client.write('--huff\r\nContent-Disposition: form-data; ' +
                 'name="endorphins"\r\n\r\n9000\r\n--huff--');
    client.end();
});

test('gh-847 body multipart files ok', function (t) {
    var shine = 'Well you wore out your welcome with random precision, rode ' +
        'on the steel breeze. Come on you raver, you seer of visions, come on' +
        ' you painter, you piper, you prisoner, and shine!';
    var echoes = 'Overhead the albatross hangs motionless upon the air And ' +
        'deep beneath the rolling waves in labyrinths of coral caves The ' +
        'echo of a distant tide Comes willowing across the sand And ' +
        'everything is green and submarine';
    SERVER.post('/multipart/:id',
        restify.bodyParser({
            mapFiles: true,
            mapParams: true,
            keepExtensions: true,
            uploadDir: '/tmp/',
            override: true
        }),
        function (req, res, next) {
            t.equal(req.params.id, 'foo');
            t.equal(req.params.mood, 'happy');
            t.equal(req.params.endorphins, '12');
            t.ok(req.params.shine);
            t.ok(req.params.echoes);
            t.equal(req.params.shine.toString('utf8'), shine);
            t.equal(req.params.echoes.toString('utf8'), echoes);
            res.send();
            next();
        });

    var opts = {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/multipart/foo?mood=happy',
        agent: false,
        method: 'POST',
        headers: {
            'Content-Type': 'multipart/form-data; boundary=huff'
        }
    };

    var client = http.request(opts, function (res) {
        t.equal(res.statusCode, 200);
        t.end();
    });

    client.write('--huff\r\n');
    client.write('Content-Disposition: form-data; name="endorphins"\r\n\r\n');
    client.write('12\r\n');

    client.write('--huff\r\n');

    client.write('Content-Disposition: form-data; name="shine"; ' +
                 'filename="shine.txt"\r\n');
    client.write('Content-Type: text/plain\r\n\r\n');
    client.write(shine + '\r\n');
    client.write('--huff\r\n');

    client.write('Content-Disposition: form-data; name="echoes"; ' +
                 'filename="echoes.txt"\r\n');
    client.write('Content-Type: text/plain\r\n\r\n');
    client.write(echoes + '\r\n');
    client.write('--huff--');

    client.end();
});

test('body multipart ok custom handling', function (t) {
    var detailsString = 'High endorphin levels make you happy. ' +
        'Mostly... I guess. Whatever.';
    SERVER.post('/multipart/:id',
        restify.bodyParser({
            multipartHandler: function (part) {
                var buffer = new Buffer(0);
                part.on('data', function (data) {
                    buffer = Buffer.concat([ data ]);
                });

                part.on('end', function () {
                    t.equal(part.name, 'endorphins');
                    t.equal(buffer.toString('ascii'), '12');
                });
            },
            multipartFileHandler: function (part) {
                var buffer = new Buffer(0);
                part.on('data', function (data) {
                    buffer = Buffer.concat([ data ]);
                });

                part.on('end', function () {
                    t.equal(part.name, 'details');
                    t.equal(part.filename, 'mood_details.txt');
                    t.equal(buffer.toString('ascii'), detailsString);
                });
            },
            mapParams: false
        }),
        function (req, res, next) {
            res.send();
            next();
        });

    var opts = {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/multipart/foo?mood=sad',
        agent: false,
        method: 'POST',
        headers: {
            'Content-Type': 'multipart/form-data; boundary=huff'
        }
    };

    var client = http.request(opts, function (res) {
        t.equal(res.statusCode, 200);
        t.end();
    });

    client.write('--huff\r\n');
    client.write('Content-Disposition: form-data; name="endorphins"\r\n\r\n');
    client.write('12\r\n');

    client.write('--huff\r\n');

    // jscs:disable maximumLineLength
    client.write('Content-Disposition: form-data; name="details"; filename="mood_details.txt"\r\n');

    // jscs:enable maximumLineLength
    client.write('Content-Type: text/plain\r\n\r\n');
    client.write(detailsString + '\r\n');
    client.write('--huff--');

    client.end();
});

test('GH-694 pass hash option through to Formidable', function (t) {
    var content = 'Hello World!';
    var hash = '2ef7bde608ce5404e97d5f042f95f89f1c232871';
    SERVER.post('/multipart',
        restify.bodyParser({hash: 'sha1'}),
        function (req, res, next) {
            t.equal(req.files.details.hash, hash);
            res.send();
            next();
        });

    var opts = {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/multipart',
        agent: false,
        method: 'POST',
        headers: {
            'Content-Type': 'multipart/form-data; boundary=huff'
        }
    };

    var client = http.request(opts, function (res) {
        t.equal(res.statusCode, 200);
        t.end();
    });

    client.write('--huff\r\n');

    // jscs:disable maximumLineLength
    client.write('Content-Disposition: form-data; name="details"; filename="mood_details.txt"\r\n');

    // jscs:enable maximumLineLength
    client.write('Content-Type: text/plain\r\n\r\n');
    client.write(content + '\r\n');
    client.write('--huff--');

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

test('body json ok (null params)', function (t) {
    var STRING_CLIENT = restifyClients.createStringClient({
        url: 'http://127.0.0.1:' + PORT,
        dtrace: helper.dtrace,
        retry: false,
        agent: false,
        contentType: 'application/json',
        accept: 'application/json'
    });

    SERVER.post('/body/:id',
        restify.bodyParser(),
        function (req, res, next) {
            t.equal(req.params.id, 'foo');
            t.equal(req.params.name, 'markc');
            res.send();
            next();
        });

    STRING_CLIENT.post('/body/foo?name=markc', 'null', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});

test('GH-318 get request with body (default)', function (t) {
    SERVER.get('/getWithoutBody',
        restify.bodyParser({ mapParams: true }),
        function (req, res, next) {
            t.notEqual(req.params.foo, 'bar');
            res.send();
            next();
        });

    var request = 'GET /getWithoutBody HTTP/1.1\r\n' +
        'Content-Type: application/json\r\n' +
        'Content-Length: 13\r\n' +
        '\r\n' +
        '{"foo":"bar"}';

    var client = net.connect({host: '127.0.0.1', port: PORT}, function () {
        client.write(request);
    });
    client.once('data', function (data) {
        client.end();
    });
    client.once('end', function () {
        t.end();
    });
});

test('GH-318 get request with body (requestBodyOnGet=true)', function (t) {
    SERVER.get('/getWithBody',
        restify.bodyParser({
            mapParams: true,
            requestBodyOnGet: true
        }), function (req, res, next) {
            t.equal(req.params.foo, 'bar');
            res.send();
            next();
        });

    var request = 'GET /getWithBody HTTP/1.1\r\n' +
        'Content-Type: application/json\r\n' +
        'Content-Length: 13\r\n' +
        '\r\n' +
        '{"foo":"bar"}';
    var client = net.connect({host: '127.0.0.1', port: PORT}, function () {
        client.write(request);
    });

    client.once('data', function (data) {
        client.end();
    });

    client.once('end', function () {
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

    var obj = [
        {
            id: '123654',
            name: 'mimi'
        },
        {
            id: '987654',
            name: 'pijama'
        }
    ];
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


test('gzip large response', function (t) {
    var testResponseSize = 65536 * 3;
    var TestStream = function () {
        this.readable = true;
        this.sentSize = 0;
        this.totalSize = testResponseSize;
        this.interval = null;
    };
    require('util').inherits(TestStream, require('stream'));
    TestStream.prototype.resume = function () {
        var self = this;

        if (!this.interval) {
            this.interval = setInterval(function () {
                var chunkSize = Math.min(self.totalSize -
                    self.sentSize, 65536);

                if (chunkSize > 0) {
                    var chunk = new Array(chunkSize + 1);
                    chunk = chunk.join('a');
                    self.emit('data', chunk);
                    self.sentSize += chunkSize;
                } else {
                    self.emit('data', '"}');
                    self.emit('end');
                    self.pause();
                }
            }, 1);
        }
    };

    TestStream.prototype.pause = function () {
        clearInterval(this.interval);
        this.interval = null;
    };

    var bodyStream = new TestStream();

    SERVER.get('/gzip/:id',
        restify.gzipResponse(),
        function (req, res, next) {
            bodyStream.resume();
            res.write('{"foo":"');
            bodyStream.pipe(res);
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
        var expectedResponse = {
            foo: new Array(testResponseSize + 1).join('a')
        };
        t.deepEqual(expectedResponse, obj);
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

        if (res) {
            t.equal(res.statusCode, 200);
        }
        t.end();
    });
});


test('static serves static files', function (t) {
    serveStaticTest(t, false, '.tmp');
});


test('static serves static files in nested folders', function (t) {
    serveStaticTest(t, false, '.tmp/folder');
});


test('static serves static files in with a root regex', function (t) {
    serveStaticTest(t, false, '.tmp', new RegExp('/.*'));
});


test('static serves static files with a root, !greedy, regex', function (t) {
    serveStaticTest(t, false, '.tmp', new RegExp('/?.*'));
});


test('static serves default file', function (t) {
    serveStaticTest(t, true, '.tmp');
});


test('GH-379 static serves file with parentheses in path', function (t) {
    serveStaticTest(t, false, '.(tmp)');
});


test('GH-719 serve a specific static file', function (t) {
    // serve the same default file .tmp/public/index.json
    // but get it from opts.file
    serveStaticTest(t, false, '.tmp', null, true);
});


test('audit logger timer test', function (t) {
    // Dirty hack to capture the log record using a ring buffer.
    var ringbuffer = new bunyan.RingBuffer({ limit: 1 });

    SERVER.once('after', restify.auditLogger({
        log: bunyan.createLogger({
            name: 'audit',
            streams:[ {
                level: 'info',
                type: 'raw',
                stream: ringbuffer
            }]
        })
    }));

    SERVER.get('/audit', function aTestHandler(req, res, next) {
        req.startHandlerTimer('audit-sub');

        setTimeout(function () {
            req.endHandlerTimer('audit-sub');
            res.send('');
            return (next());
        }, 1100);
        // this really should be 1000 but make it 1100 so that the tests don't
        // sporadically fail due to timing issues.
    });

    CLIENT.get('/audit', function (err, req, res) {
        t.ifError(err);

        // check timers
        t.ok(ringbuffer.records[0], 'no log records');
        t.equal(ringbuffer.records.length, 1, 'should only have 1 log record');
        t.ok(ringbuffer.records[0].req.timers.aTestHandler > 1000000,
             'atestHandler should be > 1000000');
        t.ok(ringbuffer.records[0].req.timers['aTestHandler-audit-sub'] >
             1000000, 'aTestHandler-audit-sub should be > 1000000');
        var handlers = Object.keys(ringbuffer.records[0].req.timers);
        t.equal(handlers[handlers.length - 2], 'aTestHandler-audit-sub',
                'sub handler timer not in order');
        t.equal(handlers[handlers.length - 1], 'aTestHandler',
                'aTestHandler not last');
        t.end();
    });
});


test('audit logger anonymous timer test', function (t) {
    // Dirty hack to capture the log record using a ring buffer.
    var ringbuffer = new bunyan.RingBuffer({ limit: 1 });

    SERVER.once('after', restify.auditLogger({
        log: bunyan.createLogger({
            name: 'audit',
            streams:[ {
                level: 'info',
                type: 'raw',
                stream: ringbuffer
            }]
        })
    }));

    SERVER.get('/audit', function (req, res, next) {
        setTimeout(function () {
            return (next());
        }, 1000);
    }, function (req, res, next) {
        req.startHandlerTimer('audit-sub');

        setTimeout(function () {
            req.endHandlerTimer('audit-sub');
            res.send('');
            return (next());
        }, 1000);
    });

    CLIENT.get('/audit', function (err, req, res) {
        t.ifError(err);

        // check timers
        t.ok(ringbuffer.records[0], 'no log records');
        t.equal(ringbuffer.records.length, 1, 'should only have 1 log record');
        t.ok(ringbuffer.records[0].req.timers['handler-0'] > 1000000,
             'handler-0 should be > 1000000');
        t.ok(ringbuffer.records[0].req.timers['handler-1'] > 1000000,
             'handler-1 should be > 1000000');
        t.ok(ringbuffer.records[0].req.timers['handler-1-audit-sub'] >
             1000000, 'handler-0-audit-sub should be > 1000000');
        var handlers = Object.keys(ringbuffer.records[0].req.timers);
        t.equal(handlers[handlers.length - 2], 'handler-1-audit-sub',
                'sub handler timer not in order');
        t.equal(handlers[handlers.length - 1], 'handler-1',
                'handler-1 not last');
        t.end();
    });
});


test('GH-812 audit logger has query params string', function (t) {

    // Dirty hack to capture the log record using a ring buffer.
    var ringbuffer = new bunyan.RingBuffer({ limit: 1 });

    SERVER.once('after', restify.auditLogger({
        log: bunyan.createLogger({
            name: 'audit',
            streams:[ {
                level: 'info',
                type: 'raw',
                stream: ringbuffer
            }]
        })
    }));

    SERVER.get('/audit', function (req, res, next) {
        res.send();
        next();
    });

    CLIENT.get('/audit?a=1&b=2', function (err, req, res) {
        t.ifError(err);

        // check timers
        t.ok(ringbuffer.records[0], 'no log records');
        t.equal(ringbuffer.records.length, 1, 'should only have 1 log record');
        t.ok(ringbuffer.records[0].req.query, 'a=1&b=2');
        t.end();
    });
});


test('GH-812 audit logger has query params obj', function (t) {

    // Dirty hack to capture the log record using a ring buffer.
    var ringbuffer = new bunyan.RingBuffer({ limit: 1 });

    SERVER.once('after', restify.auditLogger({
        log: bunyan.createLogger({
            name: 'audit',
            streams:[ {
                level: 'info',
                type: 'raw',
                stream: ringbuffer
            }]
        })
    }));

    SERVER.get('/audit', [
        restify.queryParser(),
        function (req, res, next) {
            res.send();
            next();
        }
    ]);

    CLIENT.get('/audit?a=1&b=2', function (err, req, res) {
        t.ifError(err);

        // check timers
        t.ok(ringbuffer.records[0], 'no log records');
        t.equal(ringbuffer.records.length, 1, 'should only have 1 log record');
        t.deepEqual(ringbuffer.records[0].req.query, { a: 1, b: 2});
        t.end();
    });
});


test('GH-774 utf8 corruption in body parser', function (t) {
    var slen = 100000;

    SERVER.post('/utf8',
        restify.bodyParser({ mapParams: false }),
        function (req, res, next) {
            t.notOk(/\ufffd/.test(req.body.text));
            t.equal(req.body.text.length, slen);
            res.send({ len: req.body.text.length });
            next();
        });

    // create a long string of unicode characters
    var tx = '';

    for (var i = 0; i < slen; ++i) {
        tx += '\u2661';
    }

    CLIENT.post('/utf8', { text: tx }, function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});


test('request expiry testing to ensure that invalid ' +
     'requests will error.', function (t) {
    var key = 'x-request-expiry';
    var getPath = '/request/expiry';
    var called = false;
    var expires = restify.requestExpiry({ header: key });
    SERVER.get(
        getPath,
        expires,
        function (req, res, next) {
            called = true;
            res.send();
            next();
        });

    var obj = {
        path: getPath,
        headers: {
            'x-request-expiry': Date.now() - 100
        }
    };
    CLIENT.get(obj, function (err, _, res) {
        t.equal(res.statusCode, 504);
        t.equal(called, false);
        t.end();
    });
});


test('request expiry testing to ensure that valid ' +
     'requests will succeed.', function (t) {
    var key = 'x-request-expiry';
    var getPath = '/request/expiry';
    var called = false;
    var expires = restify.requestExpiry({ header: key });
    SERVER.get(
        getPath,
        expires,
        function (req, res, next) {
            called = true;
            res.send();
            next();
        });

    var obj = {
        path: getPath,
        headers: {
            'x-request-expiry': Date.now() + 100
        }
    };
    CLIENT.get(obj, function (err, _, res) {
        t.equal(res.statusCode, 200);
        t.equal(called, true);
        t.ifError(err);
        t.end();
    });
});


test('request expiry testing to ensure that valid ' +
     'requests without headers will succeed.', function (t) {
    var key = 'x-request-expiry';
    var getPath = '/request/expiry';
    var called = false;
    var expires = restify.requestExpiry({ header: key });
    SERVER.get(
        getPath,
        expires,
        function (req, res, next) {
            called = true;
            res.send();
            next();
        });

    var obj = {
        path: getPath,
        headers: { }
    };
    CLIENT.get(obj, function (err, _, res) {
        t.equal(res.statusCode, 200);
        t.equal(called, true);
        t.ifError(err);
        t.end();
    });
});

test('tests the requestLoggers extra header properties', function (t) {
    var key = 'x-request-uuid';
    var badKey = 'x-foo-bar';
    var getPath = '/requestLogger/extraHeaders';
    var headers = [key, badKey];
    SERVER.get(
        getPath,
        restify.requestLogger({headers: headers}),
        function (req, res, next) {
            t.equal(req.log.fields[key], 'foo-for-eva');
            t.equal(req.log.fields.hasOwnProperty(badKey), false);
            res.send();
            next();
        });

    var obj = {
        path: getPath,
        headers: { }
    };
    obj.headers[key] = 'foo-for-eva';
    CLIENT.get(obj, function (err, _, res) {
        t.equal(res.statusCode, 200);
        t.ifError(err);
        t.end();
    });
});


test('jsonp plugin with res.json()', function (t) {
    SERVER.get('/jsonp', function (req, res, next) {
        res.json({x: 'w00t!'});
    });

    CLIENT.get('/jsonp?callback=c._0', function (err, _, res) {
        t.equal(res.statusCode, 200);
        t.equal(res.headers['content-type'], 'application/json');
        t.equal(res.body, '{"x":"w00t!"}');
        t.end();
    });
});


///--- Privates
function serveStaticTest(t, testDefault, tmpDir, regex, staticFile) {
    var staticContent = '{"content": "abcdefg"}';
    var staticObj = JSON.parse(staticContent);
    var testDir = 'public';
    var testFileName = 'index.json';
    var routeName = 'GET wildcard';
    var tmpPath = path.join(process.cwd(), tmpDir);
    fs.mkdir(tmpPath, function (err) {
        DIRS_TO_DELETE.push(tmpPath);
        var folderPath = path.join(tmpPath, testDir);

        fs.mkdir(folderPath, function (err2) {
            t.ifError(err2);

            DIRS_TO_DELETE.push(folderPath);
            var file = path.join(folderPath, testFileName);

            fs.writeFile(file, staticContent, function (err3) {
                t.ifError(err3);
                FILES_TO_DELETE.push(file);
                var p = '/' + testDir + '/' + testFileName;
                var opts = { directory: tmpPath };

                if (staticFile) {
                    opts.file = p;
                }

                if (testDefault) {
                    opts.defaultFile = testFileName;
                    routeName += ' with default';
                }
                var re = regex ||
                    new RegExp('/' + testDir + '/?.*');

                SERVER.get({
                    path: re,
                    name: routeName
                }, restify.serveStatic(opts));

                CLIENT.get(p, function (err4, req, res, obj) {
                    t.ifError(err4);
                    t.equal(res.headers['cache-control'],
                        'public, max-age=3600');
                    t.deepEqual(obj, staticObj);
                    t.end();
                });
            });
        });
    });

}
