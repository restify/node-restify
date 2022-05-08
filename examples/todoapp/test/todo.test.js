// Copyright (c) 2012 Mark Cavage. All rights reserved.

var fs = require('fs');

var pino = require('pino');
var restify = require('restify');
var assert = require('chai').assert;

var todo = require('../lib');

///--- Globals

var DIR = '/tmp/.todo_unit_test';
var SOCK = '/tmp/.todo_sock';

///--- Tests

describe('todoapp', function () {
    var CLIENT;
    var SERVER;

    before(function (done) {
        var log = pino({
            name: 'todo_unit_test',
            level: process.env.LOG_LEVEL || 'info'
        });
    
        fs.mkdir(DIR, function(err) {
            if (err && err.code !== 'EEXIST') {
                console.error('unable to mkdir: ' + err.stack);
                process.exit(1);
            }
    
            SERVER = todo.createServer({
                directory: DIR,
                log: log.child({ component: 'server' }, true),
                noAudit: true
            });
    
            assert.ok(SERVER);
            SERVER.listen(SOCK, function() {
                CLIENT = todo.createClient({
                    log: log.child({ component: 'client' }, true),
                    socketPath: SOCK
                });
                assert.ok(CLIENT);
                done();
            });
        });    
    });

    it('should return an empty list', function (done) {
        CLIENT.list(function(err, todos) {
            assert.ifError(err);
            assert.ok(todos);
            assert.ok(Array.isArray(todos));
    
            if (todos) {
                assert.equal(todos.length, 0);
            }
            done();
        });
    });

    it('should create a new task', function (done) {
        var task = 'check that unit test works';
        CLIENT.create(task, function(err, todo) {
            assert.ifError(err);
            assert.ok(todo);
    
            if (todo) {
                assert.ok(todo.name);
                assert.equal(todo.task, task);
            }
            done();
        });
    });

    it('should list and get', function (done) {
        CLIENT.list(function(err, todos) {
            assert.ifError(err);
            assert.ok(todos);
            assert.ok(Array.isArray(todos));
    
            if (todos) {
                assert.equal(todos.length, 1);
                CLIENT.get(todos[0], function(err2, todo) {
                    assert.ifError(err2);
                    assert.ok(todo);
                    done();
                });
            } else {
                done();
            }
        });
    });

    it('should update', function (done) {
        CLIENT.list(function(err, todos) {
            assert.ifError(err);
            assert.ok(todos);
            assert.ok(Array.isArray(todos));
    
            if (todos) {
                assert.equal(todos.length, 1);
    
                var todo = {
                    name: todos[0],
                    task: 'something else'
                };
                CLIENT.update(todo, function(err2) {
                    assert.ifError(err2);
                    done();
                });
            } else {
                done();
            }
        });
    });

    after(function(done) {
        CLIENT.del(function(err) {
            assert.ifError(err);
            CLIENT.client.close();
            SERVER.close(function () {
                fs.rmdir(DIR, function(err) {
                    assert.ifError(err);
                    done();
                });
            });
        });
    });
});
