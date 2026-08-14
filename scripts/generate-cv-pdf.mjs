import { access } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const cvHtml = path.resolve('dist/cv/index.html');
const cvPdf = path.resolve('dist/cv.pdf');

await access(cvHtml);

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(cvHtml).href, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  await page.pdf({
    path: cvPdf,
    format: 'A4',
    preferCSSPageSize: true,
    printBackground: true
  });
  console.log(`Generated ${path.relative(process.cwd(), cvPdf)}`);
} finally {
  await browser.close();
}
