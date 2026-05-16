const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = 5000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': getMimeType(filePath),
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

function proxyRequest(res, url) {
  https.get(url, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, {
      'Content-Type': proxyRes.headers['content-type'] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    proxyRes.pipe(res);
  }).on('error', () => {
    res.writeHead(404);
    res.end('Not found');
  });
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  let reqPath = req.url.split('?')[0];

  // Home page → new redesigned index
  if (reqPath === '/') {
    const htmlPath = path.join(__dirname, 'pages', 'index.html');
    fs.readFile(htmlPath, 'utf8', (err, html) => {
      if (err) { res.writeHead(500); res.end('Error reading page'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' });
      res.end(html);
    });
    return;
  }

  // Contact page → original Shopify snapshot
  if (reqPath === '/pages/contact' || reqPath === '/pages/contact.html') {
    const htmlPath = path.join(__dirname, 'shop.truenorthseafood.com', 'pages', 'contact.html');
    fs.readFile(htmlPath, 'utf8', (err, html) => {
      if (err) { res.writeHead(500); res.end('Error reading page'); return; }
      html = html.replace(/\/\/shop\.truenorthseafood\.com/g, '');
      html = html.replace(/https:\/\/shop\.truenorthseafood\.com/g, '');
      html = html.replace(/http:\/\/shop\.truenorthseafood\.com/g, '');
      html = html.replace(/\s+integrity="[^"]*"/g, '');
      html = html.replace(/\s+crossorigin="[^"]*"/g, '');
      html = html.replace(/data-src="([^"]*)\{width\}x([^"]*)"/g, (match, pre, post) => {
        const url1800 = pre + '1800x' + post;
        return `src="${url1800}" data-src="${url1800}"`;
      });
      html = html.replace(/class="([^"]*)\bloading--delayed\b([^"]*)"/g, 'class="$1$2"');
      html = html.replace(/class="([^"]*)\bloading\b([^"]*)"/g, 'class="$1$2"');
      const heroFix = `<style>
[data-aos="hero__animation"] .hero__image,
.slideshow__slide .hero__image { opacity: 1 !important; transition: none !important; }
[data-aos="hero__animation"] .hero__image-wrapper,
.slideshow__slide .hero__image-wrapper { opacity: 1 !important; transform: translate(0) !important; transition: none !important; }
[data-aos="hero__animation"] .animation-cropper,
.slideshow__slide .animation-cropper { opacity: 1 !important; }
[data-aos="hero__animation"] .animation-contents,
.slideshow__slide .animation-contents { transform: translateY(0) !important; opacity: 1 !important; }
.hero__image.lazyload, .feature-row__image.lazyload { opacity: 1 !important; }
</style>
<script>
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('[data-aos="hero__animation"], .slideshow__slide').forEach(function(el) {
    el.classList.add('loaded', 'is-selected', 'aos-animate');
  });
});
<\/script>`;
      html = html.replace('</head>', heroFix + '</head>');
      res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' });
      res.end(html);
    });
    return;
  }

  const localPath = path.join(__dirname, 'shop.truenorthseafood.com', reqPath);
  if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
    serveFile(res, localPath);
    return;
  }

  const externalDomains = ['cdn.judge.me', 'cdn.pickystory.com', 'image-optimizer.salessquad.co.uk', 'scripts.clarity.ms', 'cdn.shopify.com', 'connect.facebook.net', 'widget1-cdn.labamplify.com'];
  for (const domain of externalDomains) {
    const localExtPath = path.join(__dirname, domain, reqPath);
    if (fs.existsSync(localExtPath) && fs.statSync(localExtPath).isFile()) {
      serveFile(res, localExtPath);
      return;
    }
  }

  proxyRequest(res, `https://shop.truenorthseafood.com${reqPath}`);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
