# MovieBox Universal Edge Proxy (Vercel & Netlify)

Zero-cost, edge-accelerated reverse proxy with:
- Spoofed `Referer: https://netfilm.world/` & `Origin: https://netfilm.world`
- Streaming byte-range resumes (`Range: bytes=...`, `Accept-Ranges: bytes`)
- CORS `*` headers for video players (HLS.js, ExoPlayer, HTML5 Video, OPFS Downloader)
- Works out-of-the-box on **Vercel** and **Netlify**.

## Deployment (1-Click)

### Option 1: Vercel (Recommended)
1. Go to [https://vercel.com/new](https://vercel.com/new).
2. Import repository `GAOCentral/moviebox-edge-proxy`.
3. Click **Deploy**.
4. Copy your deployment domain (e.g. `https://moviebox-edge-proxy.vercel.app`).

### Option 2: Netlify
1. Go to [https://app.netlify.com/start](https://app.netlify.com/start).
2. Import repository `GAOCentral/moviebox-edge-proxy`.
3. Click **Deploy site**.
4. Copy your deployment domain (e.g. `https://moviebox-edge-proxy.netlify.app`).
