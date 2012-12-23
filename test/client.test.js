// Copyright 2012 Mark Cavage <mcavage@gmail.com> All rights reserved.

var http = require('http');

var uuid = require('node-uuid');

var restify = require('../lib');

if (require.cache[__dirname + '/lib/helper.js'])
        delete require.cache[__dirname + '/lib/helper.js'];
var helper = require('./lib/helper.js');



///--- Globals

var after = helper.after;
var before = helper.before;
var test = helper.test;

var PORT = process.env.UNIT_TEST_PORT || 0;
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

function sendSignature(req, res, next) {
        res.header('content-type', 'text/plain');
        var hdr = req.header('X-Awesome-Signature');
        if (!hdr) {
                res.send('request NOT signed');
        } else {
                res.send('ok: ' + hdr);
        }
}


function sendWhitespace(req, res, next) {
        var body = ' ';
        if (req.params.flavor === 'spaces') {
                body = '   ';
        } else if (req.params.flavor === 'tabs') {
                body = ' \t\t  ';
        }

        // override contentType as otherwise the string is json-ified to
        // include quotes. Don't want that for this test.
        res.header('content-type', 'text/plain');
        res.send(body);
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
                        console.error('CLIENT ERROR');
                        console.error(err.stack);
                        // process.exit(1);
                });

                SERVER.use(restify.acceptParser(['json', 'text/plain']));
                SERVER.use(restify.dateParser());
                SERVER.use(restify.authorizationParser());
                SERVER.use(restify.queryParser());
                SERVER.use(restify.bodyParser());

                SERVER.get('/signed', sendSignature);
                SERVER.get('/whitespace/:flavor', sendWhitespace);

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
                        PORT = SERVER.address().port;

                        JSON_CLIENT = restify.createJsonClient({
                                url: 'http://127.0.0.1:' + PORT,
                                dtrace: helper.dtrace,
                                retry: false
                        });
                        STR_CLIENT = restify.createStringClient({
                                url: 'http://127.0.0.1:' + PORT,
                                dtrace: helper.dtrace,
                                retry: false
                        });
                        RAW_CLIENT = restify.createClient({
                                url: 'http://127.0.0.1:' + PORT,
                                dtrace: helper.dtrace,
                                retry: false,
                                headers: {
                                        accept: 'text/plain'
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
                SERVER.close(callback);
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


test('GH-169 PUT json Content-MD5', function (t) {
        var msg = {
                '_id': '4ff71172bc148900000010a3',
                'userId': '4f711b377579dbf65e000001',
                'courseId': '4f69021bff338faffa000001',
                'createdByUserId': '4f711b377579dbf65e000001',
                'dateFrom': '2012-06-04',
                'dateTo': '2012-09-30',
                'notes': 'Rates do not include tax & are subject to change ' +
                        'without notice\\nRental Clubs are available for $30 ' +
                        'per set\\nAll major credit cards accepted',
                'updatedAt': '2012-07-06T17:59:08.581Z',
                'periods': [
                        {
                                'name': 'morning',
                                'weekdayWalking': 1500,
                                'weekdayCart': 3000,
                                'weekendWalking': 2000,
                                'weekendCart': 3500,
                                'timeFrom': 0,
                                'timeTo': 780,
                                '_id': '4ff71172bc148900000010a4'
                        },
                        {
                                'timeFrom': 780,
                                'name': 'twilight',
                                'timeTo': 900,
                                'weekdayWalking': 1500,
                                'weekdayCart': 2500,
                                'weekendWalking': 1500,
                                'weekendCart': 3000,
                                '_id': '4ff7276cbc148900000010f4'
                        },
                        {
                                'timeFrom': 900,
                                'name': 'super twilight',
                                'weekdayWalking': 1200,
                                'weekdayCart': 2000,
                                'weekendWalking': 1200,
                                'weekendCart': 2500,
                                'timeTo': 1439,
                                '_id': '4ff7276cbc148900000010f3'
                        }
                ],
                'holidays': [
                        {
                                'country': 'US',
                                'name': 'Flag Day',
                                'start': 1339657200000,
                                'end': 1339743600000,
                                'date': '2012-06-14'
                        },
                        {
                                'country': 'US / MX',
                                'name': 'Father\'s Day, Día del Padre ' +
                                        '(Father\'s Day)',
                                'start': 1340262000000,
                                'end': 1340348400000,
                                'date': '2012-06-21'
                        },
                        {
                                'country': 'US',
                                'name': 'Independence Day',
                                'start': 1341385200000,
                                'end': 1341471600000,
                                'date': '2012-07-04'
                        },
                        {
                                'country': 'US',
                                'name': 'Labor Day',
                                'start': 1347001200000,
                                'end': 1347087600000,
                                'date': '2012-09-07'
                        }
                ],
                'weekdaySunday': false,
                'weekdaySaturday': false,
                'weekdayFriday': false,
                'weekdayThursday': true,
                'weekdayWednesday': true,
                'weekdayTuesday': true,
                'weekdayMonday': true
        };

        JSON_CLIENT.put('/json/md5', msg, function (err, req, res, obj) {
                t.ifError(err);
                t.ok(req);
                t.ok(res);
                t.end();
        });
});


test('GH-203 GET json, body is whitespace', function (t) {
        JSON_CLIENT.get('/whitespace/spaces', function (err, req, res, obj) {
                t.ifError(err);
                t.ok(req);
                t.ok(res);
                t.deepEqual(obj, {});
                t.end();
        });
});


test('GH-203 GET json, body is tabs', function (t) {
        JSON_CLIENT.get('/whitespace/tabs', function (err, req, res, obj) {
                t.ifError(err);
                t.ok(req);
                t.ok(res);
                t.deepEqual(obj, {});
                t.end();
        });
});


test('don\'t sign a request', function (t) {
        var client = restify.createClient({
                url: 'http://127.0.0.1:' + PORT,
                type: 'string',
                accept: 'text/plain',
                headers: { 'X-Gusty-Winds': 'May Exist' }
        });
        client.get('/signed', function (err, req, res, data) {
                t.ifError(err);
                t.ok(data);
                t.equal(data, 'request NOT signed');
                t.end();
        });
});


test('sign a request', function (t) {
        var called = 0;
        var signer = function sign(request) {
                called++;
                if (!request || !(request instanceof http.ClientRequest))
                        throw new Error('request must be an instance of ' +
                                        'http.ClientRequest');
                var gw = request.getHeader('X-Gusty-Winds');
                if (!gw)
                        throw new Error('X-Gusty-Winds header was not ' +
                                        'present in request');
                request.setHeader('X-Awesome-Signature', 'Gusty Winds ' + gw);
        };
        var client = restify.createClient({
                url: 'http://127.0.0.1:' + PORT,
                type: 'string',
                accept: 'text/plain',
                signRequest: signer,
                headers: { 'X-Gusty-Winds': 'May Exist' }
        });
        client.get('/signed', function (err, req, res, data) {
                t.ifError(err);
                t.ok(data);
                t.equal(called, 1);
                t.equal(data, 'ok: Gusty Winds May Exist');
                t.end();
        });
});
