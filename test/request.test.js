'use strict';


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

var customFormatter = function ( req, res, body, formatterCb ) {
    return res.formatters['application/json']( req, res, body, formatterCb );
};

var customerFormatters = {
    'application/vnd.restify.extension+json;q=0.1;ext=hola': customFormatter
};

before(function (cb) {
    try {
        SERVER = restify.createServer({
            dtrace: helper.dtrace,
            log: helper.getLog('server'),
            formatters: customerFormatters
        });
        SERVER.listen(PORT, '127.0.0.1', function () {
            PORT = SERVER.address().port;
            CLIENT = restify.createJsonClient({
                url: 'http://127.0.0.1:' + PORT,
                dtrace: helper.dtrace,
                retry: false
            });

            cb();
        });
    } catch (e) {
        console.error(e.stack);
        process.exit(1);
    }
});


after(function (cb) {
    try {
        CLIENT.close();
        SERVER.close(function () {
            CLIENT = null;
            SERVER = null;
            cb();
        });
    } catch (e) {
        console.error(e.stack);
        process.exit(1);
    }
});


test('query should return empty string', function (t) {
    SERVER.get('/emptyQs', function (req, res, next) {
        t.equal(req.query(), '');
        t.equal(req.getQuery(), '');
        res.send();
        next();
    });

    CLIENT.get('/emptyQs', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});


test('query should return raw query string string', function (t) {
    SERVER.get('/qs', function (req, res, next) {
        t.equal(req.query(), 'a=1&b=2');
        t.equal(req.getQuery(), 'a=1&b=2');
        res.send();
        next();
    });

    CLIENT.get('/qs?a=1&b=2', function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        t.end();
    });
});


test('CH-1219 accept parameters allow customer formatters', function (t) {
    SERVER.get('/accepts', function (req, res, next) {
        var result = req.accepts( res.acceptable );
        res.send({ acceptable: result });
        next();
    });

    var req = {
        path: '/accepts',
        headers: {
            accept: 'application/vnd.restify.extension+json;ext=uhoh'
        }
    };

    CLIENT.get( req, function (err, _, res) {
        t.ifError(err);
        t.equal(res.statusCode, 200);
        var e = '{"acceptable":"application/vnd.restify.extension+json"}';
        t.equal(res.body, e);
        t.end();
    });
});

