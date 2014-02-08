var restify = require('./lib');

var srv = restify.createServer();
srv.use(restify.CORS());

function foo(req, res, next) {
    res.send(204);
    next();
}

srv.put('/foo', foo);
srv.get('/foo', foo);
srv.del('/foo', foo);
srv.post('/foo', foo);

srv.listen(8080);
