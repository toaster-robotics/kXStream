import express from 'express';
import { existsSync, readFileSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { join, resolve } from 'node:path';
import { createWebBackendApp } from './app/web-backend-app';

const port = Number(process.env['PORT'] ?? 3000);
const app = createWebBackendApp();

// Single-container deploy (e.g. Unraid Docker): when PUBLIC_DIR points at the
// built Angular PWA, serve it from the same origin as the API + /cast endpoint.
// Keeping the app and backend on one origin avoids browser CORS/mixed-content
// issues when casting to a LAN Kodi box over plain HTTP.
const publicDir = process.env['PUBLIC_DIR']
    ? resolve(process.env['PUBLIC_DIR'])
    : undefined;
if (publicDir && existsSync(publicDir)) {
    const indexHtml = join(publicDir, 'index.html');
    app.use(express.static(publicDir));
    // SPA fallback: any unmatched GET returns index.html so client-side routes
    // (deep links like /workspace/xtreams/:id) resolve on reload. sendFile
    // requires an absolute path, hence the resolve() above.
    app.use((req, res, next) => {
        if (req.method !== 'GET') {
            next();
            return;
        }
        res.sendFile(indexHtml);
    });
    console.log(`kXStream serving PWA from ${publicDir}`);
}

// Optional HTTPS. Set SSL_KEY_FILE + SSL_CERT_FILE (e.g. a self-signed cert
// mounted into the container) to serve over TLS. A secure context (HTTPS, or
// localhost) is REQUIRED for the app to install as a real PWA and for the
// service-worker offline cache to register — plain http://<lan-ip> will not.
const keyFile = process.env['SSL_KEY_FILE'];
const certFile = process.env['SSL_CERT_FILE'];

if (keyFile && certFile && existsSync(keyFile) && existsSync(certFile)) {
    createHttpsServer(
        { key: readFileSync(keyFile), cert: readFileSync(certFile) },
        app
    ).listen(port, () => {
        console.log(`kXStream listening on https://localhost:${port}`);
    });
} else {
    createHttpServer(app).listen(port, () => {
        console.log(`kXStream listening on http://localhost:${port}`);
    });
}
