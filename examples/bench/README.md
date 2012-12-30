# tl;dr

I get asked *all the time* to compare restify and express.  Here's a trivial
"microbenchmark" of restify 1.4.4, restify 2.0.0 and express 3.0.5. In all
honesty, I think this is not tremendously useful, as `ab` is notoriously
unreliable, and in particular, both restify and express will let you build a
fast application, and in the real world you are far more likely to be I/O bound.

That said, we can clearly see a massive throughput gain in restify 2.0 over 1.4.
The latency profile is very similar in all three tests cases, which is expected
(i.e., it's driven by node).

# Sample code

Simple ability to switch between restify/express:

    var server = require('restify').createServer();
    //var server = require('express')();

    server.get('/echo/:name', function (req, res, next) {
        res.setHeader('content-type', 'text/plain');
        res.send(200, req.params.name);
    });

    server.listen(8080, function () {
        console.log('ready');
    });

Note there is no use of the `cluster` api, so in all cases we expect
to (easily) overwhelm the V8 event thread.

# Command

All tests were run using node 0.8.15 on [SmartOS](http://smartos.org/) in a
VMWare VM, and each set was run at least 3 times; outliers were discarded,
and the "average" of each test run was recorded below.

Just using `ab` on localhost, the results of the following command
were tracked at varying concurrency levels:

    $ ab -k -c N -n 50000 http://127.0.0.1:8080/echo/mark

Only RPS and P99 latency was tracked (mean, median and average are mostly
useless in the real world).

# Results

## Restify 1.4.4

<table>
  <tr>
    <td>Concurrency</td>
    <td>Requests/Second</td>
    <td>P99 Latency (ms)</td>
  </tr>
  <tr>
    <td>10</td>
    <td>3806.33</td>
    <td>5</td>
  </tr>
  <tr>
    <td>50</td>
    <td>3842.84</td>
    <td>22</td>
  </tr>
  <tr>
    <td>100</td>
    <td>3850.95</td>
    <td>34</td>
  </tr>
  <tr>
    <td>500</td>
    <td>3707.68</td>
    <td>158</td>
  </tr>
  <tr>
    <td>1000</td>
    <td>3560.86</td>
    <td>3564</td>
  </tr>
</table>

## Restify 2.0.0

<table>
  <tr>
    <td>Concurrency</td>
    <td>Requests/Second</td>
    <td>P99 Latency (ms)</td>
  </tr>
  <tr>
    <td>10</td>
    <td>6293.61</td>
    <td>2</td>
  </tr>
  <tr>
    <td>50</td>
    <td>6249.21</td>
    <td>12</td>
  </tr>
  <tr>
    <td>100</td>
    <td>6073.08</td>
    <td>20</td>
  </tr>
  <tr>
    <td>500</td>
    <td>5653.52</td>
    <td>105</td>
  </tr>
  <tr>
    <td>1000</td>
    <td>5657.44</td>
    <td>3490</td>
  </tr>
</table>


## Express 3.0.5

<table>
  <tr>
    <td>Concurrency</td>
    <td>Requests/Second</td>
    <td>P99 Latency (ms)</td>
  </tr>
  <tr>
    <td>10</td>
    <td>6057.91</td>
    <td>3</td>
  </tr>
  <tr>
    <td>50</td>
    <td>5781.69</td>
    <td>11</td>
  </tr>
  <tr>
    <td>100</td>
    <td>5533.35</td>
    <td>24</td>
  </tr>
  <tr>
    <td>500</td>
    <td>5300.36</td>
    <td>114</td>
  </tr>
  <tr>
    <td>1000</td>
    <td>5261.26</td>
    <td>3512</td>
  </tr>
</table>
