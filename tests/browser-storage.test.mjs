import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.mjs';
import { fixture } from './fixture.mjs';

let playwright;
for (const candidate of [
  process.env.PLAYWRIGHT_MODULE,
  'playwright',
  new URL('../../refract-text/node_modules/playwright/index.mjs', import.meta.url).href,
  new URL('../../workshoptest/node_modules/playwright/index.mjs', import.meta.url).href,
].filter(Boolean)) {
  try { playwright = await import(candidate); break; } catch {}
}

test('Browser-Speicher, Download und Upload im gehosteten Betrieb', { skip: !playwright }, async () => {
  const { chromium } = playwright;
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  try {
    // 1. Seite öffnen: Daten werden geladen und in localStorage abgelegt
    await page.goto(base);
    await page.waitForSelector('#nodes .node');

    const storedRaw = await page.evaluate(() => localStorage.getItem(`arch-contracter-data:${location.port}`));
    assert.ok(storedRaw, 'Daten müssen nach dem ersten Laden in localStorage liegen');
    const stored = JSON.parse(storedRaw);
    assert.equal(stored.schemaVersion, 1);
    assert.ok(stored.document.title);

    // 2. Element bearbeiten und Speichern: localStorage wird aktualisiert
    await page.locator('#nodes .node.root').click();
    await page.locator('.inspector input[data-field="title"]').fill('Gehostetes Projekt');
    await page.locator('#save').click();

    await page.waitForFunction(() => document.querySelector('#save-status')?.textContent.includes('Gespeichert'));

    const updatedRaw = await page.evaluate(() => localStorage.getItem(`arch-contracter-data:${location.port}`));
    const updated = JSON.parse(updatedRaw);
    assert.equal(updated.document.title, 'Gehostetes Projekt');

    // 3. Download JSON testen: Datei mit allen Daten wird heruntergeladen
    const [downloadEvent] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#download').click(),
    ]);
    const downloadStream = await downloadEvent.createReadStream();
    const chunks = [];
    for await (const chunk of downloadStream) chunks.push(chunk);
    const downloadedText = Buffer.concat(chunks).toString('utf8');
    const downloadedJson = JSON.parse(downloadedText);
    assert.equal(downloadedJson.document.title, 'Gehostetes Projekt');
    assert.equal(downloadedJson.schemaVersion, 1);
    assert.equal(downloadedJson.nodes.length, updated.nodes.length);

    // 4. Upload JSON testen: Hochgeladenes Dokument ersetzt aktuellen Stand und aktualisiert localStorage
    const customDoc = structuredClone(fixture);
    customDoc.document.title = 'Importiertes Projekt';
    customDoc.document.customer = 'Neuer Importkunde';

    await page.setInputFiles('#upload-input', {
      name: 'importiert.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(customDoc, null, 2), 'utf8'),
    });

    await page.waitForFunction(() => document.querySelector('#document-title')?.textContent === 'Importiertes Projekt');

    const importedRaw = await page.evaluate(() => localStorage.getItem(`arch-contracter-data:${location.port}`));
    const importedData = JSON.parse(importedRaw);
    assert.equal(importedData.document.title, 'Importiertes Projekt');
    assert.equal(importedData.document.customer, 'Neuer Importkunde');

    // 5. Auf Standard-Vorlage zurücksetzen
    page.once('dialog', async dialog => {
      await dialog.accept();
    });
    await page.locator('#reset-default').click();
    await page.waitForFunction(() => document.querySelector('#document-title')?.textContent === 'Kundenportal');

    const resetRaw = await page.evaluate(() => localStorage.getItem(`arch-contracter-data:${location.port}`));
    const resetData = JSON.parse(resetRaw);
    assert.equal(resetData.document.title, 'Kundenportal');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
