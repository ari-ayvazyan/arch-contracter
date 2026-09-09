import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validate, descendants, effectiveContract, moveNode, removeNode, exportSelection, documentHtml } from '../dist/model.js';
import { fixture } from './fixture.mjs';
const sample = JSON.parse(await readFile(new URL('../data/lastenheft.json', import.meta.url), 'utf8'));
const fresh = () => structuredClone(fixture);
test('Inhaltsdatei ist gültig', () => assert.equal(validate(sample).schemaVersion, 1));
test('Fragen benötigen keinen Typ und werden im PDF berücksichtigt', () => {
  const d = fresh(), n = d.nodes.find(n => n.id === 'rollen-rechte');
  n.questions = [{ id: 'ohne-typ', text: 'Welche Freigabe ist erforderlich?', answer: '', status: 'open' }];
  validate(d);
  assert.ok(documentHtml(d).includes('Welche Freigabe ist erforderlich?'));
  assert.ok(!documentHtml(d, '*', false).includes('Welche Freigabe ist erforderlich?'));
});
test('Kreise, verwaiste IDs und ungültige Links werden abgewiesen', () => {
  let d = fresh(); d.nodes.find(n => n.id === 'basisprojekt').parentId = 'benutzerverwaltung'; assert.throws(() => validate(d), /Kreis/);
  d = fresh(); d.nodes[1].parentId = 'fehlt'; assert.throws(() => validate(d), /fehlt/);
  d = fresh(); d.links[0].target = 'fehlt'; assert.throws(() => validate(d), /Verknüpfung/);
});
test('Duplikate und Kinder an Anforderungen werden abgewiesen', () => {
  let d = fresh(); d.nodes.push(structuredClone(d.nodes[1])); assert.throws(() => validate(d), /eindeutig/);
  d = fresh(); d.nodes.find(n => n.id === 'crm-anbindung').parentId = 'anmeldung'; assert.throws(() => validate(d), /Unterelemente/);
});
test('Verschieben erhält stabile IDs und ändert geerbten Vertrag', () => {
  const d = fresh(); moveNode(d, 'dokumentenablage', 'zusatzmodule');
  assert.equal(effectiveContract(d, 'dateien-hochladen'), 'Erweiterungen'); assert.ok(descendants(d, 'zusatzmodule').has('dateien-hochladen')); validate(d);
  assert.throws(() => moveNode(d, 'zusatzmodule', 'dokumentenablage'));
  assert.throws(() => moveNode(d, 'kundenportal', 'basisprojekt'));
});
test('Löschen entfernt Teilbaum und Referenzen', () => {
  const d = fresh(); removeNode(d, 'benutzerverwaltung'); assert.ok(!d.nodes.some(n => n.id === 'rollen-rechte')); assert.ok(!d.links.some(l => l.target === 'benutzerverwaltung')); validate(d);
});
test('Drag-and-drop kann Geschwister umsortieren und vor Anforderungen einfügen', () => {
  const d = fresh(); moveNode(d, 'dokumentenablage', 'benutzerverwaltung', 'before');
  assert.ok(d.nodes.findIndex(n => n.id === 'dokumentenablage') < d.nodes.findIndex(n => n.id === 'benutzerverwaltung'));
  moveNode(d, 'dateien-hochladen', 'anmeldung', 'after');
  assert.equal(d.nodes.find(n => n.id === 'dateien-hochladen').parentId, 'benutzerverwaltung');
  validate(d); assert.throws(() => moveNode(d, 'basisprojekt', 'kundenportal', 'before'));
});
test('Separate Vertragsumfänge bleiben getrennt, externe Voraussetzungen werden erkannt', () => {
  const d = fresh(); const { included, warnings } = exportSelection(d, 'Erweiterungen');
  assert.ok(included.has('crm-anbindung')); assert.ok(!included.has('rollen-rechte')); assert.equal(warnings.length, 3);
  d.nodes.find(n => n.id === 'crm-anbindung').contract = 'Phase 3';
  assert.ok(!exportSelection(d, 'Erweiterungen').included.has('crm-anbindung'));
});
test('PDF-Inhalt schließt interne Angaben aus und maskiert HTML', () => {
  const d = fresh(), n = d.nodes.find(n => n.id === 'rollen-rechte');
  n.notes = 'GEHEIME_INTERNE_NOTIZ'; n.description = '<script>alert("x")</script>';
  n.questions.push({ id: 'intern', text: 'GEHEIME_INTERNE_FRAGE', answer: '', status: 'open', visibility: 'internal' });
  let html = documentHtml(d);
  assert.ok(!html.includes('GEHEIME_INTERNE')); assert.ok(html.includes('&lt;script&gt;')); assert.ok(!html.includes('<script>')); assert.ok(html.includes('Welche Standardrollen'));
  html = documentHtml(d, '*', false); assert.ok(!html.includes('Welche Standardrollen'));
  html = documentHtml(d, 'Erweiterungen'); assert.ok(!html.includes('id="doc-rollen-rechte"')); assert.ok(html.includes('Voraussetzungen außerhalb')); assert.ok(html.includes('CRM-Anbindung'));
});
test('Nummerierung bleibt eindeutig, wenn dazwischenliegende Gruppen einen anderen Vertrag haben', () => {
  const d = fresh();
  d.nodes.find(n => n.id === 'basisprojekt').contract = 'Gemeinsam';
  d.nodes.find(n => n.id === 'benutzerverwaltung').contract = 'Separat';
  d.nodes.find(n => n.id === 'dokumentenablage').contract = 'Separat';
  d.nodes.find(n => n.id === 'anmeldung').contract = 'Gemeinsam';
  d.nodes.find(n => n.id === 'dateien-hochladen').contract = 'Gemeinsam';
  const html = documentHtml(d, 'Gemeinsam');
  assert.ok(html.includes('<h2>1.1 anmeldung</h2>'));
  assert.ok(html.includes('<h2>1.2 dateien-hochladen</h2>'));
});
