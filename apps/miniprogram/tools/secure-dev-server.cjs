/*
 * Taro 4.3.2 still injects webpack-dev-server v4's `https: false` option.
 * Keep the patched v5 server and normalize that removed option at this one
 * development entry point. Production builds do not preload this adapter.
 */
const resolved = require.resolve('webpack-dev-server');
const OriginalServer = require(resolved);
const version = require('webpack-dev-server/package.json').version;
if (!version.startsWith('5.') || typeof OriginalServer !== 'function') {
  throw new Error('Review the Taro H5 compatibility adapter before changing webpack-dev-server major versions.');
}
class TaroSecureDevServer extends OriginalServer {
  constructor(options, compiler) {
    const { https, http2, ...safe } = options || {};
    if ((https !== undefined && https !== false) || (http2 !== undefined && http2 !== false)) {
      throw new Error('This local H5 development adapter only supports HTTP on loopback; use the production HTTPS reverse proxy for deployment.');
    }
    const requestedPort = process.env.TARO_H5_DEV_PORT;
    const port = requestedPort ? Number(requestedPort) : safe.port;
    if (requestedPort && (!Number.isInteger(port) || port < 1024 || port > 65535)) {
      throw new Error('TARO_H5_DEV_PORT must be an integer port from 1024 to 65535.');
    }
    super({ ...safe, port, server: 'http', host: '127.0.0.1', allowedHosts: ['127.0.0.1', 'localhost'], open: false }, compiler);
  }
}
require.cache[resolved].exports = TaroSecureDevServer;
