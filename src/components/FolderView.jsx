import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import QuestionCard from './QuestionCard';
import SprintView from './SprintView';
import ThemeToggle from './ThemeToggle';
import { useTimerEngine, formatTime } from '../hooks/useTimerEngine';
import {
  getFolderItems,
  removeQuestionFromFolder,
  moveToTrash,
  isQuestionTrashed,
  deleteFolder,
  updateFolder,
  getQuestionStatuses,
  QUESTION_STATUS,
} from '../utils/storage';

function loadJSON(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
}

export default function FolderView({ folder, onBack, onFolderDeleted }) {
  const containerRef = useRef(null);
  const starKey = `dpp-folder-starred-${folder.id}`;
  const selKey = `dpp-folder-selections-${folder.id}`;

  const [rawItems, setRawItems] = useState(() => getFolderItems(folder.id));
  const [selectedTag, setSelectedTag] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'SOLVED' | 'REVISE' | 'DOUBT'
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [isEditingFolder, setIsEditingFolder] = useState(false);
  const [folderNameInput, setFolderNameInput] = useState(folder.name);
  const [folderIconInput, setFolderIconInput] = useState(folder.icon || '📁');
  const [isSprintActive, setIsSprintActive] = useState(false);
  const [statuses, setStatuses] = useState(() => getQuestionStatuses());

  // Reload when storage updates
  useEffect(() => {
    const handleStorageUpdate = () => {
      setRawItems(getFolderItems(folder.id));
      setStatuses(getQuestionStatuses());
    };
    window.addEventListener('dpp_storage_updated', handleStorageUpdate);
    return () => window.removeEventListener('dpp_storage_updated', handleStorageUpdate);
  }, [folder.id]);

  // Load persisted selections
  const savedSelections = useRef(loadJSON(selKey));

  // Build active question list (filtering out trashed questions)
  const [questions, setQuestions] = useState(() => {
    return rawItems
      .filter(it => !isQuestionTrashed(it.questionId))
      .map(it => ({
        ...it.question,
        chapterId: it.chapterId,
        chapterTitle: it.chapterTitle,
        selectedOption: savedSelections.current[it.question.id] || null,
      }));
  });

  // Keep questions in sync with rawItems changes
  useEffect(() => {
    setQuestions(prev => {
      const prevMap = new Map(prev.map(q => [q.id, q]));
      return rawItems
        .filter(it => !isQuestionTrashed(it.questionId))
        .map(it => {
          const existing = prevMap.get(it.questionId);
          return {
            ...it.question,
            chapterId: it.chapterId,
            chapterTitle: it.chapterTitle,
            selectedOption: existing?.selectedOption ?? savedSelections.current[it.question.id] ?? null,
            timerState: existing?.timerState ?? 'idle',
            timerRemaining: existing?.timerRemaining ?? it.question.timerDuration ?? 180,
            timerDuration: existing?.timerDuration ?? it.question.timerDuration ?? 180,
          };
        });
    });
  }, [rawItems]);

  // Persist selections
  useEffect(() => {
    const selections = {};
    questions.forEach(q => {
      if (q.selectedOption) selections[q.id] = q.selectedOption;
    });
    localStorage.setItem(selKey, JSON.stringify(selections));
  }, [questions, selKey]);

  // Starred questions (persisted)
  const [starred, setStarred] = useState(() => loadJSON(starKey));
  useEffect(() => {
    localStorage.setItem(starKey, JSON.stringify(starred));
  }, [starred, starKey]);

  const toggleStar = useCallback((id) => {
    setStarred(prev => {
      const next = { ...prev };
      if (next[id]) delete next[id]; else next[id] = true;
      return next;
    });
  }, []);

  // Typeset MathJax
  useEffect(() => {
    const run = async () => {
      while (!window.MathJax?.startup?.promise) {
        await new Promise(r => setTimeout(r, 100));
      }
      await window.MathJax.startup.promise;
      if (containerRef.current) {
        await window.MathJax.typesetPromise([containerRef.current]);
      }
    };
    run().catch(console.error);
  }, [questions, selectedTag, statusFilter, showStarredOnly]);

  const { startTimer, pauseTimer, resetTimer, setDuration } = useTimerEngine(setQuestions);

  // Session timer
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [sessionPaused, setSessionPaused] = useState(false);
  const sessionAccum = useRef(0);
  const sessionStart = useRef(Date.now());

  useEffect(() => {
    if (sessionPaused) return;
    sessionStart.current = Date.now();
    const iv = setInterval(() => {
      setSessionElapsed(sessionAccum.current + Math.floor((Date.now() - sessionStart.current) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [sessionPaused]);

  const toggleSessionPause = useCallback(() => {
    if (!sessionPaused) {
      sessionAccum.current += Math.floor((Date.now() - sessionStart.current) / 1000);
    }
    setSessionPaused(p => !p);
  }, [sessionPaused]);

  // Select option (toggle)
  const handleSelectOption = useCallback((qId, label) => {
    setQuestions(prev => prev.map(q =>
      q.id === qId ? { ...q, selectedOption: q.selectedOption === label ? null : label } : q
    ));
  }, []);

  // Reset all
  const handleResetAll = useCallback(() => {
    setQuestions(prev => prev.map(q => ({
      ...q,
      selectedOption: null,
      timerState: 'idle',
      timerRemaining: q.timerDuration || 180,
    })));
  }, []);

  // Remove from folder
  const handleRemoveFromFolder = useCallback((qId) => {
    removeQuestionFromFolder(folder.id, qId);
    setQuestions(prev => prev.filter(q => q.id !== qId));
  }, [folder.id]);

  // Move to trash
  const handleDeleteQuestion = useCallback((question) => {
    if (window.confirm('Move this question to Trash?')) {
      moveToTrash(question, question.chapterId, question.chapterTitle);
      setQuestions(prev => prev.filter(q => q.id !== question.id));
    }
  }, []);

  // Update question header / tags
  const handleUpdateQuestion = useCallback((qId, updates) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === qId) {
        return { ...q, ...updates };
      }
      return q;
    }));
  }, []);

  // Folder rename/update
  const handleSaveRename = (e) => {
    e?.preventDefault();
    if (!folderNameInput.trim()) return;
    updateFolder(folder.id, {
      name: folderNameInput.trim(),
      icon: folderIconInput,
    });
    folder.name = folderNameInput.trim();
    folder.icon = folderIconInput;
    setIsEditingFolder(false);
  };

  const handleDeleteThisFolder = () => {
    if (window.confirm(`Are you sure you want to delete the folder "${folder.name}"? Questions in other chapters will not be affected.`)) {
      deleteFolder(folder.id);
      if (onFolderDeleted) onFolderDeleted(folder.id);
      onBack();
    }
  };

  // Status Counts
  const solvedCount = useMemo(() => questions.filter(q => statuses[q.id] === QUESTION_STATUS.SOLVED).length, [questions, statuses]);
  const reviseCount = useMemo(() => questions.filter(q => statuses[q.id] === QUESTION_STATUS.REVISE).length, [questions, statuses]);
  const doubtCount = useMemo(() => questions.filter(q => statuses[q.id] === QUESTION_STATUS.DOUBT).length, [questions, statuses]);

  // Extract all unique tags present across questions in this folder
  const availableTags = useMemo(() => {
    const tagSet = new Set();
    questions.forEach(q => {
      if (Array.isArray(q.tags)) {
        q.tags.forEach(t => tagSet.add(t));
      }
    });
    return Array.from(tagSet);
  }, [questions]);

  // Filter questions by tag, status & star
  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      if (showStarredOnly && !starred[q.id]) return false;
      if (statusFilter !== 'ALL') {
        if (statuses[q.id] !== statusFilter) return false;
      }
      if (selectedTag !== 'ALL') {
        const hasTag = Array.isArray(q.tags) && q.tags.includes(selectedTag);
        const inHeader = q.header && q.header.toLowerCase().includes(selectedTag.toLowerCase());
        if (!hasTag && !inHeader) return false;
      }
      return true;
    });
  }, [questions, selectedTag, statusFilter, showStarredOnly, starred, statuses]);

  // Group questions CHAPTER-WISE
  const chapterGroups = useMemo(() => {
    const map = {};
    filteredQuestions.forEach(q => {
      const chap = q.chapterTitle || 'DPP Questions';
      if (!map[chap]) map[chap] = [];
      map[chap].push(q);
    });
    return map;
  }, [filteredQuestions]);

  if (isSprintActive) {
    return (
      <SprintView
        questions={questions}
        title={folder.name}
        onExit={() => setIsSprintActive(false)}
      />
    );
  }

  const answered = questions.filter(q => q.selectedOption !== null).length;
  const total = questions.length;
  const starredCount = questions.filter(q => starred[q.id]).length;
  const totalChapters = Object.keys(chapterGroups).length;

  return (
    <div className="dpp-container" ref={containerRef}>
      {/* Sticky Top Bar */}
      <div className="top-bar">
        <div className="top-bar-left">
          <button className="back-btn" onClick={onBack}>← Back to Folders</button>
          <div className="top-bar-stats">
            <span>
              <span className="answered-count">{answered}</span>/{total} answered
            </span>
            {starredCount > 0 && (
              <button
                className={`star-filter-btn ${showStarredOnly ? 'active' : ''}`}
                onClick={() => setShowStarredOnly(p => !p)}
              >
                ★ {starredCount} starred
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Sprint Trigger */}
          {total > 0 && (
            <button
              type="button"
              className="btn btn-primary btn-sm sprint-launch-btn"
              onClick={() => setIsSprintActive(true)}
              title="Start timed Mock Test / Sprint from this folder"
            >
              🎯 Start Sprint
            </button>
          )}
          <ThemeToggle />
          <button
            className={`session-timer ${sessionPaused ? 'paused' : ''}`}
            onClick={toggleSessionPause}
            title={sessionPaused ? 'Resume session timer' : 'Pause session timer'}
          >
            {sessionPaused ? '▶' : '⏸'} {formatTime(sessionElapsed)}
          </button>
          <button className="btn btn-outline btn-sm" onClick={handleResetAll}>↺ Reset All</button>
        </div>
      </div>

      {/* Folder Header */}
      <div className="folder-header-card fade-in">
        <div className="folder-header-top">
          <div className="folder-header-title-row">
            <span className="folder-header-icon">{folder.icon || '📁'}</span>
            {!isEditingFolder ? (
              <div>
                <h1 className="folder-header-title">{folder.name}</h1>
                {folder.description && <p className="folder-header-desc">{folder.description}</p>}
              </div>
            ) : (
              <form onSubmit={handleSaveRename} className="folder-rename-inline-form">
                <input
                  type="text"
                  className="form-input"
                  value={folderNameInput}
                  onChange={(e) => setFolderNameInput(e.target.value)}
                  style={{ width: '220px' }}
                  autoFocus
                />
                <button type="submit" className="btn btn-primary btn-sm">Save</button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setIsEditingFolder(false)}>Cancel</button>
              </form>
            )}
          </div>

          <div className="folder-header-actions">
            {total > 0 && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setIsSprintActive(true)}
              >
                🎯 Mock Test Mode
              </button>
            )}
            {!isEditingFolder && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setIsEditingFolder(true)}
                title="Rename folder"
              >
                ✏️ Rename
              </button>
            )}
            <button
              type="button"
              className="btn btn-outline btn-sm danger-text"
              onClick={handleDeleteThisFolder}
              title="Delete folder"
            >
              🗑️ Delete Folder
            </button>
          </div>
        </div>

        <div className="folder-meta-stats">
          <span>📚 {totalChapters} Chapter{totalChapters !== 1 ? 's' : ''}</span>
          <span>•</span>
          <span>📝 {total} Question{total !== 1 ? 's' : ''}</span>
          <span>•</span>
          <span>Organized Chapter-wise</span>
          {solvedCount > 0 && <span style={{ color: '#059669' }}>• 🟢 {solvedCount} Solved</span>}
          {doubtCount > 0 && <span style={{ color: '#dc2626' }}>• 🔴 {doubtCount} Doubts</span>}
        </div>
      </div>

      {/* Filter Bar (Status & Tags) */}
      {(availableTags.length > 0 || total > 0) && (
        <div className="tag-filter-bar fade-in">
          <span className="filter-label">Filter:</span>
          <button
            type="button"
            className={`tag-filter-chip ${selectedTag === 'ALL' && statusFilter === 'ALL' && !showStarredOnly ? 'active' : ''}`}
            onClick={() => { setSelectedTag('ALL'); setStatusFilter('ALL'); setShowStarredOnly(false); }}
          >
            All ({total})
          </button>

          {/* Status Filters */}
          {solvedCount > 0 && (
            <button
              type="button"
              className={`tag-filter-chip filter-solved ${statusFilter === QUESTION_STATUS.SOLVED ? 'active-solved' : ''}`}
              onClick={() => setStatusFilter(statusFilter === QUESTION_STATUS.SOLVED ? 'ALL' : QUESTION_STATUS.SOLVED)}
            >
              🟢 Solved ({solvedCount})
            </button>
          )}
          {reviseCount > 0 && (
            <button
              type="button"
              className={`tag-filter-chip filter-revise ${statusFilter === QUESTION_STATUS.REVISE ? 'active-revise' : ''}`}
              onClick={() => setStatusFilter(statusFilter === QUESTION_STATUS.REVISE ? 'ALL' : QUESTION_STATUS.REVISE)}
            >
              🟡 Revise ({reviseCount})
            </button>
          )}
          {doubtCount > 0 && (
            <button
              type="button"
              className={`tag-filter-chip filter-doubt ${statusFilter === QUESTION_STATUS.DOUBT ? 'active-doubt' : ''}`}
              onClick={() => setStatusFilter(statusFilter === QUESTION_STATUS.DOUBT ? 'ALL' : QUESTION_STATUS.DOUBT)}
            >
              🔴 Doubts ({doubtCount})
            </button>
          )}

          {starredCount > 0 && (
            <button
              type="button"
              className={`tag-filter-chip ${showStarredOnly ? 'active' : ''}`}
              onClick={() => setShowStarredOnly(p => !p)}
            >
              ★ Starred ({starredCount})
            </button>
          )}

          {availableTags.map(tag => (
            <button
              key={tag}
              type="button"
              className={`tag-filter-chip ${selectedTag === tag ? 'active' : ''}`}
              onClick={() => { setSelectedTag(selectedTag === tag ? 'ALL' : tag); }}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Empty State */}
      {questions.length === 0 ? (
        <div className="empty-state-card fade-in">
          <div className="empty-state-icon">📂</div>
          <div className="empty-state-title">This folder is empty</div>
          <p className="empty-state-subtitle">
            Browse any DPP chapter and click the 📁 button on any question to add it to this folder!
          </p>
          <button className="btn btn-primary" onClick={onBack} style={{ marginTop: '16px' }}>
            ← Back to Chapters
          </button>
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="empty-state-card fade-in">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-title">No questions match filter</div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => { setSelectedTag('ALL'); setStatusFilter('ALL'); setShowStarredOnly(false); }}
            style={{ marginTop: '12px' }}
          >
            Reset Filters
          </button>
        </div>
      ) : (
        /* CHAPTER-WISE SECTIONS */
        Object.entries(chapterGroups).map(([chapterTitle, chapterQs]) => {
          return (
            <div key={chapterTitle} className="chapter-folder-section fade-in">
              <div className="chapter-folder-section-header">
                <div className="chapter-folder-title">
                  <span className="section-dot"></span>
                  📚 {chapterTitle}
                </div>
                <span className="chapter-folder-badge">{chapterQs.length} question{chapterQs.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="chapter-folder-questions">
                {chapterQs.map((q) => {
                  const globalIdx = questions.indexOf(q);
                  return (
                    <QuestionCard
                      key={q.id}
                      question={q}
                      index={globalIdx}
                      starred={!!starred[q.id]}
                      chapterId={q.chapterId}
                      chapterTitle={q.chapterTitle}
                      onSelectOption={handleSelectOption}
                      onStartTimer={startTimer}
                      onPauseTimer={pauseTimer}
                      onResetTimer={resetTimer}
                      onSetDuration={setDuration}
                      onToggleStar={toggleStar}
                      onDeleteQuestion={handleDeleteQuestion}
                      onUpdateQuestion={handleUpdateQuestion}
                      onRemoveFromFolder={handleRemoveFromFolder}
                      onStatusChange={() => setStatuses(getQuestionStatuses())}
                    />
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
