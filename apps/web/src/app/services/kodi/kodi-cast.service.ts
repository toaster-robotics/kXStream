import { Injectable } from '@angular/core';
import { getRuntimeBackendUrl } from '../runtime-config';
import { KodiTarget } from '@iptvnator/services';

export interface KodiCastResult {
    readonly ok: boolean;
    readonly error?: string;
}

/**
 * Low-level Kodi cast client. POSTs the stream URL + chosen target to the
 * web-backend `/cast` endpoint, which forwards a JSON-RPC `Player.Open` to
 * Kodi. Routing through the backend avoids browser CORS/mixed-content limits.
 */
@Injectable({ providedIn: 'root' })
export class KodiCastService {
    async cast(streamUrl: string, target: KodiTarget): Promise<KodiCastResult> {
        try {
            const response = await fetch(`${getRuntimeBackendUrl()}/cast`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target: {
                        host: target.host,
                        port: target.port,
                        username: target.username,
                        password: target.password,
                        useHttps: target.useHttps,
                    },
                    url: streamUrl,
                }),
            });

            const data = (await response
                .json()
                .catch(() => ({}))) as KodiCastResult & { message?: string };

            if (!response.ok || data?.ok === false) {
                return {
                    ok: false,
                    error: data?.message ?? `Cast failed (HTTP ${response.status})`,
                };
            }
            return { ok: true };
        } catch (error) {
            return { ok: false, error: (error as Error).message };
        }
    }
}
