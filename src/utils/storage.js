// ══════════════════════════════════════════════════
// Storage Engine for DPP Solver
// Manages: Trash, Custom Folders, Question Overrides,
// Question Statuses (Solved/Revise/Doubt), Theme, and Backup/Sync
// ══════════════════════════════════════════════════

export const STORAGE_KEYS = {
  TRASH: 'dpp_trash_v1',
  FOLDERS: 'dpp_folders_v1',
  FOLDER_ITEMS: 'dpp_folder_items_v1',
  CUSTOMIZATIONS: 'dpp_question_customizations_v1',
  TAGS: 'dpp_custom_tags_v1',
  STATUS: 'dpp_question_status_v1',
  THEME: 'dpp_theme_v1',
};

function safeGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error(`Failed to read ${key} from localStorage:`, err);
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Failed to write ${key} to localStorage:`, err);
  }
}

// ──────────────────────────────────────────────────
// THEME MANAGEMENT (Light / Dark)
// ──────────────────────────────────────────────────

export function getTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    if (saved === 'dark' || saved === 'light') return saved;
    // System preference fallback
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch (err) {
    console.error('Error checking theme preference:', err);
  }
  return 'light';
}

export function setTheme(theme) {
  const selectedTheme = theme === 'dark' ? 'dark' : 'light';
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, selectedTheme);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', selectedTheme);
    }
    window.dispatchEvent(new CustomEvent('dpp_theme_updated', { detail: selectedTheme }));
  } catch (err) {
    console.error('Failed to set theme:', err);
  }
  return selectedTheme;
}

export function toggleTheme() {
  const current = getTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  return setTheme(next);
}

// ──────────────────────────────────────────────────
// QUESTION STATUS WORKFLOW (SOLVED, REVISE, DOUBT)
// Structure: { [questionId]: 'SOLVED' | 'REVISE' | 'DOUBT' }
// ──────────────────────────────────────────────────

export const QUESTION_STATUS = {
  SOLVED: 'SOLVED',
  REVISE: 'REVISE',
  DOUBT: 'DOUBT',
};

export function getQuestionStatuses() {
  return safeGet(STORAGE_KEYS.STATUS, {});
}

export function getQuestionStatus(questionId) {
  const statuses = getQuestionStatuses();
  return statuses[questionId] || null;
}

export function setQuestionStatus(questionId, status) {
  const statuses = getQuestionStatuses();
  if (!status) {
    delete statuses[questionId];
  } else {
    statuses[questionId] = status;
  }
  safeSet(STORAGE_KEYS.STATUS, statuses);
  window.dispatchEvent(new Event('dpp_storage_updated'));
}

export function cycleQuestionStatus(questionId) {
  const current = getQuestionStatus(questionId);
  let next = null;
  if (!current) next = QUESTION_STATUS.SOLVED;
  else if (current === QUESTION_STATUS.SOLVED) next = QUESTION_STATUS.REVISE;
  else if (current === QUESTION_STATUS.REVISE) next = QUESTION_STATUS.DOUBT;
  else next = null; // resets to unmarked
  setQuestionStatus(questionId, next);
  return next;
}

// ──────────────────────────────────────────────────
// TRASH MANAGEMENT
// Structure: { [questionId]: { questionId, question, chapterId, chapterTitle, trashedAt } }
// ──────────────────────────────────────────────────

export function getTrashMap() {
  return safeGet(STORAGE_KEYS.TRASH, {});
}

export function getTrashList() {
  const map = getTrashMap();
  return Object.values(map).sort((a, b) => (b.trashedAt || 0) - (a.trashedAt || 0));
}

export function isQuestionTrashed(questionId) {
  const map = getTrashMap();
  return !!map[questionId];
}

export function moveToTrash(question, chapterId, chapterTitle) {
  const map = getTrashMap();
  map[question.id] = {
    questionId: question.id,
    question: { ...question },
    chapterId: chapterId || question.chapterId || 'unknown',
    chapterTitle: chapterTitle || question.chapterTitle || 'DPP',
    trashedAt: Date.now(),
  };
  safeSet(STORAGE_KEYS.TRASH, map);
  window.dispatchEvent(new Event('dpp_storage_updated'));
}

export function restoreFromTrash(questionId) {
  const map = getTrashMap();
  if (map[questionId]) {
    delete map[questionId];
    safeSet(STORAGE_KEYS.TRASH, map);
    window.dispatchEvent(new Event('dpp_storage_updated'));
    return true;
  }
  return false;
}

export function restoreAllTrash() {
  safeSet(STORAGE_KEYS.TRASH, {});
  window.dispatchEvent(new Event('dpp_storage_updated'));
}

export function deletePermanently(questionId) {
  const map = getTrashMap();
  if (map[questionId]) {
    delete map[questionId];
    safeSet(STORAGE_KEYS.TRASH, map);

    // Also remove from any folders
    removeQuestionFromAllFolders(questionId);

    window.dispatchEvent(new Event('dpp_storage_updated'));
    return true;
  }
  return false;
}

export function emptyTrash() {
  const map = getTrashMap();
  Object.keys(map).forEach(qId => {
    removeQuestionFromAllFolders(qId);
  });
  safeSet(STORAGE_KEYS.TRASH, {});
  window.dispatchEvent(new Event('dpp_storage_updated'));
}

// ──────────────────────────────────────────────────
// FOLDER MANAGEMENT
// Folders: Array<{ id, name, icon, color, description, createdAt }>
// Items: { [folderId]: Array<{ questionId, chapterId, chapterTitle, question, addedAt }> }
// ──────────────────────────────────────────────────

const DEFAULT_FOLDERS = [
  {
    id: 'folder-hard',
    name: 'Hard Questions',
    icon: '🔥',
    color: '#ef4444',
    description: 'Toughest problems requiring deeper conceptual thinking',
    createdAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'folder-revision',
    name: 'Revision & Mindbenders',
    icon: '⚡',
    color: '#8b5cf6',
    description: 'High priority problems for final revision',
    createdAt: Date.now() - 86400000,
  },
];

export function getFolders() {
  const folders = safeGet(STORAGE_KEYS.FOLDERS, null);
  if (!folders) {
    safeSet(STORAGE_KEYS.FOLDERS, DEFAULT_FOLDERS);
    return DEFAULT_FOLDERS;
  }
  return folders;
}

export function createFolder({ name, icon = '📁', color = '#4f46e5', description = '' }) {
  const folders = getFolders();
  const newFolder = {
    id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
    icon: icon || '📁',
    color: color || '#4f46e5',
    description: description.trim(),
    createdAt: Date.now(),
  };
  folders.push(newFolder);
  safeSet(STORAGE_KEYS.FOLDERS, folders);
  window.dispatchEvent(new Event('dpp_storage_updated'));
  return newFolder;
}

export function updateFolder(folderId, updates) {
  const folders = getFolders().map(f => (f.id === folderId ? { ...f, ...updates } : f));
  safeSet(STORAGE_KEYS.FOLDERS, folders);
  window.dispatchEvent(new Event('dpp_storage_updated'));
}

export function deleteFolder(folderId) {
  const folders = getFolders().filter(f => f.id !== folderId);
  safeSet(STORAGE_KEYS.FOLDERS, folders);

  const items = getFolderItemsMap();
  if (items[folderId]) {
    delete items[folderId];
    safeSet(STORAGE_KEYS.FOLDER_ITEMS, items);
  }
  window.dispatchEvent(new Event('dpp_storage_updated'));
}

export function getFolderItemsMap() {
  return safeGet(STORAGE_KEYS.FOLDER_ITEMS, {});
}

export function getFolderItems(folderId) {
  const items = getFolderItemsMap();
  return items[folderId] || [];
}

export function addQuestionToFolder(folderId, question, chapterId, chapterTitle) {
  const itemsMap = getFolderItemsMap();
  const folderList = itemsMap[folderId] || [];

  // Check if already in folder
  const existingIdx = folderList.findIndex(item => item.questionId === question.id);
  if (existingIdx === -1) {
    folderList.push({
      questionId: question.id,
      chapterId: chapterId || question.chapterId || 'unknown',
      chapterTitle: chapterTitle || question.chapterTitle || 'DPP',
      question: { ...question },
      addedAt: Date.now(),
    });
    itemsMap[folderId] = folderList;
    safeSet(STORAGE_KEYS.FOLDER_ITEMS, itemsMap);
    window.dispatchEvent(new Event('dpp_storage_updated'));
  }
}

export function removeQuestionFromFolder(folderId, questionId) {
  const itemsMap = getFolderItemsMap();
  if (itemsMap[folderId]) {
    itemsMap[folderId] = itemsMap[folderId].filter(item => item.questionId !== questionId);
    safeSet(STORAGE_KEYS.FOLDER_ITEMS, itemsMap);
    window.dispatchEvent(new Event('dpp_storage_updated'));
  }
}

export function removeQuestionFromAllFolders(questionId) {
  const itemsMap = getFolderItemsMap();
  let changed = false;
  Object.keys(itemsMap).forEach(fId => {
    const before = itemsMap[fId].length;
    itemsMap[fId] = itemsMap[fId].filter(item => item.questionId !== questionId);
    if (itemsMap[fId].length !== before) changed = true;
  });
  if (changed) {
    safeSet(STORAGE_KEYS.FOLDER_ITEMS, itemsMap);
  }
}

export function getFoldersForQuestion(questionId) {
  const itemsMap = getFolderItemsMap();
  const folderIds = [];
  Object.entries(itemsMap).forEach(([fId, items]) => {
    if (items.some(it => it.questionId === questionId)) {
      folderIds.push(fId);
    }
  });
  return folderIds;
}

// ──────────────────────────────────────────────────
// QUESTION CUSTOMIZATIONS (HEADINGS & TAGS)
// Structure: { [questionId]: { header, tags, customNote, updatedAt } }
// ──────────────────────────────────────────────────

export function getQuestionCustomizations() {
  return safeGet(STORAGE_KEYS.CUSTOMIZATIONS, {});
}

export function getQuestionCustomization(questionId) {
  const map = getQuestionCustomizations();
  return map[questionId] || null;
}

export function saveQuestionCustomization(questionId, { header, tags, customNote }) {
  const map = getQuestionCustomizations();
  map[questionId] = {
    header: header !== undefined ? header : (map[questionId]?.header || ''),
    tags: tags !== undefined ? tags : (map[questionId]?.tags || []),
    customNote: customNote !== undefined ? customNote : (map[questionId]?.customNote || ''),
    updatedAt: Date.now(),
  };
  safeSet(STORAGE_KEYS.CUSTOMIZATIONS, map);

  // Also update question instance in folders if it exists
  const folderItems = getFolderItemsMap();
  let itemsChanged = false;
  Object.keys(folderItems).forEach(fId => {
    folderItems[fId] = folderItems[fId].map(it => {
      if (it.questionId === questionId) {
        itemsChanged = true;
        return {
          ...it,
          question: {
            ...it.question,
            header: header !== undefined ? header : it.question.header,
            tags: tags !== undefined ? tags : it.question.tags,
          },
        };
      }
      return it;
    });
  });
  if (itemsChanged) {
    safeSet(STORAGE_KEYS.FOLDER_ITEMS, folderItems);
  }

  window.dispatchEvent(new Event('dpp_storage_updated'));
}

export function resetQuestionCustomization(questionId) {
  const map = getQuestionCustomizations();
  if (map[questionId]) {
    delete map[questionId];
    safeSet(STORAGE_KEYS.CUSTOMIZATIONS, map);
    window.dispatchEvent(new Event('dpp_storage_updated'));
  }
}

// ──────────────────────────────────────────────────
// 1-CLICK BACKUP & DATA SYNC (EXPORT / IMPORT JSON)
// ──────────────────────────────────────────────────

export function exportAllData() {
  const backup = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    timestamp: Date.now(),
    data: {
      folders: getFolders(),
      folderItems: getFolderItemsMap(),
      trash: getTrashMap(),
      customizations: getQuestionCustomizations(),
      statuses: getQuestionStatuses(),
      theme: getTheme(),
    },
  };

  // Collect any saved stars and selections
  const userStars = {};
  const userSelections = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('dpp-starred-')) {
        userStars[key] = safeGet(key, {});
      } else if (key?.startsWith('dpp-selections-')) {
        userSelections[key] = safeGet(key, {});
      }
    }
    backup.data.stars = userStars;
    backup.data.selections = userSelections;
  } catch (err) {
    console.error('Error collecting stars and selections:', err);
  }

  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `dpp_solver_backup_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return backup;
}

