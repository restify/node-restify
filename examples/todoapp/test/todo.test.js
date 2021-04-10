// Copyright (c) 2012 Mark Cavage. All rights reserved.

var fs = require('fs');

var pino = require('pino');
var restify = require('restify');

var todo = require('../lib');

///--- Globals

var CLIENT;
var DIR = '/tmp/.todo_unit_test';
var SERVER;
var SOCK = '/tmp/.todo_sock';

///--- Tests

exports.setup = function(t) {
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

        t.ok(SERVER);
        SERVER.listen(SOCK, function() {
            CLIENT = todo.createClient({
                log: log.child({ component: 'client' }, true),
                socketPath: SOCK
            });
            t.ok(CLIENT);
            t.done();
        });
    });
};

exports.listEmpty = function(t) {
    CLIENT.list(function(err, todos) {
        t.ifError(err);
        t.ok(todos);
        t.ok(Array.isArray(todos));

        if (todos) {
            t.equal(todos.length, 0);
        }
        t.done();
    });
};

exports.create = function(t) {
    var task = 'check that unit test works';
    CLIENT.create(task, function(err, todo) {
        t.ifError(err);
        t.ok(todo);

        if (todo) {
            t.ok(todo.name);
            t.equal(todo.task, task);
        }
        t.done();
    });
};

exports.listAndGet = function(t) {
    CLIENT.list(function(err, todos) {
        t.ifError(err);
        t.ok(todos);
        t.ok(Array.isArray(todos));

        if (todos) {
            t.equal(todos.length, 1);
            CLIENT.get(todos[0], function(err2, todo) {
                t.ifError(err2);
                t.ok(todo);
                t.done();
            });
        } else {
            t.done();
        }
    });
};

exports.update = function(t) {
    CLIENT.list(function(err, todos) {
        t.ifError(err);
        t.ok(todos);
        t.ok(Array.isArray(todos));

        if (todos) {
            t.equal(todos.length, 1);

            var todo = {
                name: todos[0],
                task: 'something else'
            };
            CLIENT.update(todo, function(err2) {
                t.ifError(err2);
                t.done();
            });
        } else {
            t.done();
        }
    });
};

exports.teardown = function teardown(t) {
    CLIENT.del(function(err) {
        t.ifError(err);

        SERVER.once('close', function() {
            fs.rmdir(DIR, function(err) {
                t.ifError(err);
                t.done();
            });
        });
        SERVER.close();
    });
};
