import axios from 'axios';
import type { Request, Response } from 'express';
import { isIP } from 'node:net';

/**
 * Kodi cast support.
 *
 * kXStream never plays video itself; every "play" action forwards the stream
 * URL to a Kodi machine via JSON-RPC `Player.Open`. The renderer POSTs the
 * chosen target + stream URL here and this backend forwards the JSON-RPC call.
 *
 * Routing through the backend avoids two browser limitations that would break a
 * direct fetch from the PWA: Kodi sends no CORS headers, and an HTTPS page may
 * not fetch an HTTP Kodi endpoint (mixed content).
 *
 * Unlike the provider proxy, Kodi targets are on the local network BY DESIGN,
 * so private/LAN addresses are intentionally allowed here.
 */

export interface KodiCastTarget {
    readonly host: string;
    readonly port?: number;
    readonly username?: string;
    readonly password?: string;
    readonly useHttps?: boolean;
}

export interface KodiCastRequestBody {
    readonly target?: KodiCastTarget;
    readonly url?: string;
}

interface KodiJsonRpcResponse {
    readonly result?: unknown;
    readonly error?: unknown;
}

export interface KodiHttpPoster {
    (
        endpoint: string,
        payload: unknown,
        headers: Record<string, string>
    ): Promise<{ data: KodiJsonRpcResponse }>;
}

const DEFAULT_KODI_PORT = 8080;
const REQUEST_TIMEOUT_MS = 10000;

export async function handleKodiCast(
    req: Request,
    res: Response,
    httpPost: KodiHttpPoster = defaultKodiPost
): Promise<void> {
    const body = (req.body ?? {}) as KodiCastRequestBody;
    const target = body.target;
    const streamUrl = typeof body.url === 'string' ? body.url.trim() : '';

    const targetError = validateTarget(target);
    if (targetError) {
        res.status(400).json({ message: targetError, status: 400 });
        return;
    }
    if (!isHttpUrl(streamUrl)) {
        res.status(400).json({
            message: 'Missing or invalid stream url',
            status: 400,
        });
        return;
    }

    const endpoint = buildKodiEndpoint(target as KodiCastTarget);
    const headers = buildHeaders(target as KodiCastTarget);
    const payload = {
        jsonrpc: '2.0',
        method: 'Player.Open',
        params: { item: { file: streamUrl } },
        id: 1,
    };

    try {
        const response = await httpPost(endpoint, payload, headers);
        if (response.data?.error) {
            res.status(502).json({
                message: 'Kodi rejected the request',
                status: 502,
                kodi: response.data.error,
            });
            return;
        }
        res.json({ ok: true, result: response.data?.result ?? null });
    } catch (error) {
        const status = extractStatus(error);
        res.status(status).json({ message: describeError(error), status });
    }
}

function validateTarget(target: KodiCastTarget | undefined): string | null {
    if (!target || typeof target !== 'object') {
        return 'Missing Kodi target';
    }
    const host = typeof target.host === 'string' ? target.host.trim() : '';
    if (!host) {
        return 'Missing Kodi host';
    }
    if (!isValidHost(host)) {
        return 'Invalid Kodi host';
    }
    if (target.port !== undefined && !isValidPort(target.port)) {
        return 'Invalid Kodi port';
    }
    return null;
}

function isValidHost(host: string): boolean {
    if (isIP(host) !== 0) {
        return true;
    }
    // Hostnames: letters, digits, hyphen, dot; no scheme, path or whitespace.
    return /^[a-zA-Z0-9]([a-zA-Z0-9-.]{0,253}[a-zA-Z0-9])?$/.test(host);
}

function isValidPort(port: number): boolean {
    return Number.isInteger(port) && port >= 1 && port <= 65535;
}

function isHttpUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function buildKodiEndpoint(target: KodiCastTarget): string {
    const protocol = target.useHttps ? 'https' : 'http';
    const port = target.port ?? DEFAULT_KODI_PORT;
    return `${protocol}://${target.host}:${port}/jsonrpc`;
}

function buildHeaders(target: KodiCastTarget): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (target.username) {
        const credentials = `${target.username}:${target.password ?? ''}`;
        const encoded = Buffer.from(credentials).toString('base64');
        headers['Authorization'] = `Basic ${encoded}`;
    }
    return headers;
}

async function defaultKodiPost(
    endpoint: string,
    payload: unknown,
    headers: Record<string, string>
): Promise<{ data: KodiJsonRpcResponse }> {
    // Target is an operator-configured LAN Kodi machine; private hosts are allowed.
    // codeql[js/request-forgery]
    return axios.post(endpoint, payload, {
        headers,
        timeout: REQUEST_TIMEOUT_MS,
    });
}

function extractStatus(error: unknown): number {
    const response = (error as { response?: { status?: number } })?.response;
    return response?.status ?? 502;
}

function describeError(error: unknown): string {
    const err = error as {
        code?: string;
        response?: { statusText?: string };
        message?: string;
    };
    if (err?.response?.statusText) {
        return `Kodi error: ${err.response.statusText}`;
    }
    if (err?.code === 'ECONNREFUSED') {
        return 'Could not reach Kodi (connection refused). Is Kodi running and remote control over HTTP enabled?';
    }
    if (err?.code === 'ETIMEDOUT' || err?.code === 'ECONNABORTED') {
        return 'Kodi did not respond in time.';
    }
    return err?.message ?? 'Failed to reach Kodi';
}
