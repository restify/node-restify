'use strict';

var utils = require('../lib/utils.js');
var mergeQs = utils.mergeQs;
var sanitizePath = utils.sanitizePath;

if (require.cache[__dirname + '/lib/helper.js']) {
    delete require.cache[__dirname + '/lib/helper.js'];
}
var helper = require('./lib/helper.js');

///--- Globals

var test = helper.test;


test('merge qs', function (t) {
    var qs1 = mergeQs(undefined, { a: 1 });
    t.deepEqual(qs1, { a: 1 });

    var qs2 = mergeQs({ a: 1 }, null);
    t.deepEqual(qs2, { a: 1 });

    var qs3 = mergeQs({ a: 1 }, { a: 2 });
    t.deepEqual(qs3, { a: [ 1, 2 ] });

    var qs4 = mergeQs({ a: 1 }, { b: 2 });
    t.deepEqual(qs4, { a: 1, b: 2 });

    var qs5 = mergeQs(null, null);
    t.deepEqual(qs5, {});

    t.done();
});

test('sanitizePath', function (t) {
    // Ensure it santizies potential edge cases correctly
    var tests = {
        input: [
            '////foo////', //excess padding on both ends
            'bar/foo/', // trailing slash
            'bar/foo/////', // multiple trailing slashes
            'foo////bar', // multiple slashes inbetween
            '////foo', // multiple at beginning
            '/foo/bar' // don't mutate
        ],
        output: [
            '/foo',
            'bar/foo',
            'foo/bar',
            '/foo',
            '/foo/bar'
        ]
    };

    for (var i = 0; i < tests; i++) {
        t.equal(sanitizePath(tests.input[i]), tests.output[i]);
    }

    t.done();
});