export function validateBackup(jsonObj) {
  if (!jsonObj || typeof jsonObj !== 'object') {
    throw new Error('Invalid JSON file.');
  }
  if (!jsonObj.data || typeof jsonObj.data !== 'object') {
    throw new Error('Invalid DPP Solver backup: missing data field.');
  }
  return {
    foldersCount: Array.isArray(jsonObj.data.folders) ? jsonObj.data.folders.length : 0,
    trashCount: jsonObj.data.trash ? Object.keys(jsonObj.data.trash).length : 0,
    customizationsCount: jsonObj.data.customizations ? Object.keys(jsonObj.data.customizations).length : 0,
    statusesCount: jsonObj.data.statuses ? Object.keys(jsonObj.data.statuses).length : 0,
    exportDate: jsonObj.exportDate || 'Unknown',
  };
}

export function importAllData(jsonObj, mode = 'merge') {
  validateBackup(jsonObj);
  const { data } = jsonObj;

  if (mode === 'overwrite') {
    if (Array.isArray(data.folders)) safeSet(STORAGE_KEYS.FOLDERS, data.folders);
    if (data.folderItems) safeSet(STORAGE_KEYS.FOLDER_ITEMS, data.folderItems);
    if (data.trash) safeSet(STORAGE_KEYS.TRASH, data.trash);
    if (data.customizations) safeSet(STORAGE_KEYS.CUSTOMIZATIONS, data.customizations);
    if (data.statuses) safeSet(STORAGE_KEYS.STATUS, data.statuses);
    if (data.theme) setTheme(data.theme);

    if (data.stars) {
      Object.entries(data.stars).forEach(([k, v]) => safeSet(k, v));
    }
    if (data.selections) {
      Object.entries(data.selections).forEach(([k, v]) => safeSet(k, v));
    }
  } else {
    // MERGE MODE
    // 1. Folders
    if (Array.isArray(data.folders)) {
      const currentFolders = getFolders();
      const folderMap = new Map(currentFolders.map(f => [f.id, f]));
      data.folders.forEach(f => {
        if (!folderMap.has(f.id)) currentFolders.push(f);
      });
      safeSet(STORAGE_KEYS.FOLDERS, currentFolders);
    }

    // 2. Folder Items
    if (data.folderItems && typeof data.folderItems === 'object') {
      const currentItems = getFolderItemsMap();
      Object.entries(data.folderItems).forEach(([fId, items]) => {
        if (!currentItems[fId]) {
          currentItems[fId] = items;
        } else if (Array.isArray(items)) {
          const existingQIds = new Set(currentItems[fId].map(it => it.questionId));
          items.forEach(it => {
            if (!existingQIds.has(it.questionId)) {
              currentItems[fId].push(it);
            }
          });
        }
      });
      safeSet(STORAGE_KEYS.FOLDER_ITEMS, currentItems);
    }

    // 3. Trash
    if (data.trash && typeof data.trash === 'object') {
      const currentTrash = getTrashMap();
      Object.assign(currentTrash, data.trash);
      safeSet(STORAGE_KEYS.TRASH, currentTrash);
    }

    // 4. Customizations
    if (data.customizations && typeof data.customizations === 'object') {
      const currentCust = getQuestionCustomizations();
      Object.assign(currentCust, data.customizations);
      safeSet(STORAGE_KEYS.CUSTOMIZATIONS, currentCust);
    }

    // 5. Statuses
    if (data.statuses && typeof data.statuses === 'object') {
      const currentStatus = getQuestionStatuses();
      Object.assign(currentStatus, data.statuses);
      safeSet(STORAGE_KEYS.STATUS, currentStatus);
    }

    // 6. Stars & selections
    if (data.stars && typeof data.stars === 'object') {
      Object.entries(data.stars).forEach(([k, v]) => {
        const existing = safeGet(k, {});
        safeSet(k, { ...existing, ...v });
      });
    }
    if (data.selections && typeof data.selections === 'object') {
      Object.entries(data.selections).forEach(([k, v]) => {
        const existing = safeGet(k, {});
        safeSet(k, { ...existing, ...v });
      });
    }
  }

  window.dispatchEvent(new Event('dpp_storage_updated'));
  return true;
}

