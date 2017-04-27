{% macro oneThirdWidthColumn() %}
  <div class="col-sm-4">
    {% markdown %}
      {{ caller() }}
    {% endmarkdown %}
  </div>
{% endmacro %}

<!-- 3 column layout -->
<div class="row row-gap-medium">
  {% call oneThirdWidthColumn() %}
    ## API Focused

    Restify is designed to do one thing and do it well: build RESTful web service APIs. Construct your API quickly while keeping the code lean and maintainable.
  {% endcall %}
  {% call oneThirdWidthColumn() %}
    ## Automatic DTrace

    Restify ships with full [dtrace](http://en.wikipedia.org/wiki/DTrace "DTrace") support on platforms that support DTrace. It automatically creates DTrace probes for each route or handler so you can easily generate reports for deep analysis.
  {% endcall %}
  {% call oneThirdWidthColumn() %}
    ## Client, Server, & Plugins

    Restify includes a comprehensive server component as well as a client for server-to-server communication and a set of plugins for advanced behavior configuration.
  {% endcall %}
</div>

## About restify

Restify is a node.js module built specifically to enable you to build correct
REST web services.  It has a thorough yet streamlined API and is simple to get started with whether you're new to node or have used modules like express.

```bash
$ npm install restify
```

If you're migrating from an earlier version of restify, see [1.4 to 2.0 Migration Tips](https://github.com/restify/node-restify/wiki/1.4-to-2.0-Migration-Tips)



{# commented out, likely will be removed in the future

## Why use restify and not express?

I get asked this more than anything else, so I'll just get it out of
the way up front.

Express' use case is targeted at browser applications and contains a
lot of functionality, such as templating and rendering, to support that.
Restify does not.

Restify exists to let you build "strict" API
services that are maintainable and observable. Restify comes with automatic
[DTrace](http://en.wikipedia.org/wiki/DTrace) support for all your
handlers, if you're running on a platform that supports DTrace.

In short, I wrote restify as I needed a framework that
gave me absolute control over interactions with HTTP and full
observability into the latency and characteristics of my
applications.  If you don't need that, or don't care about those
aspect(s), then it's probably not for you.

## About this guide - FIXUP

This guide provides comprehensive documentation on writing a REST api (server)
with restify, writing clients that easily consume REST APIs, and on
the DTrace integration present in restify.

Note this documentation refers to the 2.x version(s) of restify;
these versions are not backwards-compatible with the 0.x and 1.x versions.

If you're migrating from an earlier version of restify, see
[1.4 to 2.0 Migration Tips](https://github.com/restify/node-restify/wiki/1.4-to-2.0-Migration-Tips)

## Conventions

Any content formatted like this:

```bash
$ curl localhost:8080
```

is a command-line example that you can run from a shell.  All other examples
and information is formatted like this:

```bash
GET /foo HTTP/1.1
```
 #}




