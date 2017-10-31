'use strict';
/* eslint-disable func-names */

var mergeQs = require('../lib/utils').mergeQs;

if (require.cache[__dirname + '/lib/helper.js']) {
    delete require.cache[__dirname + '/lib/helper.js'];
}
var helper = require('./lib/helper.js');

///--- Globals

var test = helper.test;

test('merge qs', function(t) {
    var qs1 = mergeQs(undefined, { a: 1 });
    t.deepEqual(qs1, { a: 1 });

    var qs2 = mergeQs({ a: 1 }, null);
    t.deepEqual(qs2, { a: 1 });

    var qs3 = mergeQs({ a: 1 }, { a: 2 });
    t.deepEqual(qs3, { a: [1, 2] });

    var qs4 = mergeQs({ a: 1 }, { b: 2 });
    t.deepEqual(qs4, { a: 1, b: 2 });

    var qs5 = mergeQs(null, null);
    t.deepEqual(qs5, {});

    t.done();
});
