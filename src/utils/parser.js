import { getQuestionCustomization } from './storage';

let _qCounter = 0;

/**
 * Parses DPP HTML and generates global deterministic IDs and extracted tags.
 * @param {string} htmlString - raw HTML of DPP
 * @param {string} chapterId - unique slug for the chapter
 * @param {string} defaultTitle - optional fallback chapter title
 */
export function parseDPPHtml(htmlString, chapterId = 'dpp', defaultTitle = '') {
  _qCounter = 0;
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  // Extract title — support both .dpp-title and plain h1
  const titleEl = doc.querySelector('.dpp-title') || doc.querySelector('h1');
  const title = titleEl ? titleEl.textContent.trim() : (defaultTitle || 'Untitled DPP');

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
    const qs = extractQuestions(doc.querySelectorAll('.q'), chapterId, title, 'Questions');
    if (qs.length > 0) sections.push({ title: 'Questions', questions: qs });
  } else {
    sectionHeaders.forEach(h2 => {
      const sectionTitle = h2.textContent.trim();
      const questions = [];
      let sibling = h2.nextElementSibling;
      while (sibling && sibling.tagName !== 'H2') {
        if (sibling.classList.contains('q')) {
          questions.push(parseSingleQuestion(sibling, chapterId, title, sectionTitle));
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

  return { title, meta, sections, totalQuestions, chapterId };
}

function extractQuestions(qElements, chapterId, chapterTitle, sectionTitle = 'Questions') {
  return Array.from(qElements).map(el => parseSingleQuestion(el, chapterId, chapterTitle, sectionTitle));
}

function cleanTagText(text) {
  let cleaned = text.replace(/★/g, '').replace(/[\u2605\u2606]/g, '').trim();
  if (/mind\s*bender/i.test(cleaned)) return 'Mindbender';
  if (/^tah$/i.test(cleaned) || /\btah\b/i.test(cleaned)) return 'TAH';
  if (/^kcls$/i.test(cleaned) || /\bkcls\b/i.test(cleaned)) return 'KCLS';
  if (/^asrq$/i.test(cleaned) || /\basrq\b/i.test(cleaned)) return 'ASRQ';
  return cleaned;
}

function parseSingleQuestion(qEl, chapterId, chapterTitle, sectionTitle = 'Questions') {
  const qhEl = qEl.querySelector('.qh');
  let headerText = qhEl ? qhEl.textContent.trim() : '';

  const qbEl = qEl.querySelector('.qb');

  // Tag extraction from HTML
  const detectedTags = new Set();

  // Check .qh for keywords like TAH, KCLS, Mindbender
  if (/\bTAH\b/i.test(headerText)) detectedTags.add('TAH');
  if (/\bKCLS\b/i.test(headerText)) detectedTags.add('KCLS');
  if (/mind\s*bender/i.test(headerText)) detectedTags.add('Mindbender');
  if (/\bASRQ\b/i.test(headerText)) detectedTags.add('ASRQ');
  if (/JEE\s*Mains?/i.test(headerText)) detectedTags.add('JEE Mains');
  if (/JEE\s*Adv/i.test(headerText)) detectedTags.add('JEE Advanced');

  // Extract from .tag inside .qb
  if (qbEl) {
    const tagEls = qbEl.querySelectorAll('.tag');
    tagEls.forEach(tEl => {
      const cleaned = cleanTagText(tEl.textContent);
      if (cleaned) detectedTags.add(cleaned);
    });
  }

  // Extract options (only extract top-level single .opts for standard MCQ)
  const options = [];
  const allOpts = qbEl ? qbEl.querySelectorAll('.opts') : [];
  const isStandardMCQ = allOpts.length === 1 && !qbEl.querySelector('ol.subq .opts');

  if (isStandardMCQ) {
    const lis = allOpts[0].querySelectorAll('li');
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
    if (isStandardMCQ) {
      const optsClone = clone.querySelector('.opts');
      if (optsClone) optsClone.remove();
    }
    questionHtml = clone.innerHTML.trim();
  }

  // Deterministic global ID: e.g. circle-combined-q-0
  const id = `${chapterId}-q-${_qCounter++}`;

  // Check for any user customizations saved in localStorage
  let tags = Array.from(detectedTags);
  const custom = getQuestionCustomization(id);
  if (custom) {
    if (custom.header) headerText = custom.header;
    if (Array.isArray(custom.tags)) tags = custom.tags;
  }

  return {
    id,
    chapterId,
    chapterTitle,
    sectionTitle,
    header: headerText,
    originalHeader: qhEl ? qhEl.textContent.trim() : '',
    tags,
    originalTags: Array.from(detectedTags),
    questionHtml,
    options,
    selectedOption: null,
    timerDuration: 180,
    timerRemaining: 180,
    timerState: 'idle',
  };
}
