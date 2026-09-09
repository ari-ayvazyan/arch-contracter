import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from '../server.mjs';
import { fixture } from './fixture.mjs';

test('Lokale API: Speichern, Backup, Konflikte und fremde Ursprünge', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'arch-contracter-test-'));
  const file = path.join(directory, 'lastenheft.json'); const original = JSON.stringify(fixture, null, 2);
  await writeFile(file, original); const server = createServer(file);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(base)).status, 200);
    for (const asset of ['/app.js', '/model.js', '/styles.css', '/print.css']) assert.equal((await fetch(`${base}${asset}`)).status, 200);
    assert.equal((await fetch(`${base}/data/lastenheft.json`)).status, 404);
    const loaded = await (await fetch(`${base}/api/document`)).json();
    loaded.data.document.customer = 'Neuer Testkunde';
    const put = (payload, headers = {}) => fetch(`${base}/api/document`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(payload) });
    const saved = await put(loaded); assert.equal(saved.status, 200); const savedBody = await saved.json(); assert.notEqual(savedBody.revision, loaded.revision);
    assert.equal(JSON.parse(await readFile(file, 'utf8')).document.customer, 'Neuer Testkunde');
    assert.equal(await readFile(path.join(directory, 'lastenheft.backup.json'), 'utf8'), original);
    assert.equal((await put(loaded)).status, 409);
    assert.equal((await put({ ...loaded, revision: savedBody.revision }, { Origin: 'https://example.com' })).status, 403);
    const invalid = structuredClone(loaded); invalid.data.nodes[1].parentId = 'fehlt'; assert.equal((await put(invalid)).status, 400);
    const current = { ...loaded, revision: savedBody.revision };
    await writeFile(file, original);
    assert.equal((await put(current)).status, 409);
    assert.equal(await readFile(file, 'utf8'), original);
    const latest = await (await fetch(`${base}/api/document`)).json();
    latest.data.document.customer = 'Parallel';
    const statuses = await Promise.all([put(latest), put(latest)]).then(results => results.map(result => result.status).sort());
    assert.deepEqual(statuses, [200, 409]);
  } finally { await new Promise(resolve => server.close(resolve)); assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep)); assert.ok(path.basename(directory).startsWith('arch-contracter-test-')); await rm(directory, { recursive: true, force: true }); }
});
