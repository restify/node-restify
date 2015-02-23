/**
 * Module dependencies
 */

if (require.cache[__dirname + '/lib/helper.js']) {
    delete require.cache[__dirname + '/lib/helper.js'];
}

var restify = require('../lib');
var fs = require('fs');
var helper = require('./lib/helper.js');
var before = helper.before;
var after = helper.after;
var test = helper.test;

/**
 * Globals
 */

var fsOptions = { encoding: 'utf8' };

var PORT = process.env.UNIT_TEST_PORT || 3333;
var CLIENT;
var SERVER;
var DATA_CSV = fs.readFileSync(__dirname + '/files/data-csv.txt', fsOptions);
var DATA_TSV = fs.readFileSync(__dirname + '/files/data-tsv.txt', fsOptions);
var OBJECT_CSV = require(__dirname + '/files/object-csv.json');
var OBJECT_TSV = require(__dirname + '/files/object-tsv.json');

/**
 * Tests
 */

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
        SERVER.use(restify.bodyParser());
        SERVER.post('/data', function respond(req, res, next) {
            res.send({
                status: 'okay',
                parsedReq: req.body
            });
            return (next());
        });
        SERVER.listen(PORT, '127.0.0.1', function () {
            CLIENT = restify.createClient({
                url: 'http://127.0.0.1:' + PORT,
                dtrace: helper.dtrace,
                retry: false,
                agent: false
            });
            callback();
        });
    } catch (e) {
        console.error(e.stack);
        process.exit(1);
    }
});

after(function (callback) {
    try {
        CLIENT.close();
        SERVER.close(callback);
    } catch (e) {
        console.error(e.stack);
        process.exit(1);
    }
});

test('Parse CSV body', function (t) {
    var options = {
        path: '/data',
        headers: {
            'Content-Type': 'text/csv'
        }
    };
    CLIENT.post(options, function (err, req) {
        t.ifError(err);
        req.on('result', function (errReq, res) {
            t.ifError(errReq);
            res.body = '';
            res.setEncoding('utf8');
            res.on('data', function (chunk) {
                res.body += chunk;
            });
            res.on('end', function () {
                res.body = JSON.parse(res.body);
                var parsedReqStr = JSON.stringify(res.body.parsedReq);
                var objectStr = JSON.stringify(OBJECT_CSV);
                t.equal(parsedReqStr, objectStr);
                t.end();
            });
        });
        req.write(DATA_CSV);
        req.end();
    });
});

test('Parse TSV body', function (t) {
    var options = {
        path: '/data',
        headers: {
            'Content-Type': 'text/tsv'
        }
    };
    CLIENT.post(options, function (err, req) {
        t.ifError(err);
        req.on('result', function (errReq, res) {
            t.ifError(errReq);
            res.body = '';
            res.setEncoding('utf8');
            res.on('data', function (chunk) {
                res.body += chunk;
            });
            res.on('end', function () {
                res.body = JSON.parse(res.body);
                var parsedReqStr = JSON.stringify(res.body.parsedReq);
                var objectStr = JSON.stringify(OBJECT_TSV);
                t.equal(parsedReqStr, objectStr);
                t.end();
            });
        });
        req.write(DATA_TSV);
        req.end();
    });
});
