# SPDY to HTTP/2 Migration Guide

## Overview

This guide helps you migrate from the deprecated SPDY support to native HTTP/2 support in Restify. SPDY support has been deprecated and will be removed in a future major version.

## Why Migrate?

### SPDY is Deprecated
- SPDY was an experimental protocol that preceded HTTP/2
- HTTP/2 is the official successor to SPDY and is widely supported
- Node.js has native HTTP/2 support since version 8.8.0
- The `spdy` npm package is no longer actively maintained and has security concerns

### Benefits of HTTP/2
- **Native Support**: Uses Node.js built-in HTTP/2 module instead of external dependencies
- **Better Performance**: Improved multiplexing and header compression
- **Security**: More secure implementation with regular updates
- **Compatibility**: Better browser and client support
- **Future-Proof**: HTTP/2 is the current standard with ongoing development

### Node.js HTTP Parser Evolution
- **Legacy**: `http_parser` (deprecated)
- **Current**: `llhttp` (default since Node.js 12.0.0) - significantly faster and more maintainable
- **Future**: Native HTTP/2 and HTTP/3 support

## Migration Steps

### 1. Update Your Server Configuration

**Before (SPDY - DEPRECATED):**
```javascript
const restify = require('restify');
const fs = require('fs');

const server = restify.createServer({
    spdy: {
        cert: fs.readFileSync('path/to/cert.pem'),
        key: fs.readFileSync('path/to/key.pem'),
        ca: fs.readFileSync('path/to/ca.pem')
    }
});
```

**After (HTTP/2 - RECOMMENDED):**
```javascript
const restify = require('restify');
const fs = require('fs');

const server = restify.createServer({
    http2: {
        cert: fs.readFileSync('path/to/cert.pem'),
        key: fs.readFileSync('path/to/key.pem'),
        ca: fs.readFileSync('path/to/ca.pem'),
        allowHTTP1: true  // Enable HTTP/1.1 fallback for compatibility
    }
});
```

### 2. Key Differences

| Feature | SPDY | HTTP/2 |
|---------|------|--------|
| Protocol | `spdy://` | `https://` |
| Node.js Support | External package | Native (8.8.0+) |
| Performance | Good | Better |
| Browser Support | Limited | Excellent |
| Security Updates | Infrequent | Regular |

### 3. Configuration Options

The HTTP/2 options are similar to SPDY but with additional features:

```javascript
const server = restify.createServer({
    http2: {
        // SSL Certificate options (same as SPDY)
        cert: fs.readFileSync('cert.pem'),
        key: fs.readFileSync('key.pem'),
        ca: fs.readFileSync('ca.pem'),
        
        // HTTP/2 specific options
        allowHTTP1: true,              // Allow HTTP/1.1 fallback
        maxSessionMemory: 10000,       // Max memory per session
        maxDeflateDynamicTableSize: 4096, // Header compression table size
        maxSettings: 32,               // Max number of settings per session
        maxHeaderListPairs: 128,       // Max header pairs per request
        maxOutstandingPings: 10,       // Max outstanding ping frames
        maxSendHeaderBlockLength: 65536, // Max header block size
        
        // Performance tuning
        paddingStrategy: require('http2').constants.PADDING_STRATEGY_NONE,
        settings: {
            headerTableSize: 4096,
            enablePush: false,         // Disable server push (recommended)
            maxConcurrentStreams: 100,
            initialWindowSize: 65535,
            maxFrameSize: 16384,
            maxHeaderListSize: 8192
        }
    }
});
```

## Breaking Changes

### 1. URL Protocol
- **SPDY**: `server.url` returns `spdy://localhost:8080`
- **HTTP/2**: `server.url` returns `https://localhost:8080`

### 2. Server Properties
- **SPDY**: `server.spdy` property is set to `true`
- **HTTP/2**: `server.http2` property is set to `true`

### 3. Dependencies
- Remove `spdy` from your `package.json` dependencies
- No new dependencies needed (HTTP/2 is built into Node.js)

## Migration Examples

