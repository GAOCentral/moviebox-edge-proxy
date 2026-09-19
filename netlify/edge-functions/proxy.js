export default async (request, context) => {
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

  const outboundHeaders = new Headers();
  outboundHeaders.set(
    'User-Agent',
    reqUrl.searchParams.get('ua') ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
  );
  outboundHeaders.set('Accept-Encoding', 'identity');

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

  const range = request.headers.get('range') || request.headers.get('Range');
  if (range) {
    outboundHeaders.set('Range', range);
  }

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers: outboundHeaders,
    redirect: 'follow',
  });

  const respHeaders = new Headers(upstream.headers);
  respHeaders.set('Access-Control-Allow-Origin', '*');
  respHeaders.set(
    'Access-Control-Expose-Headers',
    'Content-Length, Content-Range, Content-Disposition, Accept-Ranges'
  );
  respHeaders.set('Accept-Ranges', 'bytes');

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
};

export const config = {
  path: '/*',
};
