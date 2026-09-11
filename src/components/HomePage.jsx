import { useRef, useState, useEffect } from 'react';
import ThemeToggle from './ThemeToggle';
import BackupModal from './BackupModal';
import {
  getFolders,
  createFolder,
  getFolderItemsMap,
  getTrashList,
  isQuestionTrashed,
  getQuestionStatuses,
  QUESTION_STATUS,
} from '../utils/storage';

// Pre-defined chapter list — users can add more DPP files anytime
const CHAPTERS = [
  {
    id: 'seq-series',
    icon: '📐',
    title: 'Sequence & Series',
    subject: 'Mathematics',
    file: '/dpps/seq_series_merged.html',
    questionCount: 35,
    tags: ['AP', 'GP', 'HP', 'AGP', 'Telescoping'],
  },
  {
    id: 'basic-math',
    icon: '🧮',
    title: 'Basic Mathematics',
    subject: 'Mathematics',
    file: '/dpps/basic_mathematics.html',
    questionCount: 78,
    tags: ['Surds', 'Logarithms', 'Modulus', 'Polynomials', 'Inequalities'],
  },
  {
    id: 'quadratic-eq',
    icon: '📈',
    title: 'Quadratic Equations',
    subject: 'Mathematics',
    file: '/dpps/quadratic_equations.html',
    questionCount: 67,
    tags: ['Roots', 'Discriminant', 'Location of Roots', 'Range', 'Inequalities'],
  },
  {
    id: 'seq-series-class',
    icon: '📚',
    title: 'Sequence and series class Dpp',
    subject: 'Mathematics',
    file: '/dpps/sequence_series_class.html',
    questionCount: 178,
    tags: ['Class Notes', 'AP', 'GP', 'Location of Roots'],
  },
  {
    id: 'circle-combined',
    icon: '⭕',
    title: 'Circle (Combined DPP)',
    subject: 'Mathematics',
    file: '/dpps/circle_combined.html',
    questionCount: 122,
    tags: ['Part 01', 'Part 02', 'Tangents', 'Loci', 'TAH'],
  },
  {
    id: 'straight-lines-part1',
    icon: '📏',
    title: 'Straight Lines (Part 1)',
    subject: 'Mathematics',
    file: '/dpps/straight_lines_part1.html',
    questionCount: 76,
    tags: ['Coordinate Geometry', 'Loci', 'Slope', 'Distance Form'],
  },
  {
    id: 'parabola-part1',
    icon: '🪃',
    title: 'Parabola (Part 1)',
    subject: 'Mathematics',
    file: '/dpps/parabola_part1.html',
    questionCount: 54,
    tags: ['Standard Parabola', 'Latus Rectum', 'Focal Chord', 'Tangents'],
  },
  {
    id: 'parabola-part2',
    icon: '🪃',
    title: 'Parabola (Part 2)',
    subject: 'Mathematics',
    file: '/dpps/parabola_part2.html',
    questionCount: 93,
    tags: ['Normals', 'Co-normal Points', 'Focal Properties', 'Loci', 'TAH'],
  },
];

const EMOJI_OPTIONS = ['📁', '🔥', '⚡', '🎯', '📚', '💎', '💡', '🧮', '📐', '⭐'];

