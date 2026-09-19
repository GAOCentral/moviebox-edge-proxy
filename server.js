import http from 'node:http';

const port = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  // 1. CORS Preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Disposition, Accept-Ranges');
  res.setHeader('Accept-Ranges', 'bytes');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const targetUrl = reqUrl.searchParams.get('url');

  if (!targetUrl) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Missing ?url= parameter');
    return;
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

  const range = req.headers['range'];
  if (range) {
    outboundHeaders.set('Range', range);
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: outboundHeaders,
      redirect: 'follow',
    });

    res.statusCode = upstream.status;
    for (const [k, v] of upstream.headers.entries()) {
      if (k.toLowerCase() === 'transfer-encoding') continue;
      res.setHeader(k, v);
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Disposition, Accept-Ranges');
    res.setHeader('Accept-Ranges', 'bytes');

    const filename = reqUrl.searchParams.get('filename');
    const isDownload = reqUrl.searchParams.get('download');
    if (isDownload || filename) {
      const safeName = (filename || 'video.mp4').replace(/[\r\n"'/]/g, '');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    }

    if (!upstream.body) {
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.statusCode = 502;
      res.end(`Proxy error: ${err.message}`);
    }
  }
});

server.listen(port, () => {
  console.log(`MovieBox edge proxy listening on port ${port}`);
});