### Basic HTTP/2 Server
```javascript
const restify = require('restify');
const fs = require('fs');

const server = restify.createServer({
    http2: {
        cert: fs.readFileSync('./ssl/cert.pem'),
        key: fs.readFileSync('./ssl/key.pem'),
        allowHTTP1: true
    }
});

server.get('/', (req, res, next) => {
    res.send({ message: 'Hello HTTP/2!' });
    return next();
});

server.listen(8080, () => {
    console.log('%s listening at %s', server.name, server.url);
});
```

### Advanced Configuration with Performance Tuning
```javascript
const restify = require('restify');
const http2 = require('http2');
const fs = require('fs');

const server = restify.createServer({
    http2: {
        cert: fs.readFileSync('./ssl/cert.pem'),
        key: fs.readFileSync('./ssl/key.pem'),
        allowHTTP1: true,
        maxSessionMemory: 20000,
        settings: {
            enablePush: false,  // Server push is generally not recommended
            maxConcurrentStreams: 200,
            initialWindowSize: 1024 * 1024, // 1MB
            maxFrameSize: 32768,
            maxHeaderListSize: 16384
        },
        paddingStrategy: http2.constants.PADDING_STRATEGY_ALIGNED
    },
    // Other restify options
    name: 'MyHTTP2API',
    version: '1.0.0'
});
```

## Testing Your Migration

### 1. Verify HTTP/2 is Working
```bash
# Test with curl (requires curl 7.46+ with HTTP/2 support)
curl -I --http2 https://localhost:8080/

# You should see: HTTP/2 200
```

### 2. Browser Testing
Open your browser's developer tools and check the Network tab. You should see `h2` in the Protocol column.

### 3. Node.js Client Testing
```javascript
const http2 = require('http2');

const client = http2.connect('https://localhost:8080', {
    rejectUnauthorized: false  // Only for self-signed certificates
});

const req = client.request({
    ':method': 'GET',
    ':path': '/'
});

req.on('response', (headers) => {
    console.log('HTTP/2 Response received:', headers[':status']);
});

req.on('data', (chunk) => {
    console.log(chunk.toString());
});

req.end();
```

## Deprecation Timeline

- **Current Version**: SPDY support is deprecated with warning messages
- **Next Minor Version**: SPDY support will continue to work but with deprecation warnings
- **Next Major Version**: SPDY support will be completely removed

## Troubleshooting

### Common Issues

1. **"http2 module is not available" Error**
   - **Cause**: Node.js version < 8.8.0
   - **Solution**: Upgrade Node.js to version 10+ (recommended)

2. **SSL Certificate Issues**
   - **Cause**: Invalid or missing SSL certificates
   - **Solution**: Ensure valid SSL certificates are provided for both SPDY and HTTP/2

3. **Client Compatibility**
   - **Cause**: Older clients may not support HTTP/2
   - **Solution**: Use `allowHTTP1: true` for backward compatibility

### Performance Tips

1. **Disable Server Push**: Set `enablePush: false` in settings
2. **Tune Concurrent Streams**: Adjust `maxConcurrentStreams` based on your needs
3. **Optimize Header Compression**: Configure `headerTableSize` appropriately
4. **Use Connection Pooling**: Reuse HTTP/2 connections in clients

## Need Help?

- [Restify Documentation](http://restify.com)
- [Node.js HTTP/2 Documentation](https://nodejs.org/api/http2.html)
- [HTTP/2 Specification (RFC 7540)](https://httpwg.org/specs/rfc7540.html)
- [Restify GitHub Issues](https://github.com/restify/node-restify/issues)

## Example Migration Commit

Here's a complete example of migrating an existing SPDY server:

```diff
- const server = restify.createServer({
-     spdy: {
-         cert: fs.readFileSync('./ssl/cert.pem'),
-         key: fs.readFileSync('./ssl/key.pem')
-     }
- });

+ const server = restify.createServer({
+     http2: {
+         cert: fs.readFileSync('./ssl/cert.pem'),
+         key: fs.readFileSync('./ssl/key.pem'),
+         allowHTTP1: true
+     }
+ });
```

```diff
- "dependencies": {
-     "restify": "^11.2.0",
-     "spdy": "^4.0.0"
- }

+ "dependencies": {
+     "restify": "^11.2.0"
+ }
```

This migration will improve your application's performance, security, and future compatibility!