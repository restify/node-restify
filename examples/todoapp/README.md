# tl;dr

This is a (small) sample app using a reasonable subset of restify components to
illustrate how you go about structuring a restify application.  This is pretty
minimal, and most logic is contained in `server.js`; in reality, you'd probably
break up your logic into a set of files that are easier to maintain.  But for
the purpose of this app, that suffices.

# What is it?

I just cooked up a small "TODO" REST API.  You get a simple CRUD interface over
JSON on managing TODOs, and TODOs are stored locally on the file system.  The
code should be commented enough to help you make sense of it.

# What's included?

I cooked up a small server, and a small client wrapper to illustrate how I
usually use restify in my own projects;  typically, I have a server application
that does whatever API thing I need it to do, and I "wrap" the restify client(s)
as appropriate to deliver a "high-level" SDK that users can code against; note
I tend to try to hide HTTP when you're at that level so the system is easier to
work with.

I also cooked up a small set of unit tests using
[nodeunit](https://github.com/caolan/nodeunit), as several times questions have
come up as to how to mock, or unit test a restify service.  I typically
structure my app so that I can either:

- Run it on a UNIX Domain Socket as part of the unit test
- Just require an endpoint to be running, and pass it in as an env var

Here I chose the former option; run with `npm test`.

# How do I run this?

First, this has a `package.json`, so you'll need to run `npm install` in the
directory. Once you've done that, to get started _and_ see audit logs on your
terminal, run it like this:

    $ node main.js 2>&1 | npx pino-pretty

If you want to see all the built in restify tracing:

    $ node main.js -vv 2>&1 | npx pino-pretty

By default, this program writes to a directory in `/tmp`, but you can override
with a `-d` option.  Additionally, by default it does not require
authentication, but you can require that with:

    $ node main.js -u admin -z secret 2>&1 | npx pino-pretty

Lastly, re: the `2>&1 | npx pino-pretty` bit.  In production, you assuredly would *not*
want to pipe to the [pino-pretty](https://github.com/pinojs/pino-pretty) CLI, but
rather capture the audit records in their raw form, so they would be easy to
post process and perform analytics on.  Like all UNIX programs should, this
example writes "informational" messages to `stderr`, and `audit` records to
stdout.  It's up to you to redirect them as appropriate.


# Some sample curl requests

Let's get the full magilla (i.e., with auth) running:

    $ node main.js -u admin -z secret 2>&1 | npx pino-pretty

Also, before we go any further, install the
[json](https://github.com/trentm/json) tool as all the examples below use that.

## List Routes

    $ curl -isS http://127.0.0.1:8080 | json
    HTTP/1.1 200 OK
    Content-Type: application/todo
    Content-Length: 127
    Date: Sat, 29 Dec 2012 23:05:05 GMT
    Connection: keep-alive

    [
      "GET     /",
      "POST    /todo",
      "GET     /todo",
      "DELETE  /todo",
      "PUT     /todo/:name",
      "GET     /todo/:name",
      "DELETE  /todo/:name"
    ]


## List TODOs (empty)

    $ curl -isS http://127.0.0.1:8080/todo | json
    HTTP/1.1 200 OK
    Content-Type: application/todo
    Content-Length: 2
    Date: Sat, 29 Dec 2012 23:07:05 GMT
    Connection: keep-alive

    []


## Create TODO

    $ curl -isS http://127.0.0.1:8080/todo -X POST -d name=demo -d task="buy milk"
    HTTP/1.1 201 Created
    Content-Type: application/todo
    Content-Length: 8
    Date: Sat, 29 Dec 2012 23:08:04 GMT
    Connection: keep-alive

    buy milk

Aha! Note that here the `content-type` was `application/foo` because our server
set the `q-val` highest for that, and curl sets the `accept` header to `*/*`.


## List

    $ curl -isS http://127.0.0.1:8080/todo | json
    HTTP/1.1 200 OK
    Content-Type: application/todo
    Content-Length: 8
    Date: Sat, 29 Dec 2012 23:09:45 GMT
    Connection: keep-alive

    [
      "demo"
    ]


## Get TODO

Note here our server was setup to use streaming, and we explicitly opted for
JSON:

    $ curl -isS http://127.0.0.1:8080/todo/demo | json
    HTTP/1.1 200 OK
    Content-Type: application/json
    Date: Sat, 29 Dec 2012 23:11:19 GMT
    Connection: keep-alive
    Transfer-Encoding: chunked

    {
      "name": "demo",
      "task": "buy milk"
    }

However, we still supported the full negotiation via another means:

    $ curl -isS -H accept:application/todo http://127.0.0.1:8080/todo/demo
    HTTP/1.1 200 OK
    Content-Type: application/todo
    Content-Length: 8
    Date: Sat, 29 Dec 2012 23:14:31 GMT
    Connection: keep-alive

    buy milk


## Delete all

    $ curl -isS -X DELETE http://127.0.0.1:8080/todo/demo
    HTTP/1.1 204 No Content
    Date: Sat, 29 Dec 2012 23:15:50 GMT
    Connection: keep-alive
