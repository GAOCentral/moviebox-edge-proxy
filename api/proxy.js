export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  // 1. Handle CORS Preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const reqUrl = new URL(request.url);
  const targetUrl = reqUrl.searchParams.get('url');

  if (!targetUrl) {
    return new Response('Missing ?url= parameter', { status: 400 });
  }

  // 2. Prepare Outbound Headers with Chrome Fingerprint & Referer Spoofing
  const outboundHeaders = new Headers();
  outboundHeaders.set(
    'User-Agent',
    reqUrl.searchParams.get('ua') ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
  );
  // Do NOT set Accept-Encoding: identity — it forces the CDN to send a
  // raw uncompressed stream that Vercel's edge buffers fully before forwarding,
  // causing the ~71MB cutoff. Let the edge runtime handle encoding transparently.
  outboundHeaders.set('Accept-Encoding', 'gzip, deflate, br');

  // Dynamic Referer/Origin resolution
  const customRef = reqUrl.searchParams.get('ref') || reqUrl.searchParams.get('referrer');
  if (customRef) {
    outboundHeaders.set('Referer', customRef);
    try {
      const p = new URL(customRef);
      outboundHeaders.set('Origin', `${p.protocol}//${p.host}`);
    } catch (_) {}
  } else {
    outboundHeaders.set('Referer', 'https://netfilm.world/');
    outboundHeaders.set('Origin', 'https://netfilm.world');
  }

  // Forward byte-range header for streaming seeks and resuming downloads
  const range = request.headers.get('range') || request.headers.get('Range');
  if (range) {
    outboundHeaders.set('Range', range);
  }

  // 3. Fetch from Upstream CDN (Alibaba Cloud / Tengine / MovieBox CDN)
  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers: outboundHeaders,
    redirect: 'follow',
  });

  // 4. Construct Response with CORS & Range Support
  const respHeaders = new Headers();

  // Copy only safe headers — deliberately exclude Content-Length so the browser
  // relies on chunked transfer encoding instead of a fixed byte count that may
  // be wrong after any encoding transformation by the edge runtime.
  const copyHeaders = [
    'content-type',
    'content-range',
    'content-disposition',
    'accept-ranges',
    'last-modified',
    'etag',
    'cache-control',
    'expires',
  ];
  for (const h of copyHeaders) {
    const v = upstream.headers.get(h);
    if (v) respHeaders.set(h, v);
  }

  respHeaders.set('Access-Control-Allow-Origin', '*');
  respHeaders.set(
    'Access-Control-Expose-Headers',
    'Content-Length, Content-Range, Content-Disposition, Accept-Ranges'
  );
  respHeaders.set('Accept-Ranges', 'bytes');
  // Remove Transfer-Encoding if set upstream (edge runtime handles this)
  respHeaders.delete('transfer-encoding');

  const filename = reqUrl.searchParams.get('filename');
  const isDownload = reqUrl.searchParams.get('download');
  if (isDownload || filename) {
    const safeName = (filename || 'video.mp4').replace(/[\r\n"'/]/g, '');
    respHeaders.set('Content-Disposition', `attachment; filename="${safeName}"`);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}
