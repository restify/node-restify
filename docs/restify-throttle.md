restify-throttle(7) -- Rate Limiting
====================================

## SYNOPSIS

    var ipThrottle = restify.createThrottle({
      burst: 10,
      rate: 3,
      ip: true,
      overrides: {
        '127.0.0.1': {
          burst: 0,
          rate: 0
        },
        '10.1.2.3': {
          burst: 100,
          rate: 10
        }
      }
    });


## DESCRIPTION

Restify supports a standard Token Bucket throttling interceptor.  If you're not
familiar with Token Bucket, see http://en.wikipedia.org/wiki/Token_bucket .
Basically, you define a steady state rate of requests per second (can be < 1,
so for example 0.5 would be 1 request every 2 seconds) and a 'burst' rate.  The
burst rate is what a client can burst to if there are sufficient tokens (again,
reference the token bucket algorithm).

Restify supports throttling on IP address (/32 matching), X-Forwarded-For (also
/32 matching) and username.  IP is appropriate to use as the very first
interceptor in a `pre` chain (or XFF, if you're behind a terminating LB that's
sending them and you trust it).  The address is checked against
`req.connection.remoteAddress` (or `req.headers['x-forwarded-for']`).  Throttles
of type `username` are appropriate to be placd in your `pre` chain after an
authentication step (i.e., otherwise how do you know what the user is).

If you pass in a boolean to the configuration object for the 'type', a token
bucket is tracked per client.  If you pass in a string, the throttle will only
apply to a request matching that exact IP/XFF/username.  The most common usage
is to set it as a boolean 'true', so you get blanket throttling for all seen
clients; you can then pass in an overrides object as shown above to parameterize
differently for different clients.

Throttling by restify will return an HTTP Status Code of 420 (like Twitter).

Note that the interceptor returned by `createdThrottle` is expected to be run in
 a `pre` chain; that is it will call next() regardless of whether the request is
allowed or denied.

Lastly, the `TokenBucket` API restify uses is exposed, if the throttling
interceptor as written doesn't meet your needs.  Check out the source to get a
feel for how to use it.

## SECURITY CONSIDERATIONS

X-Forwarded-For should only be used in circumstances where you know the agent
"nearest" to your server is sending the header correctly.  That is, there's
nothing preventing a client on the WAN from spoofing the XFF header.  Really,
unless you know you need to use it because you have a terminating proxy in front
of your application, don't use it.

## COPYRIGHT/LICENSE

Copyright 2011 Mark Cavage <mcavage@gmail.com>

This software is licensed under the MIT License.

## SEE ALSO

restify(3)