// ──────────────────────────────────────────────────
// GLOBAL TAG PRESETS & COLOR PALETTE
// ──────────────────────────────────────────────────

export const PRESET_TAG_COLORS = {
  'TAH': { bg: '#dc2626', text: '#ffffff', border: '#b91c1c' },
  'KCLS': { bg: '#c25e17', text: '#ffffff', border: '#9a450a' },
  'Mindbender': { bg: '#7546a7', text: '#ffffff', border: '#5b2f8a' },
  'ASRQ': { bg: '#1f6892', text: '#ffffff', border: '#174f70' },
  'JEE Mains': { bg: '#0d9488', text: '#ffffff', border: '#0f766e' },
  'JEE Advanced': { bg: '#059669', text: '#ffffff', border: '#047857' },
  'IIT-JEE': { bg: '#15803d', text: '#ffffff', border: '#166534' },
  'Important': { bg: '#e11d48', text: '#ffffff', border: '#be123c' },
  'Tricky': { bg: '#d97706', text: '#ffffff', border: '#b45309' },
  'Must Revise': { bg: '#6366f1', text: '#ffffff', border: '#4f46e5' },
};

export const COLOR_OPTIONS = [
  '#dc2626', // Red
  '#c25e17', // Orange/Brown (KCLS)
  '#d97706', // Amber
  '#059669', // Emerald
  '#0d9488', // Teal
  '#1f6892', // Ocean Blue
  '#4f46e5', // Indigo
  '#7546a7', // Purple (Mindbender)
  '#e11d48', // Rose
  '#475569', // Slate
];

export function getTagStyle(tagName, customColor) {
  if (customColor) {
    return { background: customColor, color: '#ffffff', borderColor: customColor };
  }
  const match = Object.keys(PRESET_TAG_COLORS).find(k => tagName.toLowerCase().includes(k.toLowerCase()));
  if (match) {
    const c = PRESET_TAG_COLORS[match];
    return { background: c.bg, color: c.text, borderColor: c.border };
  }
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  const color = COLOR_OPTIONS[Math.abs(hash) % COLOR_OPTIONS.length];
  return { background: color, color: '#ffffff', borderColor: color };
}
