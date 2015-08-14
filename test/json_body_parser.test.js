'use strict';

var restify = require('../lib');

if (require.cache[__dirname + '/lib/helper.js']) {
    delete require.cache[__dirname + '/lib/helper.js'];
}
var helper = require('./lib/helper.js');


///--- Globals

var test = helper.test;

test('reviver', function (t) {
    var jsonBodyParser = restify.plugins.jsonBodyParser;

    var parser = jsonBodyParser({
        bodyReader: true,
        reviver: function (key, value) {
            if (key === '') {
                return (value);
            }
            return (value + value);
        }
    })[0];

    var req = {
        getContentType: function () {
            return ('application/json');
        },
        body: JSON.stringify({
            apple: 'red',
            orange: 'orange',
            banana: 'yellow'
        }),
        params: {}
    };

    parser(req, null, function () {
        t.equal(req.params.apple, 'redred');
        t.equal(req.params.orange, 'orangeorange');
        t.equal(req.params.banana, 'yellowyellow');
        t.end();
    });
});

test('no reviver', function (t) {
    var jsonBodyParser = restify.plugins.jsonBodyParser;

    var parser = jsonBodyParser({
        bodyReader: true
    })[0];

    var req = {
        getContentType: function () {
            return ('application/json');
        },
        body: JSON.stringify({
            apple: 'red',
            orange: 'orange',
            banana: 'yellow'
        }),
        params: {}
    };

    parser(req, null, function () {
        t.equal(req.params.apple, 'red');
        t.equal(req.params.orange, 'orange');
        t.equal(req.params.banana, 'yellow');
        t.end();
    });
});

test('case-insensitive content-type', function (t) {
    var jsonBodyParser = restify.plugins.jsonBodyParser;

    var parser = jsonBodyParser({
        bodyReader: true
    })[0];

    var req = {
        getContentType: function () {
            return ('Application/Json');
        },
        body: JSON.stringify({
            apple: 'red',
            orange: 'orange',
            banana: 'yellow'
        }),
        params: {}
    };

    parser(req, null, function () {
        t.equal(req.params.apple, 'red');
        t.equal(req.params.orange, 'orange');
        t.equal(req.params.banana, 'yellow');
        t.end();
    });
});

