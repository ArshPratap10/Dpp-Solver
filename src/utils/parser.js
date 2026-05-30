/**
 * Parses DPP HTML and extracts structured question data.
 * Matches the specific format: .q > .qh + .qb > .opts
 */
export function parseDPPHtml(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  // Extract title
  const titleEl = doc.querySelector('.dpp-title');
  const title = titleEl ? titleEl.textContent.trim() : 'Untitled DPP';

  // Extract metadata
  const metaEls = doc.querySelectorAll('.dpp-meta span');
  const meta = {};
  metaEls.forEach(el => {
    const strong = el.querySelector('strong');
    if (strong) {
      const key = strong.textContent.replace(':', '').trim().toLowerCase();
      const value = el.textContent.replace(strong.textContent, '').trim();
      meta[key] = value;
    }
  });

  // Extract sections
  const sections = [];
  const sectionHeaders = doc.querySelectorAll('h2');

  if (sectionHeaders.length === 0) {
    const qs = extractQuestions(doc.querySelectorAll('.q'));
    if (qs.length > 0) sections.push({ title: 'Questions', questions: qs });
  } else {
    sectionHeaders.forEach(h2 => {
      const sectionTitle = h2.textContent.trim();
      const questions = [];
      let sibling = h2.nextElementSibling;
      while (sibling && sibling.tagName !== 'H2') {
        if (sibling.classList.contains('q')) {
          questions.push(parseSingleQuestion(sibling));
        }
        sibling = sibling.nextElementSibling;
      }
      if (questions.length > 0) {
        sections.push({ title: sectionTitle, questions });
      }
    });
  }

  // Count total questions
  const totalQuestions = sections.reduce((s, sec) => s + sec.questions.length, 0);

  return { title, meta, sections, totalQuestions };
}

function extractQuestions(qElements) {
  return Array.from(qElements).map(el => parseSingleQuestion(el));
}

function parseSingleQuestion(qEl) {
  const qhEl = qEl.querySelector('.qh');
  const headerText = qhEl ? qhEl.textContent.trim() : '';

  const qbEl = qEl.querySelector('.qb');

  // Extract options
  const options = [];
  const optsEl = qbEl ? qbEl.querySelector('.opts') : null;
  if (optsEl) {
    const lis = optsEl.querySelectorAll('li');
    lis.forEach((li, i) => {
      options.push({
        label: String.fromCharCode(65 + i),
        html: li.innerHTML.trim(),
      });
    });
  }

  // Question HTML without options
  let questionHtml = '';
  if (qbEl) {
    const clone = qbEl.cloneNode(true);
    const optsClone = clone.querySelector('.opts');
    if (optsClone) optsClone.remove();
    questionHtml = clone.innerHTML.trim();
  }

  return {
    id: crypto.randomUUID(),
    header: headerText,
    questionHtml,
    options,
    selectedOption: null,
    timerDuration: 180,
    timerRemaining: 180,
    timerState: 'idle', // idle | running | paused | expired
  };
}
