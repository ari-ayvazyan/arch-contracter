import { types, validate, children, descendants, effectiveContract, moveNode, removeNode, exportSelection, documentHtml, escapeHtml as e, defaultTemplate } from './model.js';
import { paginateDocument } from './pagination.js';

const $ = selector => document.querySelector(selector);
let data, selected, dirty = false, saving = false, conflict = false, view = 'map', scope = '*', search = '', collapsed = new Set();
let undo = [], redo = [], zoom = 1, pan = { x: 45, y: 70 }, positions = new Map(), bounds = { width: 1000, height: 700 }, dragged = null;
// View-only offsets: never part of document data, drafts, or localStorage.
const nodeOffsets = new Map();
let nodeDrag = null, ignoreNodeClickUntil = 0;
let dependencyDraft = null;
const storageKey = `arch-contracter-data${location.port ? `:${location.port}` : ''}`;
const draftKey = `arch-contracter-draft${location.port ? `:${location.port}` : ''}`;
const clone = value => structuredClone(value);
const node = id => data.nodes.find(n => n.id === id);
const selectedNode = () => node(selected);
const root = () => data.nodes.find(n => n.parentId === null);
const id = prefix => `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
const contracts = () => [...new Set(data.nodes.map(n => effectiveContract(data, n.id)))];
const isEditing = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
let toastTimer;
function toast(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').hidden = true, 4500); }
function notice(message) { $('#notice').hidden = !message; $('#notice').innerHTML = message ? `<span>${e(message)}</span><button data-action="reload">Stand laden</button><button data-action="download">JSON herunterladen</button>` : ''; }
function backup() { try { localStorage.setItem(draftKey, JSON.stringify(data)); } catch { toast('Lokale Wiederherstellung nicht verfügbar. Bitte speichern.'); } }
function updateSaveStatus() { $('#save-status').textContent = saving ? 'Speichert …' : conflict ? 'Konflikt' : dirty ? 'Ungespeichert' : '✓ Gespeichert'; $('#save-status').classList.toggle('dirty', dirty || conflict); $('#save').disabled = saving || !data; }
function checkpoint() { undo.push(clone(data)); if (undo.length > 80) undo.shift(); redo = []; }
function changed() { dirty = true; backup(); updateSaveStatus(); renderOverview(); }
function mutate(fn, inspect = true) {
  const previous = clone(data);
  try { fn(); validate(data); undo.push(previous); if (undo.length > 80) undo.shift(); redo = []; changed(); if (inspect) renderInspector(); }
  catch (error) { data = previous; toast(error.message); }
}
async function load(force = false) {
  if (data && dirty && !force && !confirm('Ungespeicherte Änderungen verwerfen und den gespeicherten Stand laden? Sichere bei Bedarf zuerst den JSON-Entwurf.')) return;
  try {
    let raw = null;
    try { raw = localStorage.getItem(storageKey); } catch {}
    let loadedData = null;
    if (raw) {
      try {
        loadedData = JSON.parse(raw);
        validate(loadedData);
      } catch {
        loadedData = null;
      }
    }
    if (!loadedData) {
      try {
        const response = await fetch('/api/document');
        if (response.ok) {
          const payload = await response.json();
          validate(payload.data);
          loadedData = payload.data;
        }
      } catch {}
    }
    if (!loadedData) {
      loadedData = clone(defaultTemplate);
      validate(loadedData);
    }
    data = loadedData;
    try {
      if (!raw) localStorage.setItem(storageKey, JSON.stringify(data));
      localStorage.removeItem(draftKey);
    } catch {}
    dirty = false;
    conflict = false;
    undo = [];
    redo = [];
    if (!selected || !node(selected)) selected = root().id;
    notice('');
    updateSaveStatus();
    renderOverview();
    renderInspector();
    fit();
  } catch (error) {
    notice(`Daten konnten nicht geladen werden: ${error.message}`);
  }
}
async function save() {
  if (!data || saving) return;
  try { validate(data); } catch (error) { return toast(error.message); }
  saving = true; updateSaveStatus();
  try {
    localStorage.setItem(storageKey, JSON.stringify(data));
    try { localStorage.removeItem(draftKey); } catch {}
    dirty = false;
    conflict = false;
    notice('');
    toast('Im Browser-Speicher gespeichert.');
  } catch (error) {
    notice(`Speichern im Browser fehlgeschlagen: ${error.message}`);
  } finally {
    saving = false;
    updateSaveStatus();
  }
}
function download() {
  if (!data) return;
  const json = JSON.stringify(data, null, 2) + '\n';
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const slug = (data.document?.title || 'lastenheft').toLowerCase().trim().replace(/[^a-z0-9äöüß_-]+/gi, '-').replace(/^-+|-+$/g, '');
  a.download = `${slug || 'lastenheft'}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`JSON heruntergeladen: ${a.download}`);
}
async function uploadFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    let imported;
    try {
      imported = JSON.parse(text);
    } catch {
      throw new Error('Die ausgewählte Datei enthält kein gültiges JSON.');
    }
    validate(imported);
    if (dirty && !confirm('Ungespeicherte Änderungen werden überschrieben. Fortfahren?')) return;
    data = imported;
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
      localStorage.removeItem(draftKey);
    } catch {}
    dirty = false;
    conflict = false;
    undo = [];
    redo = [];
    selected = root().id;
    notice('');
    updateSaveStatus();
    renderOverview();
    renderInspector();
    fit();
    toast(`„${file.name}“ erfolgreich geladen.`);
  } catch (error) {
    toast(`Fehler beim Laden der Datei: ${error.message}`);
  } finally {
    const input = $('#upload-input');
    if (input) input.value = '';
  }
}
async function resetToDefault() {
  if (!confirm('Möchtest du wirklich alle Änderungen verwerfen und auf das Standard-Beispieldokument zurücksetzen? Ungespeicherte Änderungen gehen verloren. Sichere bei Bedarf zuerst deinen aktuellen Stand.')) return;
  try {
    let defaultData = null;
    try {
      const response = await fetch('/api/document');
      if (response.ok) {
        const payload = await response.json();
        validate(payload.data);
        defaultData = payload.data;
      }
    } catch {}
    if (!defaultData) defaultData = clone(defaultTemplate);
    data = defaultData;
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
      localStorage.removeItem(draftKey);
    } catch {}
    dirty = false;
    conflict = false;
    undo = [];
    redo = [];
    selected = root().id;
    notice('');
    updateSaveStatus();
    renderOverview();
    renderInspector();
    fit();
    toast('Auf Standard-Vorlage zurückgesetzt.');
  } catch (error) {
    toast(`Zurücksetzen fehlgeschlagen: ${error.message}`);
  }
}
function select(id, center = false) { selected = id; if (center) { let current = node(id); while (current) { collapsed.delete(current.id); current = node(current.parentId); } } renderOverview(); renderInspector(); if (center && positions.has(id)) { const p = positions.get(id); pan = { x: $('#canvas').clientWidth / 2 - (p.x + 113) * zoom, y: $('#canvas').clientHeight / 2 - (p.y + 45) * zoom }; transform(); } }
function setView(next) { cancelDependency(); view = next; renderOverview(); }
function activeNodes() {
  const matching = new Set(data.nodes.filter(n => (scope === '*' || effectiveContract(data, n.id) === scope) && (!search || `${n.title} ${n.description} ${n.notes}`.toLocaleLowerCase('de').includes(search))).map(n => n.id));
  const visible = new Set(matching);
  for (const match of matching) { let parent = node(match)?.parentId; while (parent) { visible.add(parent); parent = node(parent)?.parentId; } }
  return { matching, visible };
}
function renderOverview() {
  if (!data) return;
  $('#document-title').textContent = data.document.title; document.title = `${data.document.title} · Arch-Contracter`;
  $('#node-count').textContent = data.nodes.length - 1;
  $('#question-count').textContent = data.nodes.reduce((sum, n) => sum + n.questions.filter(q => q.status === 'open').length, 0);
  if (scope !== '*' && !contracts().includes(scope)) scope = '*';
  $('#scope-label').textContent = scope === '*' ? 'GESAMTÜBERSICHT' : scope.toLocaleUpperCase('de');
  $('#contracts').innerHTML = `<button class="contract-button ${scope === '*' ? 'active' : ''}" data-scope="*"><span class="contract-dot"></span>Alle Umfänge<span>${data.nodes.length - 1}</span></button>` + contracts().map(c => `<button class="contract-button ${scope === c ? 'active' : ''}" data-scope="${e(c)}"><span class="contract-dot"></span>${e(c)}<span>${data.nodes.filter(n => n.parentId && effectiveContract(data, n.id) === c).length}</span></button>`).join('');
  $('#mobile-scope').innerHTML = '<option value="*">Alle Vertragsumfänge</option>' + contracts().map(c => `<option value="${e(c)}">${e(c)}</option>`).join(''); $('#mobile-scope').value = scope;
  document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  $('#undo').disabled = !undo.length; $('#redo').disabled = !redo.length;
  $('#canvas').hidden = view !== 'map'; $('#list-view').hidden = view === 'map';
  $('#relationship-bar').hidden = view !== 'map';
  $('.zoom-controls').hidden = view !== 'map';
  $('#canvas-hint').textContent = view === 'map' ? 'Ziehen: frei verschieben · Alt+Ziehen: umhängen' : view === 'questions' ? 'Fragen direkt beim zugehörigen Element bearbeiten' : 'Reihenfolge im Detailbereich mit ↑ und ↓ ändern';
  if (view === 'map') renderMap(); else renderList();
}
function renderMap() {
  const { matching, visible } = activeNodes(); positions = new Map();
  let nextY = 0;
  function layout(n, depth) {
    if (!visible.has(n.id)) return null;
    const kids = collapsed.has(n.id) && !search && scope === '*' ? [] : children(data, n.id).filter(c => visible.has(c.id));
    const childYs = kids.map(c => layout(c, depth + 1)).filter(y => y !== null);
    const y = childYs.length ? (childYs[0] + childYs.at(-1)) / 2 : nextY;
    if (!childYs.length) nextY += 144;
    positions.set(n.id, { x: depth * 290, y }); return y;
  }
  layout(root(), 0);
  for (const [key, p] of positions) { const offset = nodeOffsets.get(key); if (offset) { p.x += offset.x; p.y += offset.y; } }
  const left = Math.min(0, ...[...positions.values()].map(p => p.x)), top = Math.min(0, ...[...positions.values()].map(p => p.y));
  bounds = { left, top, width: Math.max(226, ...[...positions.values()].map(p => p.x + 250)) - left, height: Math.max(120, ...[...positions.values()].map(p => p.y + 130)) - top };
  $('#empty').hidden = positions.size > 0;
  $('#nodes').innerHTML = [...positions.entries()].map(([key, p]) => {
    const n = node(key), kids = children(data, key), open = n.questions.filter(q => q.status === 'open').length;
    return `<div tabindex="0" role="button" aria-label="${e(n.title)}: ${e(types[n.type])}" class="node ${n.parentId === null ? 'root' : ''} ${key === selected ? 'selected' : ''} ${matching.has(key) ? '' : 'dimmed'}" style="left:${p.x}px;top:${p.y}px" data-node="${e(key)}" draggable="${n.parentId !== null}"><div class="node-topline">${n.type === 'group' ? '▦' : n.type === 'requirement' ? '≡' : '▧'} ${e(types[n.type])}</div><span class="node-title">${e(n.title)}</span><div class="node-meta">${kids.length ? `<span>${kids.length} Unterelement${kids.length === 1 ? '' : 'e'}</span>` : '<span>Details öffnen ↗</span>'}${open ? `<span class="question-badge">? ${open}</span>` : ''}${n.contract ? `<span class="scope-badge">${e(n.contract)}</span>` : ''}</div><div class="node-controls"><button class="node-add" data-add="${e(key)}" title="Element oder Abhängigkeit hinzufügen" aria-label="Zu ${e(n.title)} hinzufügen">+</button>${kids.length ? `<button class="node-toggle" data-collapse="${e(key)}" title="${collapsed.has(key) ? 'Unterelemente ausklappen' : 'Unterelemente einklappen'}" aria-label="${e(n.title)}: Unterelemente ${collapsed.has(key) ? 'ausklappen' : 'einklappen'}" aria-expanded="${!collapsed.has(key)}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg></button>` : ''}<button class="node-more" data-node-options="${e(key)}" title="Weitere Optionen" aria-label="Optionen für ${e(n.title)}">⋯</button></div></div>`;
  }).join('');
  const lines = [];
  for (const [key, p] of positions) { const parent = positions.get(node(key).parentId); if (parent) lines.push(`<path d="M${parent.x + 226},${parent.y + 46} C${parent.x + 266},${parent.y + 46} ${p.x - 40},${p.y + 46} ${p.x},${p.y + 46}"/>`); }
  lines.push('<defs><marker id="requires-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><polygon points="0,0 10,5 0,10" fill="#346c99"/></marker></defs>');
  const relationships = data.links.filter(l => l.source === selected || l.target === selected);
  relationships.forEach((l, index) => {
    const a = positions.get(l.source), b = positions.get(l.target);
    if (!a || !b) return;
    const label = l.type === 'requires' ? 'Benötigt' : 'Siehe auch';
    // Route through the gap beside the cards instead of through their contents.
    const lane = Math.max(a.x, b.x) + 256 + (index % 3) * 9;
    const startY = a.y + 82, endY = b.y + 82;
    const labelY = (startY + endY) / 2;
    const route = a.y === b.y
      ? `M${a.x + 113},${a.y + 112} V${a.y + 130} H${b.x + 113} V${b.y + 115}`
      : `M${a.x + 226},${startY} H${lane} V${endY} H${b.x + 230}`;
    const labelTransform = a.y === b.y
      ? `translate(${(a.x + b.x) / 2 + 113},${a.y + 130})`
      : `translate(${lane},${labelY}) rotate(-90)`;
    lines.push(`<g class="relationship-edge"><title>${e(node(l.source).title)} – ${label}: ${e(node(l.target).title)}</title><path class="relationship ${l.type}" d="${route}" ${l.type === 'requires' ? 'marker-end="url(#requires-arrow)"' : ''}/><g class="relationship-label" transform="${labelTransform}"><rect x="-48" y="-11" width="96" height="22" rx="5"/><text text-anchor="middle" dominant-baseline="central">${index + 1} · ${label}</text></g></g>`);
  });
  $('#relationship-bar').hidden = relationships.length === 0;
  $('#relationship-bar').innerHTML = `<span class="relationship-caption">Verbindungen der Auswahl</span>${relationships.map((l, index) => `<button class="relationship-summary" data-select="${e(l.source === selected ? l.target : l.source)}"><span class="relationship-number">${index + 1}</span><span>${e(node(l.source).title)} <strong>${l.type === 'requires' ? 'benötigt →' : '↔ siehe auch'}</strong> ${e(node(l.target).title)}${positions.has(l.source) && positions.has(l.target) ? '' : ' (außerhalb der Ansicht)'}</span></button>`).join('')}`;
  $('#edges').innerHTML = lines.join(''); transform();
  $('#canvas').classList.toggle('connecting', !!dependencyDraft);
  if (dependencyDraft) $(`#nodes [data-node="${dependencyDraft.source}"]`)?.classList.add('dependency-source');
}
function renderList() {
  const { matching, visible } = activeNodes();
  if (view === 'questions') {
    const questions = data.nodes.filter(n => matching.has(n.id)).flatMap(n => n.questions.filter(q => q.status === 'open').map(q => ({ n, q })));
    $('#list-view').innerHTML = `<h2 class="question-list-heading">Offene Fragen <span class="question-badge">${questions.length}</span></h2><p class="question-list-caption">Alles, was vor der Fertigstellung noch geklärt werden muss.</p>${questions.map(({ n, q }) => `<article class="question-list-item"><button class="text-button" data-select="${e(n.id)}">${e(n.title)} ↗</button><h3>${e(q.text)}</h3>${q.answer ? `<p>${e(q.answer)}</p>` : ''}<div class="question-controls"><button class="quiet" data-resolve="${e(q.id)}" data-owner="${e(n.id)}">✓ Als geklärt markieren</button></div></article>`).join('') || '<div class="inspector-empty">Keine offenen Fragen in dieser Auswahl.</div>'}`;
    return;
  }
  const rows = [];
  function walk(n, depth) { if (!visible.has(n.id)) return; rows.push(`<div class="outline-row ${selected === n.id ? 'selected' : ''}" style="padding-left:${12 + depth * 22}px"><button data-select="${e(n.id)}">${e(n.title)}</button><small>${e(types[n.type])}</small>${n.questions.some(q => q.status === 'open') ? '<span class="question-badge">?</span>' : ''}</div>`); children(data, n.id).forEach(c => walk(c, depth + 1)); }
  walk(root(), 0); $('#list-view').innerHTML = rows.join('') || '<div class="inspector-empty">Keine passenden Elemente.</div>';
}
function field(label, name, value, text = false, hint = '') { return `<label class="field"><span>${label}</span>${text ? `<textarea data-field="${name}">${e(value)}</textarea>` : `<input data-field="${name}" value="${e(value)}">`}${hint ? `<small>${hint}</small>` : ''}</label>`; }
function criterionRow(value = '') {
  return `<li><span class="criterion-text" contenteditable="plaintext-only" role="textbox" aria-label="Abnahmekriterium" data-placeholder="Kriterium formulieren …">${e(value)}</span><button class="criterion-remove" title="Kriterium entfernen" aria-label="Kriterium entfernen">×</button></li>`;
}
function criteriaEditor(n) {
  return `<section class="criteria-editor" aria-label="Abnahmekriterien"><div class="section-title">Abnahmekriterien</div><ul class="criteria-list">${(n.criteria.length ? n.criteria : ['']).map(criterionRow).join('')}</ul><button class="text-button" data-add-criterion>+ Kriterium</button></section>`;
}
function syncCriteria(record = true) {
  const n = selectedNode(); if (!n) return;
  const values = [...$('#inspector').querySelectorAll('.criterion-text')].map(el => el.textContent.trim()).filter(Boolean);
  if (JSON.stringify(values) === JSON.stringify(n.criteria)) return;
  if (record) checkpoint();
  n.criteria = values; changed();
}
function focusCriterion(element, atStart = false) {
  element.focus();
  const range = document.createRange(); range.selectNodeContents(element); range.collapse(atStart);
  const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
}
function insertCriterion(after, text = '') {
  const wrapper = document.createElement('ul'); wrapper.innerHTML = criterionRow(text);
  const row = wrapper.firstElementChild;
  if (after) after.after(row); else $('#inspector .criteria-list').append(row);
  return row.querySelector('.criterion-text');
}
$('#inspector').addEventListener('input', event => {
  const editor = event.target.closest('.criterion-text'); if (!editor) return;
  syncCriteria(!editor.dataset.recorded); editor.dataset.recorded = '1';
});
$('#inspector').addEventListener('focusout', event => {
  const editor = event.target.closest('.criterion-text'); if (editor) delete editor.dataset.recorded;
});
$('#inspector').addEventListener('click', event => {
  if (event.target.closest('[data-add-criterion]')) {
    const last = $('#inspector .criteria-list li:last-child .criterion-text');
    focusCriterion(last && !last.textContent.trim() ? last : insertCriterion(null));
  }
  const remove = event.target.closest('.criterion-remove');
  if (remove) {
    const row = remove.closest('li'), next = row.nextElementSibling || row.previousElementSibling;
    row.remove(); syncCriteria();
    focusCriterion(next?.querySelector('.criterion-text') || insertCriterion(null));
  }
});
$('#inspector').addEventListener('keydown', event => {
  const editor = event.target.closest('.criterion-text'); if (!editor || event.isComposing) return;
  if (event.key === 'Enter') {
    event.preventDefault();
    const selection = window.getSelection();
    if (!selection.rangeCount || !editor.contains(selection.anchorNode) || !editor.contains(selection.focusNode)) return;
    const range = selection.getRangeAt(0); range.deleteContents();
    const tail = range.cloneRange(); tail.setEnd(editor, editor.childNodes.length);
    const rest = tail.toString(); tail.deleteContents();
    const next = insertCriterion(editor.closest('li'), rest); syncCriteria(); focusCriterion(next, true);
  } else if (event.key === 'Backspace' && !editor.textContent && editor.closest('li').previousElementSibling) {
    event.preventDefault();
    const row = editor.closest('li'), previous = row.previousElementSibling.querySelector('.criterion-text');
    row.remove(); syncCriteria(); focusCriterion(previous);
  }
});
$('#inspector').addEventListener('paste', event => {
  const editor = event.target.closest('.criterion-text'); if (!editor) return;
  event.preventDefault();
  const selection = window.getSelection();
  if (!selection.rangeCount || !editor.contains(selection.anchorNode) || !editor.contains(selection.focusNode)) return;
  const range = selection.getRangeAt(0); range.deleteContents();
  const tail = range.cloneRange(); tail.setEnd(editor, editor.childNodes.length);
  const rest = tail.toString(); tail.deleteContents();
  const lines = event.clipboardData.getData('text/plain').replace(/\r/g, '').split('\n');
  editor.append(document.createTextNode(lines.shift()));
  let current = editor;
  for (const line of lines) current = insertCriterion(current.closest('li'), line);
  current.append(document.createTextNode(rest)); syncCriteria(); focusCriterion(current);
});
function renderInspector() {
  const n = selectedNode(); if (!n) { $('#inspector').innerHTML = '<p class="inspector-empty">Wähle ein Element im Baum aus.</p>'; return; }
  const isRoot = n.parentId === null;
  $('#inspector').innerHTML = `<div class="inspector-heading"><span class="type-chip">${e(types[n.type])}</span><button class="icon-button" data-action="close-inspector" title="Auswahl schließen">×</button></div><input class="title-input" data-field="title" aria-label="Titel" value="${e(n.title)}"><div class="element-id">${e(n.id)}</div>${isRoot ? field('Kunde', 'doc.customer', data.document.customer) + field('Dokumentversion', 'doc.version', data.document.version) + `<label class="field"><span>Dokumentdatum</span><input type="date" data-field="doc.date" value="${e(data.document.date)}"></label>` : `<label class="field"><span>Aufwandsschätzung</span><div class="effort">${[1, 2, 3, 4].map(v => `<button data-effort="${v}" class="${n.effort === v ? 'active' : ''}" title="${v}: ${['', 'gering', 'mittel', 'erhöht', 'hoch'][v]} · erneut klicken zum Entfernen">${v}</button>`).join('')}</div><small>1 = gering · 4 = hoch · nur intern</small></label>`}${field('Beschreibung', 'description', n.description, true)}${criteriaEditor(n)}${field('Nicht im Leistungsumfang', 'exclusions', n.exclusions, true)}<label class="field"><span>Vertragsumfang</span><input data-field="contract" list="contract-names" value="${e(n.contract)}" placeholder="Vom übergeordneten Element erben"><datalist id="contract-names">${contracts().map(c => `<option value="${e(c)}"></option>`).join('')}</datalist><small>Aktuell: ${e(effectiveContract(data, n.id))}. Ein eigener Name isoliert diesen Teilbaum; Unterelemente erben ihn.</small></label><div class="inspector-section"><div class="section-header"><span class="section-title">Offene Fragen <span class="question-badge">${n.questions.filter(q => q.status === 'open').length}</span></span><button class="text-button" data-action="add-question">+ Frage</button></div>${n.questions.map(q => `<div class="question-card ${q.status === 'resolved' ? 'resolved' : ''}"><textarea aria-label="Frage" data-question="${e(q.id)}" data-qfield="text">${e(q.text)}</textarea><textarea class="answer" aria-label="Antwort" placeholder="Antwort oder Zwischenstand …" data-question="${e(q.id)}" data-qfield="answer">${e(q.answer)}</textarea><div class="question-controls"><select aria-label="Status der Frage" data-question="${e(q.id)}" data-qfield="status"><option value="open" ${q.status === 'open' ? 'selected' : ''}>Offen</option><option value="resolved" ${q.status === 'resolved' ? 'selected' : ''}>Geklärt</option></select><button data-delete-question="${e(q.id)}" title="Frage löschen">×</button></div></div>`).join('') || '<p class="element-id">Noch keine Fragen erfasst.</p>'}</div><div class="inspector-section">${field('Interne Notizen <span class="internal-label">Nicht im PDF</span>', 'notes', n.notes, true)}</div><div class="inspector-section"><div class="section-header"><span class="section-title">Referenzen & Abhängigkeiten</span></div>${data.links.filter(l => l.source === n.id || l.target === n.id).map(l => { const outgoing = l.source === n.id, other = node(outgoing ? l.target : l.source); return `<div class="reference-row"><button data-select="${e(other.id)}"><small>${l.type === 'reference' ? 'Siehe auch' : outgoing ? 'Benötigt' : 'Wird benötigt von'}</small>${e(other.title)} ↗</button><button data-delete-link="${e(l.id)}" title="Verbindung entfernen">×</button></div>`; }).join('')}<div class="link-form"><select id="link-type" aria-label="Art der Verbindung"><option value="requires">Benötigt</option><option value="reference">Siehe auch</option></select><select id="link-target" aria-label="Verknüpftes Element"><option value="">Element auswählen …</option>${data.nodes.filter(other => other.id !== n.id).map(other => `<option value="${e(other.id)}">${e(other.title)}</option>`).join('')}</select><button data-action="add-link">+ Verbindung anlegen</button></div></div><div class="element-actions">${n.type !== 'requirement' ? '<button data-action="add-child">+ Unterelement</button>' : ''}${!isRoot ? '<button data-action="duplicate">Duplizieren</button><button data-action="up" title="Nach oben verschieben">↑</button><button data-action="down" title="Nach unten verschieben">↓</button><button class="danger" data-action="delete">Löschen</button>' : ''}<button data-action="export-node">Umfang als PDF ↗</button></div>${!isRoot ? `<label class="field" style="margin-top:18px"><span>Übergeordnetes Element</span><select data-field="parentId">${data.nodes.filter(p => p.type !== 'requirement' && !descendants(data, n.id).has(p.id)).map(p => `<option value="${e(p.id)}" ${p.id === n.parentId ? 'selected' : ''}>${e(p.title)}</option>`).join('')}</select></label>` : ''}`;
}
let addChoices = null;
function closeAddChoices(restoreFocus = false) {
  if (!addChoices) return;
  const { menu, anchor } = addChoices;
  anchor.setAttribute('aria-expanded', 'false');
  menu.remove(); addChoices = null;
  if (restoreFocus && anchor.isConnected) anchor.focus();
}
function addChild(parentId, anchor) {
  const parent = node(parentId); if (!parent) return;
  const wasOpen = addChoices?.anchor === anchor;
  closeAddChoices(); if (wasOpen) return;
  const menu = document.createElement('div'); menu.className = 'add-choices';
  menu.setAttribute('role', 'group'); menu.setAttribute('aria-label', `Unterelement zu ${parent.title} hinzufügen`);
  const options = parent.type === 'requirement' ? ['dependency'] : ['group', 'package', 'requirement', 'dependency'];
  menu.innerHTML = options.map((type, index) => `<button data-create-type="${type}" style="--choice-index:${index}"><span aria-hidden="true">${{ group: '▦', package: '▧', requirement: '≡', dependency: '↗' }[type]}</span>${type === 'dependency' ? 'Abhängigkeit' : e(types[type])}</button>`).join('');
  document.body.append(menu); addChoices = { menu, anchor }; anchor.setAttribute('aria-expanded', 'true');
  const rect = anchor.getBoundingClientRect(), size = { width: menu.offsetWidth, height: menu.offsetHeight };
  menu.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - size.width - 8))}px`;
  const above = rect.bottom + size.height + 10 > innerHeight;
  menu.style.top = `${Math.max(8, above ? rect.top - size.height - 8 : rect.bottom + 8)}px`;
  menu.style.transformOrigin = above ? 'bottom left' : 'top left';
  menu.addEventListener('click', event => {
    const choice = event.target.closest('[data-create-type]'); if (!choice) return;
    if (choice.dataset.createType === 'dependency') { closeAddChoices(); startDependency(parentId, event); return; }
    const type = choice.dataset.createType, key = id(type);
    closeAddChoices();
    view = 'map'; search = ''; $('#search').value = '';
    if (scope !== '*') scope = effectiveContract(data, parentId);
    mutate(() => {
      data.nodes.push({ id: key, parentId, type, title: type === 'package' ? 'Neues Arbeitspaket' : type === 'group' ? 'Neue Paketgruppe' : 'Neue Anforderung', description: '', criteria: [], exclusions: '', notes: '', effort: null, contract: '', questions: [] });
      collapsed.delete(parentId); selected = key;
    });
    if (!node(key)) return;
    zoom = Math.max(zoom, .9); select(key, true); editNodeTitle(key, true);
  });
  menu.addEventListener('keydown', event => {
    const buttons = [...menu.querySelectorAll('button')], index = buttons.indexOf(document.activeElement);
    if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus();
    }
  });
  menu.querySelector('button').focus({ preventScroll: true });
}
function editNodeTitle(key, animate = false) {
  const card = $(`#nodes [data-node="${key}"]`), title = card?.querySelector('.node-title'), n = node(key);
  if (!title || !n || card.querySelector('.node-title-editor')) return;
  const original = n.title, input = document.createElement('input');
  input.className = 'node-title-editor'; input.value = original; input.setAttribute('aria-label', 'Titel des neuen Elements');
  input.title = 'Enter: übernehmen · Escape: bisherigen Titel behalten';
  title.replaceWith(input); card.draggable = false;
  if (animate) card.classList.add('node-created');
  let finished = false, recorded = false;
  const finish = cancel => {
    if (finished) return; finished = true;
    n.title = cancel ? original : input.value.trim() || original;
    backup();
    const label = document.createElement('span'); label.className = 'node-title'; label.textContent = n.title;
    input.replaceWith(label); card.draggable = n.parentId !== null;
    // Let an outside click reach its original target before rebuilding the tree.
    requestAnimationFrame(() => { renderOverview(); renderInspector(); });
  };
  input.addEventListener('input', () => {
    if (!recorded) { checkpoint(); recorded = true; }
    n.title = input.value.trim() || original;
    dirty = true; backup(); updateSaveStatus();
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === 'Escape') { event.stopPropagation(); event.preventDefault(); finish(event.key === 'Escape'); card.focus({ preventScroll: true }); }
  });
  input.addEventListener('blur', () => finish(false));
  input.focus({ preventScroll: true }); input.select();
}
function openNodeOptions(key, anchor) {
  const n = node(key); if (!n) return;
  const wasOpen = addChoices?.anchor === anchor;
  closeAddChoices(); if (wasOpen) return;
  const menu = document.createElement('div'); menu.className = 'add-choices node-options';
  menu.setAttribute('role', 'group'); menu.setAttribute('aria-label', `Optionen für ${n.title}`);
  menu.innerHTML = `${n.parentId !== null ? '<button data-node-action="duplicate">Duplizieren</button>' : ''}<button data-node-action="export-node">Umfang als PDF ↗</button>${n.parentId !== null ? '<button class="danger" data-node-action="delete">Löschen</button>' : ''}`;
  document.body.append(menu); addChoices = { menu, anchor }; anchor.setAttribute('aria-expanded', 'true');
  const rect = anchor.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(rect.right + 8, innerWidth - menu.offsetWidth - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(rect.top, innerHeight - menu.offsetHeight - 8))}px`;
  menu.addEventListener('click', event => {
    const action = event.target.closest('[data-node-action]')?.dataset.nodeAction;
    if (!action) return;
    closeAddChoices(); select(key);
    $(`#inspector [data-action="${action}"]`)?.click();
  });
  menu.addEventListener('keydown', event => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault(); const buttons = [...menu.querySelectorAll('button')], index = buttons.indexOf(document.activeElement);
    buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length].focus();
  });
  menu.querySelector('button').focus({ preventScroll: true });
}
document.addEventListener('pointerdown', event => { if (addChoices && !addChoices.menu.contains(event.target) && !addChoices.anchor.contains(event.target)) closeAddChoices(); }, true);
document.addEventListener('keydown', event => { if (event.key === 'Escape' && addChoices) { event.preventDefault(); closeAddChoices(true); } });
document.addEventListener('focusin', event => { if (addChoices && !addChoices.menu.contains(event.target) && !addChoices.anchor.contains(event.target)) closeAddChoices(); });
window.addEventListener('resize', () => closeAddChoices());
document.addEventListener('scroll', () => closeAddChoices(), true);
function startDependency(source, event) {
  view = 'map'; search = ''; $('#search').value = '';
  if (scope !== '*' && effectiveContract(data, source) !== scope) scope = '*';
  select(source, true);
  dependencyDraft = { source, clientX: event.clientX, clientY: event.clientY };
  $('#dependency-prompt').hidden = false;
  $('#dependency-prompt span').textContent = `„${node(source).title}“ benötigt … Ziel im Baum anklicken.`;
  renderMap();
}
function cancelDependency() {
  dependencyDraft = null; $('#dependency-prompt').hidden = true;
  $('#canvas').classList.remove('connecting');
  $('.dependency-source')?.classList.remove('dependency-source');
  $('#dependency-preview')?.remove();
}
function completeDependency(target) {
  const source = dependencyDraft?.source; if (!source) return;
  if (source === target) return toast('Bitte ein anderes Element als Ziel wählen.');
  if (!node(source) || !node(target)) { cancelDependency(); return; }
  if (data.links.some(l => l.type === 'requires' && l.source === source && l.target === target)) return toast('Diese Abhängigkeit besteht bereits. Wähle ein anderes Ziel oder drücke Escape.');
  cancelDependency();
  mutate(() => { data.links.push({ id: id('link'), source, target, type: 'requires' }); selected = source; });
}
function updateDependencyPreview() {
  if (!dependencyDraft) return;
  const source = positions.get(dependencyDraft.source);
  if (!source) { cancelDependency(); return; }
  const rect = $('#canvas').getBoundingClientRect();
  const x = (dependencyDraft.clientX - rect.left - pan.x) / zoom, y = (dependencyDraft.clientY - rect.top - pan.y) / zoom;
  let arrow = $('#dependency-preview');
  if (!arrow) { arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path'); arrow.id = 'dependency-preview'; arrow.setAttribute('marker-end', 'url(#requires-arrow)'); $('#edges').append(arrow); }
  const startX = source.x + 226, startY = source.y + 82, bend = Math.max(45, Math.abs(x - startX) / 2);
  arrow.setAttribute('d', `M${startX},${startY} C${startX + bend},${startY} ${x - bend},${y} ${x},${y}`);
}
$('#cancel-dependency').onclick = cancelDependency;
document.addEventListener('keydown', event => { if (event.key === 'Escape' && dependencyDraft) { event.preventDefault(); cancelDependency(); } });
document.addEventListener('click', event => {
  if (!dependencyDraft) return;
  const card = event.target.closest('#nodes [data-node]');
  if (card) { event.preventDefault(); event.stopImmediatePropagation(); completeDependency(card.dataset.node); }
}, true);
const inspectorWidthKey = `arch-contracter-inspector-width:${location.port}`;
const workspace = $('.workspace'), inspectorResizer = $('#inspector-resizer');
let preferredInspectorWidth = null, inspectorDrag = null;
try { const savedWidth = Number(localStorage.getItem(inspectorWidthKey)); if (Number.isFinite(savedWidth) && savedWidth >= 280) preferredInspectorWidth = savedWidth; } catch {}
function inspectorLimits() {
  const sidebar = $('.sidebar');
  const sidebarWidth = getComputedStyle(sidebar).display === 'none' ? 0 : sidebar.getBoundingClientRect().width;
  return { min: 280, max: Math.max(280, Math.floor(workspace.clientWidth - sidebarWidth - 320)) };
}
function applyInspectorWidth() {
  if (innerWidth <= 650) return;
  const { min, max } = inspectorLimits();
  const defaultWidth = parseFloat(getComputedStyle(workspace).getPropertyValue('--inspector-default')) || 345;
  const width = Math.round(Math.max(min, Math.min(max, preferredInspectorWidth ?? defaultWidth)));
  workspace.style.setProperty('--inspector-width', `${width}px`);
  inspectorResizer.setAttribute('aria-valuemin', String(min));
  inspectorResizer.setAttribute('aria-valuemax', String(max));
  inspectorResizer.setAttribute('aria-valuenow', String(width));
  inspectorResizer.setAttribute('aria-valuetext', `${width} Pixel breit`);
}
function rememberInspectorWidth() {
  try { if (preferredInspectorWidth === null) localStorage.removeItem(inspectorWidthKey); else localStorage.setItem(inspectorWidthKey, String(preferredInspectorWidth)); } catch {}
}
inspectorResizer.addEventListener('pointerdown', event => {
  if (event.button !== 0 || innerWidth <= 650) return;
  event.preventDefault(); closeAddChoices(); inspectorResizer.focus({ preventScroll: true });
  inspectorDrag = { pointerId: event.pointerId, startX: event.clientX, startWidth: $('#inspector').getBoundingClientRect().width };
  inspectorResizer.setPointerCapture(event.pointerId); document.body.classList.add('resizing-inspector');
});
inspectorResizer.addEventListener('pointermove', event => {
  if (!inspectorDrag || event.pointerId !== inspectorDrag.pointerId) return;
  const { min, max } = inspectorLimits();
  preferredInspectorWidth = Math.max(min, Math.min(max, inspectorDrag.startWidth + inspectorDrag.startX - event.clientX));
  applyInspectorWidth();
});
function finishInspectorResize() {
  if (!inspectorDrag) return;
  const pointerId = inspectorDrag.pointerId; inspectorDrag = null;
  document.body.classList.remove('resizing-inspector');
  if (inspectorResizer.hasPointerCapture(pointerId)) inspectorResizer.releasePointerCapture(pointerId);
  rememberInspectorWidth();
}
for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) inspectorResizer.addEventListener(eventName, finishInspectorResize);
inspectorResizer.addEventListener('dblclick', () => { preferredInspectorWidth = null; applyInspectorWidth(); rememberInspectorWidth(); });
inspectorResizer.addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const { min, max } = inspectorLimits(), current = $('#inspector').getBoundingClientRect().width, step = event.shiftKey ? 50 : 20;
  preferredInspectorWidth = event.key === 'Home' ? min : event.key === 'End' ? max : Math.max(min, Math.min(max, current + (event.key === 'ArrowLeft' ? step : -step)));
  applyInspectorWidth(); rememberInspectorWidth();
});
window.addEventListener('resize', applyInspectorWidth);
applyInspectorWidth();
function transform() { $('#world').style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`; $('#zoom-label').textContent = `${Math.round(zoom * 100)}%`; updateDependencyPreview(); }
function fit() { if (view !== 'map') return; const canvas = $('#canvas'); zoom = Math.max(.25, Math.min(1, (canvas.clientWidth - 65) / bounds.width, (canvas.clientHeight - 60) / bounds.height)); pan = { x: (canvas.clientWidth - bounds.width * zoom) / 2 - (bounds.left || 0) * zoom, y: (canvas.clientHeight - bounds.height * zoom) / 2 - (bounds.top || 0) * zoom }; transform(); }
function setZoom(value, x = $('#canvas').clientWidth / 2, y = $('#canvas').clientHeight / 2) { const next = Math.max(.2, Math.min(2, value)); pan = { x: x - (x - pan.x) * next / zoom, y: y - (y - pan.y) * next / zoom }; zoom = next; transform(); }
function history(direction) { const from = direction === 'undo' ? undo : redo, to = direction === 'undo' ? redo : undo; if (!from.length) return; to.push(clone(data)); data = from.pop(); if (!selectedNode()) selected = root().id; changed(); renderInspector(); }
function reorder(step) { const n = selectedNode(), siblings = children(data, n.parentId), index = siblings.findIndex(s => s.id === n.id), other = siblings[index + step]; if (!other) return; mutate(() => { const a = data.nodes.indexOf(n), b = data.nodes.indexOf(other); [data.nodes[a], data.nodes[b]] = [data.nodes[b], data.nodes[a]]; }); }
function openExport(contract = scope) { $('#export-scope').innerHTML = '<option value="*">Gesamtes Lastenheft</option>' + contracts().map(c => `<option value="${e(c)}">${e(c)}</option>`).join(''); $('#export-scope').value = contract; renderExport(); $('#export-dialog').showModal(); }
function renderExport() {
  const contract = $('#export-scope').value, { included, warnings } = exportSelection(data, contract);
  const opens = data.nodes.filter(n => included.has(n.id) || (contract === '*' && n.parentId === null)).reduce((sum, n) => sum + n.questions.filter(q => q.status === 'open').length, 0);
  $('#export-warnings').innerHTML = (warnings.length ? `<p>${warnings.length} Abhängigkeit(en) führen aus dem ausgewählten Umfang heraus und werden als Voraussetzung im Dokument genannt.</p>` : '') + (opens ? `<p>${opens} offene Frage(n) in diesem Umfang. Prüfe vor dem Versand, ob noch Klärungsbedarf besteht.</p>` : '') + (!included.size ? '<p>Dieser Vertragsumfang enthält noch keine Pakete oder Anforderungen.</p>' : '');
  try {
    const pageCount = paginateDocument(documentHtml(data, contract, $('#export-questions').checked), $('#preview-content'));
    $('#print').disabled = false;
    $('#print').textContent = `Als PDF drucken · ${pageCount} ${pageCount === 1 ? 'Seite' : 'Seiten'} ↗`;
  } catch (error) {
    $('#preview-content').replaceChildren(); $('#print').disabled = true;
    $('#export-warnings').innerHTML += `<p>${e(error.message)}</p>`;
  }
}
document.addEventListener('click', event => {
  const b = event.target.closest('button'); if (!b || !data) return;
  if (b.dataset.view) return setView(b.dataset.view);
  if (b.dataset.scope) { scope = b.dataset.scope; renderOverview(); fit(); return; }
  if (b.dataset.select) return select(b.dataset.select, true);
  if (b.dataset.add) return addChild(b.dataset.add, b);
  if (b.dataset.nodeOptions) return openNodeOptions(b.dataset.nodeOptions, b);
  if (b.dataset.collapse) { collapsed.has(b.dataset.collapse) ? collapsed.delete(b.dataset.collapse) : collapsed.add(b.dataset.collapse); renderMap(); return; }
  if (b.dataset.effort) return mutate(() => selectedNode().effort = selectedNode().effort === Number(b.dataset.effort) ? null : Number(b.dataset.effort));
  if (b.dataset.deleteQuestion) { if (confirm('Diese Frage und ihre Antwort löschen?')) mutate(() => selectedNode().questions = selectedNode().questions.filter(q => q.id !== b.dataset.deleteQuestion)); return; }
  if (b.dataset.deleteLink) return mutate(() => data.links = data.links.filter(l => l.id !== b.dataset.deleteLink));
  if (b.dataset.resolve) return mutate(() => node(b.dataset.owner).questions.find(q => q.id === b.dataset.resolve).status = 'resolved');
  const action = b.dataset.action;
  if (action === 'reload') return load(); if (action === 'download') return download();
  if (action === 'close-inspector') { selected = null; renderOverview(); renderInspector(); return; }
  if (action === 'add-child') return addChild(selected, b);
  if (action === 'add-question') { mutate(() => selectedNode().questions.push({ id: id('q'), text: 'Neue Frage', answer: '', status: 'open' })); const inputs = $('#inspector').querySelectorAll('[data-qfield="text"]'); inputs[inputs.length - 1]?.focus(); inputs[inputs.length - 1]?.select(); return; }
  if (action === 'add-link') { const target = $('#link-target').value, type = $('#link-type').value; if (!target) return toast('Bitte ein Element auswählen.'); if (data.links.some(l => l.source === selected && l.target === target && l.type === type)) return toast('Diese Verbindung ist bereits vorhanden.'); return mutate(() => data.links.push({ id: id('link'), source: selected, target, type })); }
  if (action === 'up' || action === 'down') return reorder(action === 'up' ? -1 : 1);
  if (action === 'delete') { const n = selectedNode(), count = descendants(data, n.id).size; if (confirm(`„${n.title}“${count > 1 ? ` mit ${count - 1} Unterelementen` : ''} löschen? Zugehörige Verbindungen werden ebenfalls entfernt.`)) mutate(() => { removeNode(data, n.id); selected = n.parentId; }); return; }
  if (action === 'duplicate') return mutate(() => { const n = selectedNode(), ids = descendants(data, n.id), mapping = new Map([...ids].map(key => [key, id(node(key).type)])); const copies = data.nodes.filter(item => ids.has(item.id)).map(item => ({ ...clone(item), id: mapping.get(item.id), parentId: item.id === n.id ? n.parentId : mapping.get(item.parentId), title: item.id === n.id ? `${item.title} (Kopie)` : item.title, questions: item.questions.map(q => ({ ...q, id: id('q') })) })); const links = data.links.filter(l => ids.has(l.source)).map(l => ({ ...l, id: id('link'), source: mapping.get(l.source), target: mapping.get(l.target) || l.target })); data.nodes.push(...copies); data.links.push(...links); selected = mapping.get(n.id); });
  if (action === 'export-node') return openExport(effectiveContract(data, selected));
});
$('#inspector').addEventListener('focusin', event => { if (event.target.matches('[data-field],[data-question]')) event.target.dataset.original = event.target.value; });
$('#inspector').addEventListener('input', event => {
  const input = event.target, n = selectedNode(); if (!n || !input.matches('input[data-field],textarea[data-field],textarea[data-question]')) return;
  if (!input.dataset.checkpoint) { checkpoint(); input.dataset.checkpoint = '1'; }
  if (input.dataset.question) { const q = n.questions.find(q => q.id === input.dataset.question); q[input.dataset.qfield] = input.value; }
  else { const key = input.dataset.field; if (key.startsWith('doc.')) data.document[key.slice(4)] = input.value; else if (key === 'criteria') n.criteria = input.value.split('\n').filter(s => s.trim()); else n[key] = input.value; if (key === 'title' && n.parentId === null) data.document.title = input.value; }
  changed();
});
$('#inspector').addEventListener('change', event => {
  const input = event.target, n = selectedNode(); if (!n) return;
  if (input.tagName === 'SELECT') {
    if (input.dataset.question) mutate(() => n.questions.find(q => q.id === input.dataset.question)[input.dataset.qfield] = input.value);
    else if (input.dataset.field === 'parentId') mutate(() => moveNode(data, n.id, input.value));
  } else if (input.matches('[data-field],[data-question]')) {
    if ((input.dataset.field === 'title' || input.dataset.qfield === 'text') && !input.value.trim()) { input.value = input.dataset.original?.trim() || (input.dataset.field ? 'Ohne Titel' : 'Offene Frage'); if (input.dataset.field) { n.title = input.value; if (n.parentId === null) data.document.title = input.value; } else n.questions.find(q => q.id === input.dataset.question).text = input.value; toast('Ein Titel bzw. Fragetext darf nicht leer sein.'); changed(); }
    delete input.dataset.checkpoint;
  }
});
$('#nodes').addEventListener('click', event => { if (performance.now() < ignoreNodeClickUntil || event.target.closest('button,input')) return; const element = event.target.closest('[data-node]'); if (element) select(element.dataset.node); });
$('#nodes').addEventListener('keydown', event => { if (event.target.closest('button,input')) return; if (event.key === 'Enter' || event.key === ' ') { const element = event.target.closest('[data-node]'); if (element) { event.preventDefault(); if (dependencyDraft) completeDependency(element.dataset.node); else select(element.dataset.node); } } });
$('#nodes').addEventListener('dragstart', event => { const element = event.target.closest('[data-node]'); if (dependencyDraft || !event.altKey || nodeDrag || !element || event.target.closest('input,button') || node(element.dataset.node).parentId === null) return event.preventDefault(); dragged = element.dataset.node; event.dataTransfer.setData('text/plain', dragged); event.dataTransfer.effectAllowed = 'move'; });
function dropPlacement(event, element) { const rect = element.getBoundingClientRect(), fraction = (event.clientY - rect.top) / rect.height; return fraction < .25 ? 'before' : fraction > .75 ? 'after' : 'inside'; }
function clearDrop(element) { element?.classList.remove('drag-over', 'drop-before', 'drop-after'); }
$('#nodes').addEventListener('dragover', event => { const element = event.target.closest('[data-node]'); if (!element || !dragged) return; clearDrop(element); const target = node(element.dataset.node), placement = dropPlacement(event, element), parent = placement === 'inside' ? target : node(target.parentId); if (parent && target.id !== dragged && parent.type !== 'requirement' && !descendants(data, dragged).has(parent.id)) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; element.classList.add(placement === 'inside' ? 'drag-over' : `drop-${placement}`); } });
$('#nodes').addEventListener('dragleave', event => { const element = event.target.closest('[data-node]'); if (element && !element.contains(event.relatedTarget)) clearDrop(element); });
$('#nodes').addEventListener('drop', event => { event.preventDefault(); const target = event.target.closest('[data-node]'); if (target && dragged) { const source = dragged, placement = dropPlacement(event, target); mutate(() => { moveNode(data, source, target.dataset.node, placement); collapsed.delete(node(source).parentId); selected = source; }); } dragged = null; });
$('#nodes').addEventListener('dragend', () => { dragged = null; document.querySelectorAll('.drag-over,.drop-before,.drop-after').forEach(clearDrop); });
let pointer;
$('#canvas').addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  if (dependencyDraft) { event.preventDefault(); return; }
  const card = event.target.closest('[data-node]');
  if (card) {
    if (event.altKey || event.target.closest('button,input,[contenteditable]')) return;
    event.preventDefault();
    const key = card.dataset.node;
    nodeDrag = { key, pointerId: event.pointerId, x: event.clientX, y: event.clientY, offset: { ...(nodeOffsets.get(key) || { x: 0, y: 0 }) }, moved: false };
    $('#canvas').setPointerCapture(event.pointerId); return;
  }
  pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, pan: { ...pan } }; $('#canvas').setPointerCapture(event.pointerId); $('#canvas').classList.add('panning');
});
$('#canvas').addEventListener('pointermove', event => {
  if (dependencyDraft) { dependencyDraft.clientX = event.clientX; dependencyDraft.clientY = event.clientY; updateDependencyPreview(); return; }
  if (nodeDrag && nodeDrag.pointerId === event.pointerId) {
    const dx = event.clientX - nodeDrag.x, dy = event.clientY - nodeDrag.y;
    if (!nodeDrag.moved && Math.hypot(dx, dy) < 4) return;
    nodeDrag.moved = true;
    nodeOffsets.set(nodeDrag.key, { x: nodeDrag.offset.x + dx / zoom, y: nodeDrag.offset.y + dy / zoom });
    $('#canvas').classList.add('moving-node'); renderMap(); return;
  }
  if (pointer && pointer.id === event.pointerId) { pan = { x: pointer.pan.x + event.clientX - pointer.x, y: pointer.pan.y + event.clientY - pointer.y }; transform(); }
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) $('#canvas').addEventListener(name, event => {
  if (nodeDrag && nodeDrag.pointerId === event.pointerId) {
    const { key, moved, offset } = nodeDrag; nodeDrag = null;
    if (name === 'pointercancel') nodeOffsets.set(key, offset);
    if (moved) ignoreNodeClickUntil = performance.now() + 300;
    $('#canvas').classList.remove('moving-node');
    if (name === 'pointerup') select(key); else renderMap();
  }
  pointer = null; $('#canvas').classList.remove('panning');
});
$('#canvas').addEventListener('wheel', event => { event.preventDefault(); const rect = $('#canvas').getBoundingClientRect(); if (event.ctrlKey || event.metaKey) setZoom(zoom * Math.exp(-event.deltaY * .003), event.clientX - rect.left, event.clientY - rect.top); else { pan.x -= event.deltaX; pan.y -= event.deltaY; transform(); } }, { passive: false });
$('#search').oninput = event => { search = event.target.value.toLocaleLowerCase('de'); renderOverview(); if (search) fit(); };
$('#mobile-scope').onchange = event => { scope = event.target.value; renderOverview(); fit(); };
$('#save').onclick = save;
$('#reload').onclick = () => load();
$('#download').onclick = download;
$('#upload').onclick = () => $('#upload-input')?.click();
$('#upload-input')?.addEventListener('change', event => {
  const file = event.target.files?.[0];
  if (file) uploadFile(file);
});
$('#reset-default').onclick = resetToDefault;
$('#undo').onclick = () => history('undo'); $('#redo').onclick = () => history('redo');
$('#document-edit').onclick = () => select(root().id, true);
$('#preview').onclick = () => openExport(); $('#close-export').onclick = () => $('#export-dialog').close();
$('#export-scope').onchange = renderExport; $('#export-questions').onchange = renderExport; $('#print').onclick = () => window.print();
$('#fit').onclick = fit; $('#zoom-in').onclick = () => setZoom(zoom * 1.2); $('#zoom-out').onclick = () => setZoom(zoom / 1.2);
$('#reset-layout').onclick = () => { nodeOffsets.clear(); renderMap(); fit(); };
$('#fullscreen').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { toast('Vollbild ist in diesem Browser nicht verfügbar.'); } };
document.addEventListener('keydown', event => { if (!(event.ctrlKey || event.metaKey)) return; if (event.key.toLowerCase() === 's') { event.preventDefault(); document.activeElement?.blur(); save(); } else if (event.key.toLowerCase() === 'z' && !isEditing() && !document.querySelector('dialog[open]')) { event.preventDefault(); history(event.shiftKey ? 'redo' : 'undo'); } });
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('beforeprint', () => { if (data && !$('#export-dialog').open) { $('#export-scope').innerHTML = '<option value="*">Gesamtes Lastenheft</option>'; renderExport(); } });
window.addEventListener('dragover', event => {
  if (event.dataTransfer?.types?.includes('Files')) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }
});
window.addEventListener('drop', event => {
  if (event.dataTransfer?.types?.includes('Files')) {
    const file = event.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.json') || file.type === 'application/json')) {
      event.preventDefault();
      uploadFile(file);
    }
  }
});
window.addEventListener('storage', event => {
  if (event.key !== storageKey || !event.newValue) return;
  try {
    const updated = JSON.parse(event.newValue);
    validate(updated);
    if (dirty || isEditing()) {
      conflict = true;
      notice('Die Daten wurden in einem anderen Tab geändert. Sichere deinen Entwurf oder lade den Stand neu.');
      updateSaveStatus();
    } else {
      data = updated;
      if (!selectedNode()) selected = root().id;
      conflict = false;
      notice('');
      renderOverview();
      renderInspector();
      updateSaveStatus();
      toast('Änderungen aus anderem Tab übernommen.');
    }
  } catch {}
});
let recovered;
try {
  const rawDraft = localStorage.getItem(draftKey);
  if (rawDraft) recovered = JSON.parse(rawDraft);
} catch {}
await load(true);
if (recovered && data) {
  try {
    validate(recovered);
    if (JSON.stringify(recovered) !== JSON.stringify(data) && confirm('Ein ungespeicherter Entwurf wurde gefunden. Wiederherstellen?')) {
      data = recovered;
      dirty = true;
      selected = root().id;
      backup();
      updateSaveStatus();
      renderOverview();
      renderInspector();
      fit();
      toast('Ungespeicherter Entwurf wiederhergestellt.');
    } else {
      try { localStorage.removeItem(draftKey); } catch {}
    }
  } catch {
    toast('Der gespeicherte Entwurf konnte nicht wiederhergestellt werden.');
  }
}
