var bunyan = require('bunyan');
var restify = require('restify');

//
// You can use the DTrace script in this directory, by invoking
// $ sudo ./hello.d
//
// Run a few requests like curl -s http://localhost:8080/hello/world
// through this and then ctrl-c the DTrace process
//

var log = bunyan.createLogger({
        level: 'info',
        name: 'hello',
        stream: process.stdout
});

var server = restify.createServer({
        log: log,
        name: 'hello'
});

server.on('after', restify.auditLogger({log: log}));

server.get('/hello/:name', function respond(req, res, next) {
        res.send('hello ' + req.params.name);
        next();
});

server.listen(8080, function() {
        log.info('%s listening at %s', server.name, server.url);
});
