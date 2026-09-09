const item = (id, parentId, type, extra = {}) => ({ id, parentId, type, title: id, description: '', criteria: [], exclusions: '', notes: '', effort: null, contract: '', questions: [], ...extra });
export const fixture = {
  schemaVersion: 1,
  document: { title: 'Kundenportal', customer: 'Testkunde', version: '0.1', date: '2026-09-09' },
  nodes: [
    item('kundenportal', null, 'document', { title: 'Kundenportal' }),
    item('basisprojekt', 'kundenportal', 'group', { contract: 'Hauptvertrag' }),
    item('benutzerverwaltung', 'basisprojekt', 'package'),
    item('anmeldung', 'benutzerverwaltung', 'requirement'),
    item('rollen-rechte', 'benutzerverwaltung', 'requirement', { questions: [{ id: 'q-rollen', text: 'Welche Standardrollen?', answer: '', status: 'open', visibility: 'customer' }] }),
    item('dokumentenablage', 'basisprojekt', 'package'),
    item('dateien-hochladen', 'dokumentenablage', 'requirement'),
    item('zusatzmodule', 'kundenportal', 'group', { contract: 'Erweiterungen' }),
    item('crm-anbindung', 'zusatzmodule', 'package', { title: 'CRM-Anbindung' }),
    item('benachrichtigungen', 'zusatzmodule', 'package')
  ],
  links: [
    { id: 'basis', source: 'zusatzmodule', target: 'basisprojekt', type: 'requires' },
    { id: 'crm', source: 'crm-anbindung', target: 'benutzerverwaltung', type: 'requires' },
    { id: 'dokumente', source: 'benachrichtigungen', target: 'dokumentenablage', type: 'requires' }
  ]
};
