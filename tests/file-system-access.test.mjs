import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
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

test('File System Access API: Dialog beim ersten Oeffnen, Live-Ueberwachung und sofortige Aktualisierung', { skip: !playwright }, async () => {
  const { chromium } = playwright;
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  try {
    // 1. Initiales Laden der Seite
    await page.goto(base);
    await page.waitForSelector('#nodes .node');

    // 2. Pruefen des Auswahldialogs fuer den ersten Start
    const dialogExists = await page.evaluate(() => {
      const dialog = document.querySelector('#fs-picker-dialog');
      return Boolean(
        dialog &&
        dialog.querySelector('#fs-dialog-open-btn') &&
        dialog.querySelector('#fs-dialog-create-btn') &&
        dialog.querySelector('#fs-dialog-browser-btn')
      );
    });
    assert.ok(dialogExists, 'Der Dialog fuer die Speicherort-Auswahl muss im DOM vorhanden sein');

    // Dialog manuell oeffnen und Option "Browser-Speicher" testen
    await page.evaluate(() => document.querySelector('#fs-picker-dialog').showModal());
    const isOpen = await page.evaluate(() => document.querySelector('#fs-picker-dialog').open);
    assert.equal(isOpen, true, 'Dialog laesst sich oeffnen');

    await page.locator('#fs-dialog-browser-btn').click();
    const isClosed = await page.evaluate(() => !document.querySelector('#fs-picker-dialog').open);
    assert.equal(isClosed, true, 'Klick auf Browser-Speicher schliesst den Dialog');
    const choice = await page.evaluate(() => localStorage.getItem('arch-contracter-fs-choice'));
    assert.equal(choice, 'browser');

    // 3. Simulation eines FileSystemFileHandle fuer Dateianbindung
    let mockFileContent = JSON.stringify(fixture, null, 2);
    let mockModified = 1000;

    await page.exposeFunction('__getMockFileContent', () => mockFileContent);
    await page.exposeFunction('__setMockFileContent', (newContent) => {
      mockFileContent = newContent;
      mockModified += 1000;
    });
    await page.exposeFunction('__getMockModified', () => mockModified);

    await page.evaluate(() => {
      const mockHandle = {
        name: 'live-test.json',
        kind: 'file',
        async getFile() {
          const content = await window.__getMockFileContent();
          const modified = await window.__getMockModified();
          return {
            name: 'live-test.json',
            lastModified: modified,
            size: new Blob([content]).size,
            async text() {
              return content;
            }
          };
        },
        async createWritable() {
          let written = '';
          return {
            async write(chunk) {
              written += chunk;
            },
            async close() {
              await window.__setMockFileContent(written);
            }
          };
        },
        async queryPermission() {
          return 'granted';
        },
        async requestPermission() {
          return 'granted';
        }
      };

      window.__fsAccess.fileHandle = mockHandle;
    });

    // 4. Pruefen, ob die UI auf die Dateianbindung umschaltet
    await page.waitForFunction(() => document.querySelector('#file-storage-name')?.textContent === 'live-test.json');
    const labelText = await page.locator('#storage-mode-label').textContent();
    assert.match(labelText, /LIVE-TEST\.JSON/);
    const descText = await page.locator('#file-storage-desc').textContent();
    assert.equal(descText, 'Live-Sync aktiv');
    const isDisconnectVisible = await page.evaluate(() => !document.querySelector('#fs-disconnect').hidden);
    assert.equal(isDisconnectVisible, true, 'Trennen-Button muss sichtbar sein');

    // 5. Externe Aenderung simulieren (wie durch einen KI-Agenten oder externen Editor)
    const modifiedData = structuredClone(fixture);
    modifiedData.document.title = 'Vom Agenten synchronisiert';
    const rootNode = modifiedData.nodes.find(n => n.parentId === null);
    if (rootNode) rootNode.title = 'Vom Agenten synchronisiert';

    mockFileContent = JSON.stringify(modifiedData, null, 2);
    mockModified += 5000;

    // Trigger oder automatisches Polling abwarten (Watcher laeuft alle 500ms)
    await page.waitForFunction(() => document.querySelector('#document-title')?.textContent === 'Vom Agenten synchronisiert', { timeout: 3000 });

    // Status pruefen
    const statusText = await page.locator('#save-status').textContent();
    assert.equal(statusText, '✓ Synchronisiert');

    // 6. Aenderung in der Web-App wird automatisch sofort in das FileHandle zurueckgeschrieben
    await page.locator('#nodes .node.root').click();
    await page.locator('.inspector input[data-field="title"]').fill('Aus WebApp geaendert');

    await page.waitForFunction(() => document.querySelector('#save-status')?.textContent === '✓ Synchronisiert');
    const writtenBack = JSON.parse(mockFileContent);
    assert.equal(writtenBack.document.title, 'Aus WebApp geaendert');

    // 7. Dateiverknuepfung trennen
    await page.locator('#fs-disconnect').click();
    await page.waitForFunction(() => document.querySelector('#file-storage-name')?.textContent === 'Browser-Speicher');
    const resetLabel = await page.locator('#storage-mode-label').textContent();
    assert.equal(resetLabel, 'BROWSER-SPEICHER');
    const disconnectHidden = await page.evaluate(() => document.querySelector('#fs-disconnect').hidden);
    assert.equal(disconnectHidden, true);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('Lokale Server-Datei: Direkte Datei-Aktualisierung auf der Festplatte und Live-Übernahme von KI-Agenten-Änderungen', { skip: !playwright }, async () => {
  const { chromium } = playwright;
  const directory = await mkdtemp(path.join(os.tmpdir(), 'arch-contracter-disk-sync-'));
  const file = path.join(directory, 'lastenheft.json');
  await writeFile(file, JSON.stringify(fixture, null, 2), 'utf8');

  const server = createServer(file);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  try {
    // 1. Seite öffnen
    await page.goto(base);
    await page.waitForSelector('#nodes .node');

    // Modus-Anzeige prüfen: Server-Datei aktiv
    const labelText = await page.locator('#storage-mode-label').textContent();
    assert.match(labelText, /DATA\/LASTENHEFT\.JSON|SERVER/);

    // 2. Änderung in der Web-App durchführen
    await page.locator('#nodes .node.root').click();
    await page.locator('.inspector input[data-field="title"]').fill('Direkt auf Festplatte gespeichert');
    await page.locator('.inspector input[data-field="title"]').blur();

    // Warten bis der Status "Gespeichert" anzeigt
    await page.waitForFunction(() => document.querySelector('#save-status')?.textContent.includes('Gespeichert'));

    // 3. Prüfen: Datei auf der Festplatte MUSS aktualisiert worden sein!
    const contentOnDisk = await readFile(file, 'utf8');
    const parsedOnDisk = JSON.parse(contentOnDisk);
    assert.equal(parsedOnDisk.document.title, 'Direkt auf Festplatte gespeichert', 'Datei auf der Festplatte muss aktualisiert worden sein');

    // 4. Externen KI-Agenten simulieren, der die Datei auf der Festplatte bearbeitet
    parsedOnDisk.document.title = 'Vom externen KI-Agenten auf Festplatte editiert';
    const rootNode = parsedOnDisk.nodes.find(n => n.parentId === null);
    if (rootNode) rootNode.title = 'Vom externen KI-Agenten auf Festplatte editiert';
    await writeFile(file, JSON.stringify(parsedOnDisk, null, 2) + '\n', 'utf8');

    // 5. Prüfen: Web-App übernimmt die externe Änderung automatisch
    await page.waitForFunction(() => document.querySelector('#document-title')?.textContent === 'Vom externen KI-Agenten auf Festplatte editiert', { timeout: 3500 });

    const pageTitle = await page.locator('#document-title').textContent();
    assert.equal(pageTitle, 'Vom externen KI-Agenten auf Festplatte editiert');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
