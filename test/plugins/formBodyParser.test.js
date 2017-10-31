'use strict';
/* eslint-disable func-names */

// core requires
var http = require('http');

// external requires
var assert = require('chai').assert;
var restify = require('../../lib/index.js');

// local files
var helper = require('../lib/helper');

// local globals
var SERVER;
var PORT;

describe('form body parser', function() {
    beforeEach(function(done) {
        SERVER = restify.createServer({
            dtrace: helper.dtrace,
            log: helper.getLog('server')
        });

        SERVER.listen(0, '127.0.0.1', function() {
            PORT = SERVER.address().port;
            done();
        });
    });

    afterEach(function(done) {
        SERVER.close(done);
    });

    it('should parse req.body, req.query, req.params', function(done) {
        SERVER.use(restify.plugins.queryParser());
        SERVER.use(restify.plugins.bodyParser());

        SERVER.post('/bodyurl2/:id', function(req, res, next) {
            assert.equal(req.query.name, 'markc');
            assert.equal(req.params.id, 'foo');
            assert.equal(req.body.name, 'somethingelse');
            assert.equal(req.body.phone, '(206) 555-1212');
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
        var client = http.request(opts, function(res) {
            assert.equal(res.statusCode, 200);
            done();
        });
        client.write('phone=(206)%20555-1212&name=somethingelse');
        client.end();
    });

    it('should map req.body & req.query onto req.params', function(done) {
        SERVER.use(
            restify.plugins.queryParser({
                mapParams: true
            })
        );
        SERVER.use(
            restify.plugins.bodyParser({
                mapParams: true
            })
        );

        SERVER.post('/bodyurl2/:id', function(req, res, next) {
            assert.equal(req.query.name, 'markc');

            assert.equal(req.body.phone, '(206) 555-1212');
            assert.equal(req.body.name, 'somethingelse');

            assert.equal(req.params.id, 'foo');
            assert.equal(req.params.name, 'markc');
            assert.equal(req.params.phone, '(206) 555-1212');

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
        var client = http.request(opts, function(res) {
            assert.equal(res.statusCode, 200);
            done();
        });
        client.write('phone=(206)%20555-1212&name=somethingelse');
        client.end();
    });

    it('should take req.body and stomp on req.params', function(done) {
        SERVER.use(
            restify.plugins.queryParser({
                mapParams: true
            })
        );
        SERVER.use(
            restify.plugins.bodyParser({
                mapParams: true,
                overrideParams: true
            })
        );

        SERVER.post('/bodyurl2/:id', function(req, res, next) {
            assert.equal(req.query.name, 'markc');

            assert.equal(req.body.phone, '(206) 555-1212');
            assert.equal(req.body.name, 'somethingelse');

            assert.equal(req.params.id, 'foo');
            assert.equal(req.params.name, 'somethingelse');
            assert.equal(req.params.phone, '(206) 555-1212');

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
        var client = http.request(opts, function(res) {
            assert.equal(res.statusCode, 200);
            done();
        });
        client.write('phone=(206)%20555-1212&name=somethingelse');
        client.end();
    });

    it('should parse associative array syntax', function(done) {
        SERVER.use(restify.plugins.bodyParser());

        SERVER.post('/bodyurl2/:id', function(req, res, next) {
            assert.isObject(req.body.name);
            assert.equal(req.body.name.first, 'alex');
            assert.equal(req.body.name.last, 'liu');
            res.send();
            next();
        });

        var opts = {
            hostname: '127.0.0.1',
            port: PORT,
            path: '/bodyurl2/foo',
            agent: false,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };
        var client = http.request(opts, function(res) {
            assert.equal(res.statusCode, 200);
            done();
        });
        client.write('name[first]=alex&name[last]=liu');
        client.end();
    });

    it('should parse array syntax', function(done) {
        SERVER.use(restify.plugins.bodyParser());

        SERVER.post('/bodyurl2/:id', function(req, res, next) {
            assert.isArray(req.body.meat);
            assert.deepEqual(req.body.meat, ['ham', 'bacon']);
            res.send();
            next();
        });

        var opts = {
            hostname: '127.0.0.1',
            port: PORT,
            path: '/bodyurl2/foo',
            agent: false,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };
        var client = http.request(opts, function(res) {
            assert.equal(res.statusCode, 200);
            done();
        });
        client.write('meat[]=ham&meat[]=bacon');
        client.end();
    });

    it('should parse nested array syntax', function(done) {
        SERVER.use(restify.plugins.bodyParser());

        SERVER.post('/bodyurl2/:id', function(req, res, next) {
            assert.isObject(req.body.pizza);
            assert.isArray(req.body.pizza.left);
            assert.isArray(req.body.pizza.right);
            assert.deepEqual(req.body.pizza.left, ['ham', 'bacon']);
            assert.deepEqual(req.body.pizza.right, ['pineapple']);
            res.send();
            next();
        });

        var opts = {
            hostname: '127.0.0.1',
            port: PORT,
            path: '/bodyurl2/foo',
            agent: false,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };
        var client = http.request(opts, function(res) {
            assert.equal(res.statusCode, 200);
            done();
        });
        var p =
            'pizza[left][]=ham&pizza[left][]=bacon&' +
            'pizza[right][]=pineapple';
        client.write(p);
        client.end();
    });

    it('plugins-GH-6: should expose rawBody', function(done) {
        var input = 'name[first]=alex&name[last]=liu';

        SERVER.use(restify.plugins.bodyParser());

        SERVER.post('/bodyurl2/:id', function(req, res, next) {
            assert.equal(req.rawBody, input);
            res.send();
            next();
        });

        var opts = {
            hostname: '127.0.0.1',
            port: PORT,
            path: '/bodyurl2/foo',
            agent: false,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };
        var client = http.request(opts, function(res) {
            assert.equal(res.statusCode, 200);
            done();
        });
        client.write(input);
        client.end();
    });
});
