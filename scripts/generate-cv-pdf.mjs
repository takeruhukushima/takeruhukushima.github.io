import { access, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const distDir = path.resolve('dist');
const cvHtml = path.resolve('dist/cv/index.html');
const cvPdf = path.resolve('dist/cv.pdf');
const browserChannel = process.env.CV_BROWSER_CHANNEL;

await access(cvHtml);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.woff2': 'font/woff2'
};

const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
  const relativePath = pathname === '/cv/' ? 'cv/index.html' : pathname.replace(/^\/+/, '');
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
  await page.goto(`http://127.0.0.1:${address.port}/cv/`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.emulateMedia({ media: 'print' });
  await page.pdf({
    path: cvPdf,
    format: 'A4',
    preferCSSPageSize: true,
    printBackground: true
  });
  console.log(`Generated ${path.relative(process.cwd(), cvPdf)}`);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
