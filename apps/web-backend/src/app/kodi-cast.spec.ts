import type { Request, Response } from 'express';
import { handleKodiCast, KodiHttpPoster } from './kodi-cast';

interface CapturedResponse {
    status: number;
    body: unknown;
}

function createRes(): { res: Response; captured: CapturedResponse } {
    const captured: CapturedResponse = { status: 200, body: undefined };
    const res = {
        status(code: number) {
            captured.status = code;
            return this;
        },
        json(payload: unknown) {
            captured.body = payload;
            return this;
        },
    } as unknown as Response;
    return { res, captured };
}

function createReq(body: unknown): Request {
    return { body } as Request;
}

describe('handleKodiCast', () => {
    it('forwards Player.Open to the target with the stream url', async () => {
        const calls: Array<{
            endpoint: string;
            payload: unknown;
            headers: Record<string, string>;
        }> = [];
        const poster: KodiHttpPoster = async (endpoint, payload, headers) => {
            calls.push({ endpoint, payload, headers });
            return { data: { result: 'OK' } };
        };
        const { res, captured } = createRes();

        await handleKodiCast(
            createReq({
                target: { host: '192.168.50.166', port: 8080 },
                url: 'http://provider.example/movie.mp4',
            }),
            res,
            poster
        );

        expect(calls).toHaveLength(1);
        expect(calls[0].endpoint).toBe('http://192.168.50.166:8080/jsonrpc');
        expect(calls[0].payload).toEqual({
            jsonrpc: '2.0',
            method: 'Player.Open',
            params: { item: { file: 'http://provider.example/movie.mp4' } },
            id: 1,
        });
        expect(captured.status).toBe(200);
        expect(captured.body).toEqual({ ok: true, result: 'OK' });
    });

    it('defaults the port to 8080 and sends basic auth when credentials are set', async () => {
        let seenEndpoint = '';
        let seenAuth: string | undefined;
        const poster: KodiHttpPoster = async (endpoint, _payload, headers) => {
            seenEndpoint = endpoint;
            seenAuth = headers['Authorization'];
            return { data: { result: 'OK' } };
        };
        const { res } = createRes();

        await handleKodiCast(
            createReq({
                target: { host: 'kodi.local', username: 'kodi', password: 'pw' },
                url: 'https://provider.example/live.m3u8',
            }),
            res,
            poster
        );

        expect(seenEndpoint).toBe('http://kodi.local:8080/jsonrpc');
        expect(seenAuth).toBe(
            `Basic ${Buffer.from('kodi:pw').toString('base64')}`
        );
    });

    it('rejects a missing target', async () => {
        const { res, captured } = createRes();
        await handleKodiCast(
            createReq({ url: 'http://provider.example/movie.mp4' }),
            res,
            async () => ({ data: {} })
        );
        expect(captured.status).toBe(400);
    });

    it('rejects an invalid stream url', async () => {
        const { res, captured } = createRes();
        await handleKodiCast(
            createReq({ target: { host: '192.168.50.166' }, url: 'not-a-url' }),
            res,
            async () => ({ data: {} })
        );
        expect(captured.status).toBe(400);
    });

    it('rejects an invalid host', async () => {
        const { res, captured } = createRes();
        await handleKodiCast(
            createReq({
                target: { host: 'http://evil.example/x' },
                url: 'http://provider.example/movie.mp4',
            }),
            res,
            async () => ({ data: {} })
        );
        expect(captured.status).toBe(400);
    });

    it('surfaces a Kodi JSON-RPC error as 502', async () => {
        const { res, captured } = createRes();
        await handleKodiCast(
            createReq({
                target: { host: '192.168.50.166' },
                url: 'http://provider.example/movie.mp4',
            }),
            res,
            async () => ({ data: { error: { code: -32601, message: 'nope' } } })
        );
        expect(captured.status).toBe(502);
        expect(captured.body).toMatchObject({ status: 502 });
    });

    it('maps a refused connection to a helpful 502', async () => {
        const { res, captured } = createRes();
        await handleKodiCast(
            createReq({
                target: { host: '192.168.50.166' },
                url: 'http://provider.example/movie.mp4',
            }),
            res,
            async () => {
                throw Object.assign(new Error('connect ECONNREFUSED'), {
                    code: 'ECONNREFUSED',
                });
            }
        );
        expect(captured.status).toBe(502);
        expect(captured.body).toMatchObject({ status: 502 });
    });
});
