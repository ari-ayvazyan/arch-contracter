import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
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
  const directory = await mkdtemp(path.join(os.tmpdir(), 'arch-contracter-browser-test-'));
  const file = path.join(directory, 'lastenheft.json');
  await writeFile(file, JSON.stringify(fixture, null, 2), 'utf8');

  const server = createServer(file);
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

    // 2. Element bearbeiten: automatische sofortige Speicherung in localStorage
    await page.locator('#nodes .node.root').click();
    await page.locator('.inspector input[data-field="title"]').fill('Gehostetes Projekt');

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
    await rm(directory, { recursive: true, force: true });
  }
});

test('Einzelnes Lastenheft im Browser-Speicher, Neues Projekt und Unlöschbarkeit des Lastenhefts', { skip: !playwright }, async () => {
  const { chromium } = playwright;
  const directory = await mkdtemp(path.join(os.tmpdir(), 'arch-contracter-browser-test-2-'));
  const file = path.join(directory, 'lastenheft.json');
  await writeFile(file, JSON.stringify(fixture, null, 2), 'utf8');

  const server = createServer(file);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  try {
    // 1. Initiales Laden: Ein einzelnes Dokument liegt im Browser-Speicher
    await page.goto(base);
    await page.waitForSelector('#nodes .node');

    const storedRaw = await page.evaluate(() => localStorage.getItem(`arch-contracter-data:${location.port}`));
    assert.ok(storedRaw, 'Dokument muss in localStorage vorliegen');
    const stored = JSON.parse(storedRaw);
    assert.equal(stored.document.title, 'Kundenportal');

    // 2. Keine Mehrfachdokument-Umschalter oder Listen vorhanden
    assert.equal(await page.locator('#doc-switcher').count(), 0, 'Kein Dokumenten-Switcher');
    assert.equal(await page.locator('#document-list').count(), 0, 'Keine Dokumenten-Liste in der Sidebar');
    assert.equal(await page.locator('#delete-current-doc').count(), 0, 'Kein Lastenheft-Löschen-Button im Header');

    // 3. Kunde, Version und Datum existieren nicht im Inspector des Wurzelelements
    await page.locator('#nodes .node.root').click();
    assert.equal(await page.locator('.inspector [data-field="doc.customer"]').count(), 0);
    assert.equal(await page.locator('.inspector [data-field="doc.version"]').count(), 0);
    assert.equal(await page.locator('.inspector [data-field="doc.date"]').count(), 0);

    // 4. Das Lastenheft selbst (Wurzelelement) kann nicht gelöscht werden
    assert.equal(await page.locator('.inspector [data-action="delete"]').count(), 0, 'Wurzelelement hat keinen Löschen-Button im Inspector');
    assert.equal(await page.locator('.inspector [data-action="delete-doc"]').count(), 0);

    // Nicht-Wurzel-Elemente können hingegen gelöscht werden
    await page.locator('#nodes .node[data-node="zusatzmodule"]').click();
    assert.equal(await page.locator('.inspector [data-action="delete"]').count(), 1, 'Unterelement hat Löschen-Button');

    // 5. Testen: '+ Neues Projekt' Button unter 'Auf Vorlage zurücksetzen'
    const newProjectBtn = page.locator('#new-project');
    assert.ok(await newProjectBtn.isVisible(), '+ Neues Projekt Button muss sichtbar sein');
    await newProjectBtn.click();
    await page.waitForSelector('#new-doc-dialog[open]');

    // Sicherstellen, dass keine Duplizieren- oder Kunden-Felder vorhanden sind
    assert.equal(await page.locator('#new-doc-customer').count(), 0);
    assert.equal(await page.locator('input[name="doc-template"][value="duplicate"]').count(), 0);

    // Neues Projekt anlegen
    await page.locator('#new-doc-title').fill('CRM Einführung 2026');
    await page.locator('#new-doc-form button[type="submit"]').click();

    await page.waitForFunction(() => document.querySelector('#document-title')?.textContent === 'CRM Einführung 2026');

    // localStorage prüfen: Das neue Projekt ersetzt den aktuellen Stand
    const updatedRaw = await page.evaluate(() => localStorage.getItem(`arch-contracter-data:${location.port}`));
    const updated = JSON.parse(updatedRaw);
    assert.equal(updated.document.title, 'CRM Einführung 2026');

    // 6. Auf Standard-Vorlage zurücksetzen
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
    await rm(directory, { recursive: true, force: true });
  }
});