export default function HomePage({ onLoadDPP, loadedChapters, onOpenFolder, onOpenTrash }) {
  const fileRef = useRef(null);
  const [activeTab, setActiveTab] = useState('chapters'); // 'chapters' | 'folders'
  const [folders, setFolders] = useState(() => getFolders());
  const [folderItemsMap, setFolderItemsMap] = useState(() => getFolderItemsMap());
  const [trashCount, setTrashCount] = useState(() => getTrashList().length);
  const [statuses, setStatuses] = useState(() => getQuestionStatuses());
  const [isBackupOpen, setIsBackupOpen] = useState(false);

  // New folder inline form
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderIcon, setNewFolderIcon] = useState('📁');
  const [newFolderDesc, setNewFolderDesc] = useState('');

  const refreshData = () => {
    setFolders(getFolders());
    setFolderItemsMap(getFolderItemsMap());
    setTrashCount(getTrashList().length);
    setStatuses(getQuestionStatuses());
  };

  useEffect(() => {
    window.addEventListener('dpp_storage_updated', refreshData);
    return () => window.removeEventListener('dpp_storage_updated', refreshData);
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onLoadDPP(ev.target.result, file.name.replace(/\.html?$/i, ''));
    };
    reader.readAsText(file);
  };

  const handleChapterClick = async (chapter) => {
    try {
      const response = await fetch(chapter.file);
      if (!response.ok) throw new Error('File not found');
      const html = await response.text();
      onLoadDPP(html, chapter.id);
    } catch (err) {
      console.error('Failed to load DPP:', err);
      alert('Could not load the DPP file. Please upload it manually.');
    }
  };

  const handleCreateFolder = (e) => {
    e.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;

    createFolder({
      name,
      icon: newFolderIcon,
      description: newFolderDesc,
    });
    setNewFolderName('');
    setNewFolderDesc('');
    setShowCreateFolder(false);
    refreshData();
  };

  // Status counts across all questions
  const solvedCount = Object.values(statuses).filter(s => s === QUESTION_STATUS.SOLVED).length;
  const reviseCount = Object.values(statuses).filter(s => s === QUESTION_STATUS.REVISE).length;
  const doubtCount = Object.values(statuses).filter(s => s === QUESTION_STATUS.DOUBT).length;

  return (
    <div className="home-container">
      {/* Top Utility Bar */}
      <div className="home-top-controls fade-in">
        <div className="home-status-summary">
          {solvedCount > 0 && <span className="home-status-chip solved">🟢 {solvedCount} Solved</span>}
          {reviseCount > 0 && <span className="home-status-chip revise">🟡 {reviseCount} Revise</span>}
          {doubtCount > 0 && <span className="home-status-chip doubt">🔴 {doubtCount} Doubts</span>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm backup-btn"
            onClick={() => setIsBackupOpen(true)}
            title="1-Click Backup & Data Sync (Export/Import JSON)"
          >
            💾 Backup & Sync
          </button>
          <ThemeToggle />
        </div>
      </div>

      <div className="home-hero fade-in">
        <h1 className="home-title">📝 DPP Solver</h1>
        <p className="home-subtitle">
          Timed JEE practice with chapter-wise folders, soft-delete trash bin, and custom tags
        </p>

        {/* Top Navigation Tabs */}
        <div className="home-nav-tabs">
          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'chapters' ? 'active' : ''}`}
            onClick={() => setActiveTab('chapters')}
          >
            📚 Chapters ({CHAPTERS.length + loadedChapters.length})
          </button>
          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'folders' ? 'active' : ''}`}
            onClick={() => setActiveTab('folders')}
          >
            📁 Custom Folders ({folders.length})
          </button>
          <button
            type="button"
            className="nav-tab-btn trash-tab"
            onClick={onOpenTrash}
            title="Open Trash Bin"
          >
            🗑️ Trash {trashCount > 0 && <span className="tab-badge red">{trashCount}</span>}
          </button>
        </div>
      </div>

      {/* CHAPTERS TAB */}
      {activeTab === 'chapters' && (
        <div className="chapter-grid fade-in">
          {CHAPTERS.map(ch => (
            <div
              key={ch.id}
              className="chapter-card fade-in"
              onClick={() => handleChapterClick(ch)}
            >
              <div className="chapter-card-icon">{ch.icon}</div>
              <div className="chapter-card-title">{ch.title}</div>
              <div className="chapter-card-meta">
                <span>{ch.subject}</span>
                <span>•</span>
                <span>{ch.questionCount} Questions</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '10px' }}>
                {ch.tags.map(t => (
                  <span key={t} className="chapter-card-badge">{t}</span>
                ))}
              </div>
            </div>
          ))}

          {/* Loaded custom DPPs */}
          {loadedChapters.map(ch => (
            <div
              key={ch.id}
              className="chapter-card fade-in"
              onClick={() => onLoadDPP(ch.html, ch.id)}
            >
              <div className="chapter-card-icon">📄</div>
              <div className="chapter-card-title">{ch.title}</div>
              <div className="chapter-card-meta">
                <span>{ch.questionCount} Questions</span>
              </div>
            </div>
          ))}

          {/* Upload Card */}
          <div
            className="chapter-card upload-card fade-in"
            onClick={() => fileRef.current?.click()}
          >
            <div className="upload-card-icon">➕</div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Upload DPP</div>
            <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>
              Drop or browse .html files
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".html,.htm"
              onChange={handleFileUpload}
            />
          </div>
        </div>
      )}

      {/* FOLDERS TAB */}
      {activeTab === 'folders' && (
        <div className="fade-in">
          <div className="folders-grid">
            {folders.map(folder => {
              const allItems = folderItemsMap[folder.id] || [];
              const activeItems = allItems.filter(it => !isQuestionTrashed(it.questionId));
              const qCount = activeItems.length;

              // Distinct chapters in this folder
              const distinctChapters = Array.from(
                new Set(activeItems.map(it => it.chapterTitle || 'DPP'))
              );

              return (
                <div
                  key={folder.id}
                  className="folder-card fade-in"
                  onClick={() => onOpenFolder(folder)}
                >
                  <div className="folder-card-top">
                    <span className="folder-card-icon">{folder.icon || '📁'}</span>
                    <span className="folder-card-qcount">
                      {qCount} {qCount === 1 ? 'Question' : 'Questions'}
                    </span>
                  </div>

                  <h3 className="folder-card-name">{folder.name}</h3>
                  {folder.description && (
                    <p className="folder-card-desc">{folder.description}</p>
                  )}

                  <div className="folder-card-chapters">
                    {distinctChapters.length === 0 ? (
                      <span className="folder-empty-tag">Empty folder — add questions from DPPs</span>
                    ) : (
                      distinctChapters.map(chap => (
                        <span key={chap} className="folder-chapter-chip">
                          📚 {chap}
                        </span>
                      ))
                    )}
                  </div>

                  <div className="folder-card-footer">
                    <span className="folder-card-action">Open & Solve Chapter-wise →</span>
                  </div>
                </div>
              );
            })}

            {/* Create New Folder Card */}
            {!showCreateFolder ? (
              <div
                className="folder-card create-folder-card fade-in"
                onClick={() => setShowCreateFolder(true)}
              >
                <div className="upload-card-icon">➕</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Create New Folder</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Group questions chapter-wise
                </div>
              </div>
            ) : (
              <div className="folder-card create-folder-form-card fade-in">
                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '8px' }}>
                  New Folder
                </div>
                <div className="emoji-picker-row">
                  {EMOJI_OPTIONS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      className={`emoji-btn ${newFolderIcon === emoji ? 'active' : ''}`}
                      onClick={() => setNewFolderIcon(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <form onSubmit={handleCreateFolder} style={{ marginTop: '10px' }}>
                  <input
                    type="text"
                    className="form-input"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Folder Name (e.g. Tough Problems)"
                    autoFocus
                    required
                  />
                  <input
                    type="text"
                    className="form-input"
                    value={newFolderDesc}
                    onChange={(e) => setNewFolderDesc(e.target.value)}
                    placeholder="Optional Description..."
                    style={{ marginTop: '6px' }}
                  />
                  <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={!newFolderName.trim()}>
                      Create
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setShowCreateFolder(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Backup Modal */}
      <BackupModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
      />
    </div>
  );
}
