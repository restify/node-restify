// Copyright 2012 Mark Cavage <mcavage@gmail.com> All rights reserved.

// Pretty much same setup than client.test.js, with the main difference that
// all the clients here will use node-pooling instead of http Agent.

var uuid = require('node-uuid');
var util = require('util');

var restify = require('../lib');

if (require.cache[__dirname + '/helper.js'])
        delete require.cache[__dirname + '/helper.js'];
var helper = require('./helper.js');



///--- Globals

var after = helper.after;
var before = helper.before;
var test = helper.test;

var PORT = process.env.UNIT_TEST_PORT || 12345;
var JSON_CLIENT;
var STR_CLIENT;
var RAW_CLIENT;
var SERVER;



///--- Helpers

function sendJson(req, res, next) {
        res.send({hello: req.params.hello || req.params.name || null});
        next();
}


function sendText(req, res, next) {
        res.send('hello ' + (req.params.hello || req.params.name || ''));
        next();
}



///--- Tests

before(function (callback) {
        try {
                SERVER = restify.createServer({
                        dtrace: helper.dtrace,
                        log: helper.getLog('server')
                });

                SERVER.on('clientError', function (err) {
                        console.error(err.stack);
                        // process.exit(1);
                });

                SERVER.use(restify.acceptParser(['json', 'text/plain']));
                SERVER.use(restify.dateParser());
                SERVER.use(restify.authorizationParser());
                SERVER.use(restify.queryParser());
                SERVER.use(restify.bodyParser());

                SERVER.get('/json/:name', sendJson);
                SERVER.head('/json/:name', sendJson);
                SERVER.put('/json/:name', sendJson);
                SERVER.post('/json/:name', sendJson);

                SERVER.del('/str/:name', sendText);
                SERVER.get('/str/:name', sendText);
                SERVER.head('/str/:name', sendText);
                SERVER.put('/str/:name', sendText);
                SERVER.post('/str/:name', sendText);

                SERVER.listen(PORT, '127.0.0.1', function () {
                        JSON_CLIENT = restify.createClient({
                                url: 'http://127.0.0.1:' + PORT,
                                dtrace: helper.dtrace,
                                retry: false,
                                type: 'json',
                                pooling: {
                                        max: 2
                                }
                        });
                        STR_CLIENT = restify.createClient({
                                url: 'http://127.0.0.1:' + PORT,
                                dtrace: helper.dtrace,
                                retry: false,
                                type: 'string',
                                pooling: {
                                        max: 5,
                                        maxIdleTime: 120000
                                }
                        });
                        RAW_CLIENT = restify.createClient({
                                url: 'http://127.0.0.1:' + PORT,
                                dtrace: helper.dtrace,
                                retry: false,
                                type: 'http',
                                headers: {
                                        accept: 'text/plain'
                                },
                                pooling: {
                                        max: 5,
                                        maxIdleTime: 120000
                                }
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
                SERVER.close(function () {
                        JSON_CLIENT.pool.shutdown();
                        STR_CLIENT.pool.shutdown();
                        RAW_CLIENT.pool.shutdown();
                        callback();
                });
        } catch (e) {
                console.error(e.stack);
                process.exit(1);
        }
});


test('GET json', function (t) {
        JSON_CLIENT.get('/json/mcavage', function (err, req, res, obj) {
                t.ifError(err);
                t.ok(req);
                t.ok(res);
                t.deepEqual(obj, {hello: 'mcavage'});
                t.end();
        });
});


test('pool acquire and release', function (t) {
        var clients = [];
        for (var i = 0; i < JSON_CLIENT.pool.max; i++) {
                JSON_CLIENT.pool.acquire(function (err, client) {
                        t.ifError(err, 'error acquiring pool client');
                        clients.push(client);
                });
        }
        // Given the queue is full, this will be called once we release
        // later:
        JSON_CLIENT.get('/json/mcavage', function (err, req, res, obj) {
                t.equal(JSON_CLIENT.pool.queue.length, 0);
                t.ifError(err);
                t.ok(req);
                t.ok(res);
                t.deepEqual(obj, {hello: 'mcavage'});
                t.end();
        });
        t.equal(JSON_CLIENT.pool.queue.length, 1);
        t.equal(JSON_CLIENT.pool.resources.length, JSON_CLIENT.pool.max);
        JSON_CLIENT.pool.release(clients.shift());
});


test('GH-115 GET path with spaces', function (t) {
        JSON_CLIENT.get('/json/foo bar', function (err, req, res, obj) {
                t.ok(err);
                console.log(err);
                t.end();
        });
});


test('Check error (404)', function (t) {
        JSON_CLIENT.get('/' + uuid(), function (err, req, res, obj) {
                t.ok(err);
                t.ok(err.message);
                t.equal(err.statusCode, 404);
                t.ok(req);
                t.ok(res);
                t.ok(obj);
                t.equal(obj.code, 'ResourceNotFound');
                t.ok(obj.message);
                t.end();
        });
});


test('HEAD json', function (t) {
        JSON_CLIENT.head('/json/mcavage', function (err, req, res) {
                t.ifError(err);
                t.ok(req);
                t.ok(res);
                t.end();
        });
});


test('POST json', function (t) {
        var data = { hello: 'foo' };
        JSON_CLIENT.post('/json/mcavage', data, function (err, req, res, obj) {
                t.ifError(err);
                t.ok(req);
                t.ok(res);
                t.deepEqual(obj, {hello: 'foo'});
                t.end();
        });
});


test('PUT json', function (t) {
        var data = { hello: 'foo' };
        JSON_CLIENT.post('/json/mcavage', data, function (err, req, res, obj) {
                t.ifError(err);
                t.ok(req);
                t.ok(res);
                t.deepEqual(obj, {hello: 'foo'});
                t.end();
        });
});


test('GET text', function (t) {
        STR_CLIENT.get('/str/mcavage', function (err, req, res, data) {
                t.ifError(err);
                t.ok(req);
                t.ok(res);
                t.equal(res.body, data);
                t.equal(data, 'hello mcavage');
                t.end();
        });
});


test('HEAD text', function (t) {
        STR_CLIENT.head('/str/mcavage', function (err, req, res) {
                t.ifError(err);
                t.ok(req);
                t.ok(res);
                t.end();
        });
});


test('Check error (404)', function (t) {
        STR_CLIENT.get('/' + uuid(), function (err, req, res, message) {
                t.ok(err);
                t.ok(err.message);
                t.equal(err.statusCode, 404);
                t.ok(req);
                t.ok(res);
                t.ok(message);
                t.end();
        });
});


test('POST text', function (t) {
        var body = 'hello=foo';
        STR_CLIENT.post('/str/mcavage', body, function (err, req, res, data) {
                t.ifError(err);
                t.ok(req);
                t.ok(res);
                t.equal(res.body, data);
                t.equal(data, 'hello foo');
                t.end();
        });
});


test('POST text (object)', function (t) {
        var body = {hello: 'foo'};
        STR_CLIENT.post('/str/mcavage', body, function (err, req, res, data) {
                t.ifError(err);
                t.ok(req);
                t.ok(res);
                t.equal(res.body, data);
                t.equal(data, 'hello foo');
                t.end();
        });
});


test('PUT text', function (t) {
        var body = 'hello=foo';
        STR_CLIENT.put('/str/mcavage', body, function (err, req, res, data) {
                t.ifError(err);
                t.ok(req);
                t.ok(res);
                t.equal(res.body, data);
                t.equal(data, 'hello foo');
                t.end();
        });
});


test('DELETE text', function (t) {
        STR_CLIENT.del('/str/mcavage', function (err, req, res) {
                t.ifError(err);
                t.ok(req);
                t.ok(res);
                t.end();
        });
});


test('GET raw', function (t) {
        RAW_CLIENT.get('/str/mcavage', function (connectErr, req) {
                t.ifError(connectErr);
                t.ok(req);

                req.on('result', function (err, res) {
                        t.ifError(err);
                        res.body = '';
                        res.setEncoding('utf8');
                        res.on('data', function (chunk) {
                                res.body += chunk;
                        });

                        res.on('end', function () {
                                t.equal(res.body, 'hello mcavage');
                                t.end();
                        });
                });
        });
});


test('POST raw', function (t) {
        var opts = {
                path: '/str/mcavage',
                headers: {
                        'content-type': 'application/x-www-form-urlencoded'
                }
        };
        RAW_CLIENT.post(opts, function (connectErr, req) {
                t.ifError(connectErr);

                req.write('hello=snoopy');
                req.end();

                req.on('result', function (err, res) {
                        t.ifError(err);
                        res.body = '';
                        res.setEncoding('utf8');
                        res.on('data', function (chunk) {
                                res.body += chunk;
                        });

                        res.on('end', function () {
                                t.equal(res.body, 'hello snoopy');
                                t.end();
                        });
                });
        });
});


test('GH-20 connectTimeout', function (t) {
        var client = restify.createClient({
                url: 'http://169.254.1.10',
                type: 'http',
                accept: 'text/plain',
                connectTimeout: 100,
                retry: false
        });

        client.get('/foo', function (err, req) {
                t.ok(err);
                t.notOk(req);
                t.end();
        });
});
