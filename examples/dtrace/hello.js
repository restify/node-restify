var restify = require('../../lib');

var server = restify.createServer({
    name: 'helloworld',
    dtrace: true
});

server.use(restify.plugins.acceptParser(server.acceptable));
server.use(restify.plugins.authorizationParser());
server.use(restify.plugins.dateParser());
server.use(restify.plugins.queryParser());
server.use(restify.plugins.urlEncodedBodyParser());

server.use(function slowHandler(req, res, next) {
    setTimeout(function() {
        next();
    }, 250);
});

server.get(
    {
        path: '/hello/:name',
        name: 'GetFoo'
    },
    function respond(req, res, next) {
        res.send({
            hello: req.params.name
        });
        next();
    }
);

server.listen(8080, function() {
    console.log('listening: %s', server.url);
});
