export const types = { document: 'Lastenheft', group: 'Paketgruppe', package: 'Arbeitspaket', requirement: 'Anforderung' };
export const defaultTemplate = {
  $schema: "../lastenheft.schema.json",
  schemaVersion: 1,
  document: {
    title: "Kundenportal"
  },
  nodes: [
    {
      id: "kundenportal",
      parentId: null,
      type: "document",
      title: "Kundenportal",
      description: "Das Kundenportal bündelt den geschützten Zugang zu Dokumenten und Informationen. Dieses Beispieldokument dient als Ausgangspunkt für die gemeinsame Abstimmung des Leistungsumfangs.",
      criteria: [],
      exclusions: "Laufender Betrieb und Support sind nicht Teil dieses Leistungsumfangs und werden gesondert vereinbart.",
      notes: "Beispieldaten: Titel und Inhalte vor dem Versand anpassen.",
      effort: null,
      contract: "",
      questions: []
    },
    {
      id: "basisprojekt",
      parentId: "kundenportal",
      type: "group",
      title: "Basisprojekt",
      description: "Grundfunktionen für den sicheren Zugang und die gemeinsame Dokumentenablage.",
      criteria: [],
      exclusions: "",
      notes: "",
      effort: null,
      contract: "Hauptvertrag",
      questions: []
    },
    {
      id: "benutzerverwaltung",
      parentId: "basisprojekt",
      type: "package",
      title: "Benutzerverwaltung",
      description: "Berechtigte Personen können sich anmelden. Administrierende verwalten Zugänge und weisen Rollen zu.",
      criteria: [],
      exclusions: "",
      notes: "Die Benutzerverwaltung ist eine beispielhafte Kundenanforderung, keine Funktion dieses Editors.",
      effort: 2,
      contract: "",
      questions: []
    },
    {
      id: "anmeldung",
      parentId: "benutzerverwaltung",
      type: "requirement",
      title: "Anmeldung",
      description: "Eingeladene Personen melden sich mit E-Mail-Adresse und Passwort am Kundenportal an. Ein vergessenes Passwort kann über einen zeitlich begrenzten Link zurückgesetzt werden.",
      criteria: [
        "Gültige Zugangsdaten ermöglichen die Anmeldung.",
        "Ungültige Zugangsdaten führen zu einer verständlichen Fehlermeldung.",
        "Ein Passwort kann über die hinterlegte E-Mail-Adresse zurückgesetzt werden."
      ],
      exclusions: "Anmeldung über soziale Netzwerke ist nicht enthalten.",
      notes: "",
      effort: 2,
      contract: "",
      questions: []
    },
    {
      id: "rollen-rechte",
      parentId: "benutzerverwaltung",
      type: "requirement",
      title: "Rollen & Rechte",
      description: "Das System ermöglicht die Verwaltung von Benutzerrollen und zugehörigen Zugriffsrechten. Personen erhalten ausschließlich Zugriff auf die für ihre Rolle freigegebenen Bereiche.",
      criteria: [
        "Administrierende können Personen eine Rolle zuweisen.",
        "Nicht freigegebene Inhalte sind weder über die Oberfläche noch über direkte Links zugänglich."
      ],
      exclusions: "Ein frei konfigurierbarer Berechtigungseditor ist nicht enthalten.",
      notes: "Klären, ob eine mandantenfähige Rollenstruktur erforderlich ist. Aufwand nach Klärung der Rollen erneut prüfen.",
      effort: 2,
      contract: "",
      questions: [
        {
          id: "q-standardrollen",
          text: "Welche Standardrollen werden zum Projektstart benötigt?",
          answer: "",
          status: "open",
          visibility: "customer"
        },
        {
          id: "q-verzeichnis",
          text: "Ist eine Anbindung an das bestehende Active Directory vorgesehen?",
          answer: "",
          status: "open",
          visibility: "customer"
        }
      ]
    },
    {
      id: "dokumentenablage",
      parentId: "basisprojekt",
      type: "package",
      title: "Dokumentenablage",
      description: "Dokumente werden zentral abgelegt und berechtigten Personen zum Download bereitgestellt.",
      criteria: [],
      exclusions: "",
      notes: "",
      effort: 2,
      contract: "",
      questions: []
    },
    {
      id: "dateien-hochladen",
      parentId: "dokumentenablage",
      type: "requirement",
      title: "Dateien hochladen",
      description: "Berechtigte Personen können PDF-Dokumente hochladen, benennen und wieder herunterladen. Der Upload zeigt Fortschritt und Fehler verständlich an.",
      criteria: [
        "PDF-Dateien bis 20 MB können hochgeladen werden.",
        "Nicht unterstützte Dateitypen werden mit einer Meldung abgewiesen.",
        "Hochgeladene Dateien sind für berechtigte Personen abrufbar."
      ],
      exclusions: "Automatische Texterkennung und Dokumentbearbeitung sind nicht enthalten.",
      notes: "",
      effort: 2,
      contract: "",
      questions: []
    },
    {
      id: "zusatzmodule",
      parentId: "kundenportal",
      type: "group",
      title: "Zusatzmodule",
      description: "Separat beauftragbare Erweiterungen nach Bereitstellung des Basisprojekts.",
      criteria: [],
      exclusions: "",
      notes: "Diese Gruppe hat einen eigenen Vertragsumfang und kann separat exportiert werden.",
      effort: null,
      contract: "Erweiterungen",
      questions: []
    },
    {
      id: "crm-anbindung",
      parentId: "zusatzmodule",
      type: "package",
      title: "CRM-Anbindung",
      description: "Kundenstammdaten werden über eine bereitgestellte Schnittstelle aus dem bestehenden CRM übernommen.",
      criteria: [
        "Neue und geänderte Kundenstammdaten können importiert werden.",
        "Fehlerhafte Datensätze werden nachvollziehbar protokolliert."
      ],
      exclusions: "Bereinigung historischer Stammdaten und Lizenzkosten des CRM sind nicht enthalten.",
      notes: "",
      effort: 3,
      contract: "",
      questions: []
    },
    {
      id: "benachrichtigungen",
      parentId: "zusatzmodule",
      type: "package",
      title: "Benachrichtigungen",
      description: "Berechtigte Personen erhalten eine E-Mail, wenn neue Dokumente für sie bereitgestellt wurden.",
      criteria: [
        "Ein neues Dokument löst eine Nachricht an die zugeordneten Personen aus.",
        "Die Nachricht enthält einen Link zum Dokument im geschützten Portal."
      ],
      exclusions: "SMS und Push-Nachrichten sind nicht enthalten.",
      notes: "",
      effort: 1,
      contract: "",
      questions: []
    }
  ],
  links: [
    {
      id: "link-basis",
      source: "zusatzmodule",
      target: "basisprojekt",
      type: "requires"
    },
    {
      id: "link-crm",
      source: "crm-anbindung",
      target: "benutzerverwaltung",
      type: "requires"
    },
    {
      id: "link-dokumente",
      source: "benachrichtigungen",
      target: "dokumentenablage",
      type: "requires"
    }
  ]
};
export function validate(data) {
  const fail = message => { throw new Error(message); };
  if (!data || data.schemaVersion !== 1) fail('schemaVersion muss 1 sein.');
  if (!data.document || typeof data.document.title !== 'string' || !data.document.title.trim()) fail('Dokumenttitel fehlt.');
  for (const key of ['customer', 'version', 'date']) {
    if (data.document[key] !== undefined && typeof data.document[key] !== 'string') fail(`document.${key} muss Text sein.`);
  }
  if (!Array.isArray(data.nodes) || !data.nodes.length || data.nodes.length > 2000) fail('Es müssen 1 bis 2000 Elemente vorhanden sein.');
  if (!Array.isArray(data.links)) fail('links muss eine Liste sein.');
  const ids = new Set();
  for (const n of data.nodes) {
    if (!n || typeof n.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(n.id) || ids.has(n.id)) fail('Element-IDs müssen eindeutig sein (Buchstaben, Zahlen, _ oder -).');
    ids.add(n.id);
    if (!Object.hasOwn(types, n.type) || typeof n.title !== 'string' || !n.title.trim()) fail(`Ungültiger Typ oder Titel bei ${n.id}.`);
    if (n.parentId !== null && typeof n.parentId !== 'string') fail(`Ungültige parentId bei ${n.id}.`);
    for (const key of ['description', 'notes', 'exclusions', 'contract']) if (typeof n[key] !== 'string') fail(`${n.id}.${key} muss Text sein.`);
    if (!Array.isArray(n.criteria) || n.criteria.some(c => typeof c !== 'string')) fail(`Ungültige Abnahmekriterien bei ${n.id}.`);
    if (n.effort !== null && ![1, 2, 3, 4].includes(n.effort)) fail(`Ungültiger Aufwand bei ${n.id}.`);
    if (!Array.isArray(n.questions)) fail(`Fragen fehlen bei ${n.id}.`);
    const questionIds = new Set();
    for (const q of n.questions) {
      if (!q || typeof q.id !== 'string' || questionIds.has(q.id) || typeof q.text !== 'string' || !q.text.trim() || typeof q.answer !== 'string' || !['open', 'resolved'].includes(q.status) || (q.visibility !== undefined && !['customer', 'internal'].includes(q.visibility))) fail(`Ungültige Frage bei ${n.id}.`);
      questionIds.add(q.id);
    }
  }
  const roots = data.nodes.filter(n => n.parentId === null);
  if (roots.length !== 1 || roots[0].type !== 'document' || data.nodes.some(n => n !== roots[0] && n.type === 'document')) fail('Genau ein Lastenheft-Wurzelelement ist erforderlich.');
  for (const n of data.nodes) {
    const seen = new Set([n.id]);
    let current = n;
    while (current.parentId !== null) {
      const parent = data.nodes.find(p => p.id === current.parentId);
      if (!parent) fail(`Übergeordnetes Element von ${current.id} fehlt.`);
      if (seen.has(parent.id)) fail('Der Baum enthält einen Kreis.');
      if (parent.type === 'requirement') fail('Anforderungen können keine Unterelemente enthalten.');
      seen.add(parent.id); current = parent;
    }
  }
  const linkIds = new Set();
  for (const l of data.links) {
    if (!l || typeof l.id !== 'string' || linkIds.has(l.id) || !ids.has(l.source) || !ids.has(l.target) || l.source === l.target || !['requires', 'reference'].includes(l.type)) fail('Ungültige Verknüpfung.');
    linkIds.add(l.id);
  }
  return data;
}
export function children(data, id) { return data.nodes.filter(n => n.parentId === id); }
export function descendants(data, id) {
  const found = new Set([id]);
  const visit = key => children(data, key).forEach(n => { if (!found.has(n.id)) { found.add(n.id); visit(n.id); } });
  visit(id); return found;
}
export function effectiveContract(data, id) {
  let node = data.nodes.find(n => n.id === id);
  while (node) { if (node.contract.trim()) return node.contract.trim(); node = data.nodes.find(n => n.id === node.parentId); }
  return 'Hauptvertrag';
}
export function moveNode(data, id, targetId, placement = 'inside') {
  const node = data.nodes.find(n => n.id === id), target = data.nodes.find(n => n.id === targetId);
  const parent = placement === 'inside' ? target : data.nodes.find(n => n.id === target?.parentId);
  if (!['inside', 'before', 'after'].includes(placement) || !node || !target || !parent || id === targetId || node.parentId === null || parent.type === 'requirement' || descendants(data, id).has(parent.id)) throw new Error('Dieses Element kann hier nicht eingeordnet werden.');
  node.parentId = parent.id;
  data.nodes = data.nodes.filter(n => n.id !== id);
  if (placement === 'inside') data.nodes.push(node);
  else data.nodes.splice(data.nodes.findIndex(n => n.id === targetId) + (placement === 'after' ? 1 : 0), 0, node);
}
export function removeNode(data, id) {
  if (data.nodes.find(n => n.id === id)?.parentId === null) throw new Error('Das Lastenheft kann nicht gelöscht werden.');
  const ids = descendants(data, id);
  data.nodes = data.nodes.filter(n => !ids.has(n.id));
  data.links = data.links.filter(l => !ids.has(l.source) && !ids.has(l.target));
}
export function exportSelection(data, contract = '*') {
  const root = data.nodes.find(n => n.parentId === null);
  const included = new Set(data.nodes.filter(n => n.id !== root.id && (contract === '*' || effectiveContract(data, n.id) === contract)).map(n => n.id));
  const warnings = data.links.filter(l => l.type === 'requires' && included.has(l.source) && !included.has(l.target) && l.target !== root.id);
  return { root, included, warnings };
}
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export function documentHtml(data, contract = '*', includeQuestions = true) {
  const e = escapeHtml, { root, included, warnings } = exportSelection(data, contract);
  const byId = id => data.nodes.find(n => n.id === id);
  const counters = new Map();
  const sections = [], toc = [];
  function walk(id, prefix = '') {
    for (const n of children(data, id)) {
      if (included.has(n.id)) {
        const count = (counters.get(prefix) || 0) + 1;
        counters.set(prefix, count);
        const number = prefix ? `${prefix}.${count}` : String(count);
        toc.push(`<li class="level-${Math.min(number.split('.').length, 3)}"><a href="#doc-${e(n.id)}">${number} ${e(n.title)}</a></li>`);
        const refs = data.links.filter(l => l.source === n.id).map(l => `${l.type === 'requires' ? 'Benötigt' : 'Siehe auch'}: ${byId(l.target).title}${included.has(l.target) ? '' : ' (außerhalb dieses Umfangs)'}`);
        sections.push(`<section class="doc-section" id="doc-${e(n.id)}"><div class="doc-eyebrow">${e(types[n.type])} · ${e(effectiveContract(data, n.id))}</div><h2>${number} ${e(n.title)}</h2>${n.description ? `<p class="preserve">${e(n.description)}</p>` : '<p class="muted">Beschreibung noch offen.</p>'}${n.criteria.length ? `<h3>Abnahmekriterien</h3><ul>${n.criteria.map(c => `<li>${e(c)}</li>`).join('')}</ul>` : ''}${n.exclusions ? `<h3>Nicht im Leistungsumfang</h3><p class="preserve">${e(n.exclusions)}</p>` : ''}${refs.length ? `<h3>Voraussetzungen und Referenzen</h3><ul>${refs.map(r => `<li>${e(r)}</li>`).join('')}</ul>` : ''}</section>`);
        walk(n.id, number);
      } else walk(n.id, prefix);
    }
  }
  walk(root.id);
  const questions = data.nodes.filter(n => included.has(n.id) || (contract === '*' && n.id === root.id)).flatMap(n => n.questions.filter(q => q.visibility !== 'internal' && q.status === 'open').map(q => `<li><strong>${e(n.title)}</strong><p>${e(q.text)}</p>${q.answer ? `<p>Zwischenstand: ${e(q.answer)}</p>` : ''}</li>`));
  return `<article class="document"><header class="doc-cover"><div class="doc-eyebrow">LEISTUNGSBESCHREIBUNG</div><h1>${e(data.document.title)}</h1><p class="doc-subtitle">Lastenheft${contract === '*' ? '' : ` · ${e(contract)}`}</p>${root.description ? `<p class="preserve">${e(root.description)}</p>` : ''}${root.criteria.length ? `<h3>Übergreifende Abnahmekriterien</h3><ul>${root.criteria.map(c => `<li>${e(c)}</li>`).join('')}</ul>` : ''}${root.exclusions ? `<h3>Übergreifende Abgrenzung</h3><p class="preserve">${e(root.exclusions)}</p>` : ''}</header>${warnings.length ? `<aside class="doc-warning"><h3>Voraussetzungen außerhalb dieses Vertragsumfangs</h3><ul>${warnings.map(l => `<li>${e(byId(l.source).title)} benötigt ${e(byId(l.target).title)} (${e(effectiveContract(data, l.target))}).</li>`).join('')}</ul></aside>` : ''}<nav class="doc-toc"><h2>Inhalt</h2><ol>${toc.join('')}</ol></nav>${sections.join('')}${includeQuestions && questions.length ? `<section class="doc-section"><h2>Noch zu klären</h2><ol>${questions.join('')}</ol></section>` : ''}<footer class="doc-footer">${e(data.document.title)}</footer></article>`;
}
