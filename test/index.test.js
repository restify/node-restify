// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

var restify = require('../lib/index');

if (require.cache[__dirname + '/lib/helper.js'])
        delete require.cache[__dirname + '/lib/helper.js'];
var helper = require('./lib/helper.js');



///--- Globals

var realizeUrl = restify.realizeUrl;
var test = helper.test;



///--- Tests

test('realize', function (t) {
        var pattern = '/foo/:bar/:baz';

        t.equal(realizeUrl(pattern, {}), '/foo/:bar/:baz');
        t.equal(realizeUrl(pattern, {bar: 'BAR'}), '/foo/BAR/:baz');
        t.equal(realizeUrl(pattern, {bar: 'BAR', baz: 'BAZ'}), '/foo/BAR/BAZ');
        t.equal(realizeUrl(pattern, {bar: 'BAR', baz: 'BAZ', quux: 'QUUX'}),
                '/foo/BAR/BAZ');
        t.equal(realizeUrl('/foo////bar///:baz', {baz: 'BAZ'}),
                '/foo/bar/BAZ');

        t.end();
});

test('httpDate', function (t) {
        var d = restify.httpDate();
        var regex = /\w{3}, \d{1,2} \w{3} \d{4} \d{2}:\d{2}:\d{2} GMT/;
        t.ok(regex.test(d));
        t.end();
});
