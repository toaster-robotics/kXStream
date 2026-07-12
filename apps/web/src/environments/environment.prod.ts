import packageJson from '@package';

export const AppConfig = {
    production: true,
    environment: 'PROD',
    version: packageJson.version,
    // Same-origin: the app is served BY its own web-backend, so all proxy
    // calls (/provider-targets, /xtream, /parse, /cast) are relative and stay
    // on your LAN. Never point this at a third-party proxy — that would send
    // your provider URL + credentials off your network.
    BACKEND_URL: '',
};
