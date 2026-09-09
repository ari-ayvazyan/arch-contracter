// Measure and paginate with the same fixed-size DOM used for printing.
export function paginateDocument(html, destination) {
  const template = document.createElement('template'); template.innerHTML = html;
  const source = template.content.querySelector('.document');
  if (!source) throw new Error('Ungültiges Dokument-HTML.');
  const footerText = source.querySelector('.doc-footer')?.textContent || '';
  const stage = document.createElement('div'); stage.className = 'pdf-stage';
  document.body.append(stage);
  const pages = [];
  let body;
  function newPage() {
    const page = document.createElement('section'); page.className = 'pdf-page';
    body = document.createElement('div'); body.className = 'document pdf-page-body';
    const footer = document.createElement('footer'); footer.className = 'pdf-page-footer';
    const title = document.createElement('span'); title.textContent = footerText;
    const count = document.createElement('span'); count.className = 'pdf-page-number';
    footer.append(title, count); page.append(body, footer); stage.append(page); pages.push(page);
  }
  function fits() {
    const last = body.lastElementChild;
    return !last || last.getBoundingClientRect().bottom <= body.getBoundingClientRect().bottom + .25;
  }
  function slice(element, start, end) {
    const texts = [], walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) texts.push(walker.currentNode);
    const range = document.createRange();
    const point = offset => {
      for (const text of texts) { if (offset <= text.length) return [text, offset]; offset -= text.length; }
      return [element, element.childNodes.length];
    };
    range.setStart(...point(start)); range.setEnd(...point(end));
    const result = element.cloneNode(false); result.append(range.cloneContents());
    if (start) { result.removeAttribute('id'); result.querySelectorAll('[id]').forEach(el => el.removeAttribute('id')); result.classList.remove('flow-start'); }
    return result;
  }
  function place(block) {
    body.append(block);
    if (fits()) return;
    block.remove();
    if (body.childElementCount) { newPage(); body.append(block); if (fits()) return; block.remove(); }
    // Only oversized blocks are split. Normal paragraphs, list items and
    // heading/first-content groups remain together.
    const text = block.textContent;
    let low = 1, high = text.length - 1, best = 0;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2), fragment = slice(block, 0, middle);
      body.append(fragment); const ok = fits(); fragment.remove();
      if (ok) { best = middle; low = middle + 1; } else high = middle - 1;
    }
    if (!best) throw new Error('Ein Dokumentblock passt nicht auf eine A4-Seite. Bitte den betreffenden Titel oder Inhalt kürzen.');
    if (text.length - best < 160 && best > 320) best = text.length - 160;
    let cut = best;
    while (cut > best / 2 && !/\s/.test(text[cut - 1])) cut--;
    if (cut <= best / 2) cut = best;
    const prefix = slice(block, 0, cut), suffix = slice(block, cut, text.length);
    body.append(prefix); newPage(); place(suffix);
  }
  try {
    newPage();
    let previousKind = '';
    for (const section of source.children) {
      if (section.classList.contains('doc-footer')) continue;
      const kind = section.className;
      if (body.childElementCount && (kind === 'doc-toc' || previousKind === 'doc-cover' || previousKind === 'doc-toc')) newPage();
      let pending = [], first = true;
      function emit(content) {
        const block = document.createElement('div'); block.className = `${kind} pdf-flow${first ? ' flow-start' : ''}`;
        if (first && section.id) block.id = section.id;
        block.append(...pending, content); pending = []; first = false; place(block);
      }
      for (const child of section.children) {
        if (/^H[1-6]$/.test(child.tagName) || child.classList.contains('doc-eyebrow')) { pending.push(child.cloneNode(true)); continue; }
        if (child.matches('ul,ol')) {
          [...child.children].forEach((item, index) => {
            const list = child.cloneNode(false);
            if (child.tagName === 'OL') list.start = (Number(child.getAttribute('start')) || 1) + index;
            list.append(item.cloneNode(true)); emit(list);
          });
        } else emit(child.cloneNode(true));
      }
      if (pending.length) emit(document.createElement('span'));
      previousKind = kind;
    }
    pages.forEach((page, index) => {
      page.setAttribute('aria-label', `Seite ${index + 1} von ${pages.length}`);
      page.querySelector('.pdf-page-number').textContent = `${index + 1} / ${pages.length}`;
    });
    destination.replaceChildren(...pages);
    return pages.length;
  } finally { stage.remove(); }
}
