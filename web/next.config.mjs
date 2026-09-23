import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Game-account sign-in keeps a refresh token in localStorage, so lock down
// where the page can send data (Firestore only under the game's own project
// path, not any project on the host). ponytail: 'unsafe-inline' scripts are needed
// by Next without nonces; nonces force dynamic rendering on every page —
// upgrade path if script-src ever needs tightening. Production only: the dev
// server (and the CI e2e run on it) needs eval for fast refresh.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://oauth2.googleapis.com https://identitytoolkit.googleapis.com" +
    " https://securetoken.googleapis.com https://firestore.googleapis.com/v1/projects/idlemmo/" +
    " https://idlemmo.firebaseio.com https://us-central1-idlemmo.cloudfunctions.net",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: __dirname,
  },
  async headers() {
    if (process.env.NODE_ENV !== "production") return [];
    return [
      { source: "/:path*", headers: [{ key: "Content-Security-Policy", value: CSP }] },
    ];
  },
};

export default nextConfig;
