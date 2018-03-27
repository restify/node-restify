Restify comes bundled with a selection of useful formatters that prepare your
responses for being sent over the wire, but you are free to include your own!

```js
function formatGraphQL(req, res, body) {
    var data = body;
    /* Do a thing to data */
    res.setHeader('Content-Length', Buffer.byteLength(data));
    return data;
}

var server = restify.createServer({
    formatters: {
        'application/graphql': formatGraphQL
    }
});

// Your application now supports content-type 'application/graphql'
```
