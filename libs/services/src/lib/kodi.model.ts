export interface KodiTarget {
    id: string;
    name: string;
    host: string;
    port: number;
    username?: string;
    password?: string;
    useHttps?: boolean;
}

export const DEFAULT_KODI_PORT = 8080;
