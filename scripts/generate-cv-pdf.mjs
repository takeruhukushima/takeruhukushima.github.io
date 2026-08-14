import { access, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const distDir = path.resolve('dist');
const browserChannel = process.env.CV_BROWSER_CHANNEL;
const exports = [
  { route: '/cv/ja/', html: path.resolve('dist/cv/ja/index.html'), pdf: path.resolve('dist/cv-ja.pdf') },
  { route: '/cv/en/', html: path.resolve('dist/cv/en/index.html'), pdf: path.resolve('dist/cv-en.pdf') }
];

await Promise.all(exports.map(({ html }) => access(html)));

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.woff2': 'font/woff2'
};

const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
  const relativePath = pathname.endsWith('/')
    ? `${pathname.replace(/^\/+/, '')}index.html`
    : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(distDir, relativePath);

  if (!filePath.startsWith(`${distDir}${path.sep}`)) {
    response.writeHead(403).end();
    return;
  }

  try {
    const body = await readFile(filePath);
    const contentType = contentTypes[path.extname(filePath)] || 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': contentType }).end(body);
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});

const address = server.address();
if (!address || typeof address === 'string') throw new Error('Could not start the CV preview server.');

let browser;

try {
  browser = await chromium.launch({
    headless: true,
    ...(browserChannel ? { channel: browserChannel } : {})
  });
  const page = await browser.newPage();
  for (const cvExport of exports) {
    await page.goto(`http://127.0.0.1:${address.port}${cvExport.route}`, { waitUntil: 'networkidle' });
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.emulateMedia({ media: 'print' });
    await page.pdf({
      path: cvExport.pdf,
      format: 'A4',
      preferCSSPageSize: true,
      printBackground: true
    });
    console.log(`Generated ${path.relative(process.cwd(), cvExport.pdf)}`);
  }
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  await rm(path.resolve('dist/cv'), { recursive: true, force: true });
}
