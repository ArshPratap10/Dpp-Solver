import { getQuestionCustomization, getQuestionSection } from './storage';

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

function toRoman(num) {
  const romanMap = [
    [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'],
    [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']
  ];
  let result = '';
  let n = num;
  for (const [val, sym] of romanMap) {
    while (n >= val) {
      result += sym;
      n -= val;
    }
  }
  return result || String(num);
}

function toAlpha(num) {
  return String.fromCharCode(96 + ((num - 1) % 26 + 1));
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

  // Extract sub-questions (e.g. ol.subq or ol inside .qb)
  const subQuestions = [];
  let introHtml = '';
  const subqOl = qbEl ? (qbEl.querySelector('ol.subq') || qbEl.querySelector('ol')) : null;

  if (subqOl) {
    const lis = Array.from(subqOl.querySelectorAll(':scope > li'));
    if (lis.length > 0) {
      const olType = subqOl.getAttribute('type') || '';
      const style = subqOl.getAttribute('style') || '';
      const isRoman = olType.toLowerCase() === 'i' || style.includes('lower-roman') || style.includes('upper-roman');
      const isUpper = olType === 'I' || olType === 'A' || style.includes('upper-roman') || style.includes('upper-alpha');
      const isAlpha = olType.toLowerCase() === 'a' || style.includes('lower-alpha') || style.includes('upper-alpha');
      const startNum = parseInt(subqOl.getAttribute('start') || '1', 10);

      lis.forEach((li, idx) => {
        const num = startNum + idx;
        let label = `${num}.`;
        if (isRoman) {
          const r = toRoman(num);
          label = `${isUpper ? r.toUpperCase() : r}.`;
        } else if (isAlpha) {
          const a = toAlpha(num);
          label = `${isUpper ? a.toUpperCase() : a}.`;
        }

        subQuestions.push({
          id: '',
          index: idx,
          label,
          html: li.innerHTML.trim(),
        });
      });

      // Extract intro/stem text before/excluding the <ol> and .opts
      const clone = qbEl.cloneNode(true);
      const clonedOl = clone.querySelector('ol.subq') || clone.querySelector('ol');
      if (clonedOl) clonedOl.remove();
      const optsClone = clone.querySelector('.opts');
      if (optsClone) optsClone.remove();
      introHtml = clone.innerHTML.trim();
    }
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
  subQuestions.forEach(sq => {
    sq.id = `${id}-sub-${sq.index}`;
  });

  // Check for any user customizations saved in localStorage
  let tags = Array.from(detectedTags);
  const custom = getQuestionCustomization(id);
  if (custom) {
    if (custom.header) headerText = custom.header;
    if (Array.isArray(custom.tags)) tags = custom.tags;
  }

  const customSection = getQuestionSection(id);

  return {
    id,
    chapterId,
    chapterTitle,
    sectionTitle: customSection || sectionTitle,
    originalSectionTitle: sectionTitle,
    header: headerText,
    originalHeader: qhEl ? qhEl.textContent.trim() : '',
    tags,
    originalTags: Array.from(detectedTags),
    questionHtml,
    subQuestions,
    introHtml,
    options,
    selectedOption: null,
    timerDuration: 180,
    timerRemaining: 180,
    timerState: 'idle',
  };
}
