node-restify is meant to do one thing: make it easy to build an API webservice
in node.js that is correct as per the HTTP RFC. That's it. It's not MVC, it
doesn't bring in a lot of baggage, it's just a small framework to let you
build a web service API.

## Why does this exist?

After starting with express for several backend, machine-consumed projects
it because obvious I only needed about 10% of what connect gives you, and the
parts they gave me still required  writing a lot of extension code over the top
to do what I needed (mainly properly parse request parameters and respond with
JS objects).

I wanted something smaller and more purposed to this use case.  If this isn't
you, move along, nothing to see here.

## Usage

    var restify = require('restify');

    var server = restify.createServer();

    server.get('/my/:name', function(req, res) {
      res.send(200, {
        name: req.uriParams.name
      });
    });

    server.post('/my', function(req, res) {
      // name could be in the query string, in a form-urlencoded body, or a
      // JSON body
      res.send(201, {
        name: req.params.name
      });
    });

    server.del('/my/:name', function(req, res) {
      res.send(204);
    });

    server.listen(8080);

## Installation

    npm install restify

## For More Information

See <http://mcavage.github.com/node-restify>.

## License

MIT.

## Bugs

See <https://github.com/mcavage/node-restify/issues>.
