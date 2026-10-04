import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import QuestionCard from './QuestionCard';
import SprintView from './SprintView';
import ThemeToggle from './ThemeToggle';
import AddSectionModal from './AddSectionModal';
import { useTimerEngine, formatTime } from '../hooks/useTimerEngine';
import {
  moveToTrash,
  isQuestionTrashed,
  getTrashList,
  getQuestionStatuses,
  QUESTION_STATUS,
  getAllSubQuestionStatuses,
  getCustomSections,
  addCustomSection,
  deleteCustomSection,
  getQuestionSection,
  setQuestionSection,
  getCollapsedSections,
  setCollapsedSections,
} from '../utils/storage';

function loadJSON(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
}

export default function DPPView({ dppData, onBack, onOpenTrash }) {
  const containerRef = useRef(null);
  const starKey = `dpp-starred-${dppData.id}`;
  const selKey = `dpp-selections-${dppData.id}`;

  const [selectedTag, setSelectedTag] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'SOLVED' | 'REVISE' | 'DOUBT'
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [trashCount, setTrashCount] = useState(() => getTrashList().length);
  const [isSprintActive, setIsSprintActive] = useState(false);
  const [statuses, setStatuses] = useState(() => getQuestionStatuses());
  const [subqStatuses, setSubqStatuses] = useState(() => getAllSubQuestionStatuses());

  // Custom Sections & Collapsed Accordion State
  const [customSections, setCustomSections] = useState(() => getCustomSections(dppData.id));
  const [collapsedSections, setCollapsedSectionsState] = useState(() => new Set(getCollapsedSections(dppData.id)));
  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false);

  // Keep storage updated
  useEffect(() => {
    const handleStorageUpdate = () => {
      setTrashCount(getTrashList().length);
      setStatuses(getQuestionStatuses());
      setSubqStatuses(getAllSubQuestionStatuses());
      setCustomSections(getCustomSections(dppData.id));
    };
    window.addEventListener('dpp_storage_updated', handleStorageUpdate);
    return () => window.removeEventListener('dpp_storage_updated', handleStorageUpdate);
  }, [dppData.id]);

  // Load persisted selections
  const savedSelections = useRef(loadJSON(selKey));

  // Flatten all questions, excluding trashed ones, restoring selections and custom sections
  const [questions, setQuestions] = useState(() => {
    const all = [];
    dppData.sections.forEach(sec => {
      sec.questions.forEach(q => {
        if (!isQuestionTrashed(q.id)) {
          const customSection = getQuestionSection(q.id);
          all.push({
            ...q,
            chapterId: dppData.id,
            chapterTitle: dppData.title,
            sectionTitle: customSection || q.sectionTitle || sec.title,
            originalSectionTitle: q.originalSectionTitle || q.sectionTitle || sec.title,
            selectedOption: savedSelections.current[q.id] || null,
          });
        }
      });
    });
    return all;
  });

  // Persist selections whenever they change
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

  // MathJax v3: wait for startup, then typesetPromise on each data change
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
  }, [dppData, showStarredOnly, selectedTag, statusFilter, questions.length]);

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

  // Delete question (move to trash)
  const handleDeleteQuestion = useCallback((question) => {
    if (window.confirm(`Move question to Trash? You can restore it anytime from the Trash Bin.`)) {
      moveToTrash(question, dppData.id, dppData.title);
      setQuestions(prev => prev.filter(q => q.id !== question.id));
    }
  }, [dppData.id, dppData.title]);

  // Update question heading / tags
  const handleUpdateQuestion = useCallback((qId, updates) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === qId) {
        return { ...q, ...updates };
      }
      return q;
    }));
  }, []);

  // Helper: check if a question matches a status filter (considering sub-questions)
  const questionMatchesStatus = useCallback((q, filter) => {
    if (filter === 'ALL') return true;
    const hasSubQ = Array.isArray(q.subQuestions) && q.subQuestions.length > 0;
    if (hasSubQ) {
      const subMap = subqStatuses[q.id] || {};
      const values = Object.values(subMap);
      if (values.length === 0) return false;
      if (filter === QUESTION_STATUS.SOLVED) {
        return values.includes(QUESTION_STATUS.SOLVED);
      }
      if (filter === QUESTION_STATUS.REVISE) {
        return values.includes(QUESTION_STATUS.REVISE);
      }
      if (filter === QUESTION_STATUS.WRONG || filter === 'DOUBT') {
        return values.includes(QUESTION_STATUS.WRONG) || values.includes('DOUBT');
      }
      return false;
    }

    const s = statuses[q.id];
    if (filter === QUESTION_STATUS.WRONG || filter === 'DOUBT') {
      return s === QUESTION_STATUS.WRONG || s === 'DOUBT';
    }
    return s === filter;
  }, [statuses, subqStatuses]);

  // Status Counts
  const solvedCount = useMemo(() => questions.filter(q => questionMatchesStatus(q, QUESTION_STATUS.SOLVED)).length, [questions, questionMatchesStatus]);
  const reviseCount = useMemo(() => questions.filter(q => questionMatchesStatus(q, QUESTION_STATUS.REVISE)).length, [questions, questionMatchesStatus]);
  const wrongCount = useMemo(() => questions.filter(q => questionMatchesStatus(q, QUESTION_STATUS.WRONG)).length, [questions, questionMatchesStatus]);

  // Unique tags in this DPP
  const availableTags = useMemo(() => {
    const tagSet = new Set();
    questions.forEach(q => {
      if (Array.isArray(q.tags)) {
        q.tags.forEach(t => tagSet.add(t));
      }
    });
    return Array.from(tagSet);
  }, [questions]);

  // Filtered questions
  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      if (showStarredOnly && !starred[q.id]) return false;
      if (statusFilter !== 'ALL') {
        if (!questionMatchesStatus(q, statusFilter)) return false;
      }
      if (selectedTag !== 'ALL') {
        const hasTag = Array.isArray(q.tags) && q.tags.includes(selectedTag);
        const inHeader = q.header && q.header.toLowerCase().includes(selectedTag.toLowerCase());
        if (!hasTag && !inHeader) return false;
      }
      return true;
    });
  }, [questions, selectedTag, statusFilter, showStarredOnly, starred, questionMatchesStatus]);

  // Toggle collapse for a single section
  const toggleCollapse = useCallback((secTitle) => {
    setCollapsedSectionsState(prev => {
      const next = new Set(prev);
      if (next.has(secTitle)) {
        next.delete(secTitle);
      } else {
        next.add(secTitle);
      }
      setCollapsedSections(dppData.id, Array.from(next));
      return next;
    });
  }, [dppData.id]);

  // Section titles (original parsed sections + custom sections + any assigned in questions)
  const allSectionTitles = useMemo(() => {
    const titles = [];
    dppData.sections.forEach(sec => {
      if (!titles.includes(sec.title)) titles.push(sec.title);
    });
    customSections.forEach(title => {
      if (!titles.includes(title)) titles.push(title);
    });
    questions.forEach(q => {
      if (q.sectionTitle && !titles.includes(q.sectionTitle)) {
        titles.push(q.sectionTitle);
      }
    });
    return titles;
  }, [dppData.sections, customSections, questions]);

  // Expand all sections
  const handleExpandAll = useCallback(() => {
    setCollapsedSectionsState(new Set());
    setCollapsedSections(dppData.id, []);
  }, [dppData.id]);

  // Collapse all sections
  const handleCollapseAll = useCallback(() => {
    setCollapsedSectionsState(new Set(allSectionTitles));
    setCollapsedSections(dppData.id, allSectionTitles);
  }, [dppData.id, allSectionTitles]);

  // Add new custom section
  const handleAddSection = useCallback((title) => {
    const updated = addCustomSection(dppData.id, title);
    setCustomSections(updated);
  }, [dppData.id]);

  // Delete custom section
  const handleDeleteCustomSection = useCallback((secTitle, qCount) => {
    if (qCount > 0) {
      const ok = window.confirm(
        `This section contains ${qCount} question(s). Deleting it will restore those questions back to their original sections. Proceed?`
      );
      if (!ok) return;
      questions.forEach(q => {
        if (q.sectionTitle === secTitle) {
          const original = q.originalSectionTitle || 'Questions';
          setQuestionSection(q.id, original);
        }
      });
      setQuestions(prev => prev.map(q => {
        if (q.sectionTitle === secTitle) {
          return { ...q, sectionTitle: q.originalSectionTitle || 'Questions' };
        }
        return q;
      }));
    } else {
      const ok = window.confirm(`Remove custom section "${secTitle}"?`);
      if (!ok) return;
    }
    deleteCustomSection(dppData.id, secTitle);
    setCustomSections(getCustomSections(dppData.id));
    setCollapsedSectionsState(prev => {
      const next = new Set(prev);
      next.delete(secTitle);
      setCollapsedSections(dppData.id, Array.from(next));
      return next;
    });
  }, [dppData.id, questions]);

  // Move question to section
  const handleMoveQuestionSection = useCallback((qId, targetSection) => {
    setQuestionSection(qId, targetSection);
    setQuestions(prev => prev.map(q => q.id === qId ? { ...q, sectionTitle: targetSection } : q));
  }, []);

  if (isSprintActive) {
    return (
      <SprintView
        questions={questions}
        title={dppData.title}
        onExit={() => setIsSprintActive(false)}
      />
    );
  }

  const answered = questions.filter(q => q.selectedOption !== null).length;
  const total = questions.length;
  const starredCount = questions.filter(q => starred[q.id]).length;

  return (
    <div className="dpp-container" ref={containerRef}>
      {/* Sticky Top Bar */}
      <div className="top-bar">
        <div className="top-bar-left">
          <button className="back-btn" onClick={onBack}>← Back</button>
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
          {total > 0 && (
            <button
              type="button"
              className="btn btn-primary btn-sm sprint-launch-btn"
              onClick={() => setIsSprintActive(true)}
              title="Start timed Mock Test / Sprint for this chapter"
            >
              🎯 Start Sprint
            </button>
          )}
          <ThemeToggle />
          {trashCount > 0 && onOpenTrash && (
            <button
              type="button"
              className="btn btn-outline btn-sm trash-nav-btn"
              onClick={onOpenTrash}
              title="Open Trash Bin"
            >
              🗑️ Trash ({trashCount})
            </button>
          )}
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

      {/* DPP Header */}
      <div className="dpp-header fade-in">
        <div className="dpp-title-bar">{dppData.title}</div>
        <div className="dpp-meta-bar">
          {dppData.meta?.subject && <span><strong>Subject:</strong> {dppData.meta.subject}</span>}
          {dppData.meta?.topic && <span><strong>Topic:</strong> {dppData.meta.topic}</span>}
          <span><strong>Total Questions:</strong> {total}</span>
          {solvedCount > 0 && <span style={{ color: '#059669' }}>🟢 {solvedCount} Solved</span>}
          {wrongCount > 0 && <span style={{ color: '#dc2626' }}>🔴 {wrongCount} Wrong</span>}
        </div>
      </div>

      {/* Tag & Status Filter Bar */}
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
          {wrongCount > 0 && (
            <button
              type="button"
              className={`tag-filter-chip filter-doubt ${statusFilter === QUESTION_STATUS.WRONG ? 'active-doubt' : ''}`}
              onClick={() => setStatusFilter(statusFilter === QUESTION_STATUS.WRONG ? 'ALL' : QUESTION_STATUS.WRONG)}
            >
              🔴 Wrong ({wrongCount})
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

          {availableTags.map(tag => {
            const count = questions.filter(q => (q.tags && q.tags.includes(tag)) || (q.header && q.header.toLowerCase().includes(tag.toLowerCase()))).length;
            return (
              <button
                key={tag}
                type="button"
                className={`tag-filter-chip ${selectedTag === tag ? 'active' : ''}`}
                onClick={() => { setSelectedTag(selectedTag === tag ? 'ALL' : tag); }}
              >
                {tag} {count > 0 && <span className="tag-chip-count">{count}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Section Management Toolbar */}
      <div className="section-toolbar fade-in">
        <div className="section-toolbar-left">
          <span className="section-toolbar-label">
            📑 <strong>{allSectionTitles.length} Section{allSectionTitles.length !== 1 ? 's' : ''}</strong>
          </span>
          {collapsedSections.size > 0 && (
            <span className="section-collapsed-summary">
              ({collapsedSections.size} minimized)
            </span>
          )}
        </div>
        <div className="section-toolbar-right">
          <button
            type="button"
            className="btn btn-outline btn-sm section-tool-btn"
            onClick={collapsedSections.size === allSectionTitles.length ? handleExpandAll : handleCollapseAll}
            title={collapsedSections.size === allSectionTitles.length ? 'Expand all sections' : 'Minimize all sections'}
          >
            {collapsedSections.size === allSectionTitles.length ? '⊞ Expand All' : '⊟ Minimize All'}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm add-section-btn"
            onClick={() => setIsAddSectionOpen(true)}
            title="Create a new custom section in this chapter"
          >
            ➕ Add Section
          </button>
        </div>
      </div>

      {/* Sections + Questions */}
      {filteredQuestions.length === 0 && questions.length === 0 ? (
        <div className="empty-state-card fade-in" style={{ marginTop: '24px' }}>
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-title">No questions found</div>
          <p className="empty-state-subtitle">
            {showStarredOnly
              ? "You haven't starred any questions yet."
              : statusFilter !== 'ALL'
              ? `No questions found with status "${statusFilter}".`
              : selectedTag !== 'ALL'
              ? `No questions found with tag "${selectedTag}".`
              : "All questions in this DPP have been moved to Trash."}
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px' }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => { setSelectedTag('ALL'); setStatusFilter('ALL'); setShowStarredOnly(false); }}
            >
              Reset Filters
            </button>
            {trashCount > 0 && onOpenTrash && (
              <button className="btn btn-primary btn-sm" onClick={onOpenTrash}>
                Open Trash Bin ({trashCount})
              </button>
            )}
          </div>
        </div>
      ) : (
        allSectionTitles.map((secTitle, si) => {
          const sectionQs = filteredQuestions.filter(q => q.sectionTitle === secTitle);
          const allSectionQs = questions.filter(q => q.sectionTitle === secTitle);
          const isCustom = customSections.includes(secTitle);
          const isCollapsed = collapsedSections.has(secTitle);

          // If a filter is applied and section has 0 matching questions, hide section
          const isFilterActive = selectedTag !== 'ALL' || statusFilter !== 'ALL' || showStarredOnly;
          if (isFilterActive && sectionQs.length === 0) return null;

          // Solved count in this section
          const solvedInSec = sectionQs.filter(q => statuses[q.id] === QUESTION_STATUS.SOLVED).length;

          return (
            <div key={secTitle || si} className="dpp-section-group fade-in">
              {/* Clickable Collapsible Section Header */}
              <div
                className={`section-hdr ${isCollapsed ? 'is-collapsed' : 'is-expanded'} ${isCustom ? 'is-custom-section' : ''}`}
                onClick={() => toggleCollapse(secTitle)}
                title={`Click to ${isCollapsed ? 'maximize' : 'minimize'} this section`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleCollapse(secTitle);
                  }
                }}
              >
                <div className="section-hdr-left">
                  <span className={`section-chevron ${isCollapsed ? 'collapsed' : 'expanded'}`}>
                    {isCollapsed ? '▶' : '▼'}
                  </span>
                  <span className="section-hdr-title">{secTitle}</span>
                  {isCustom && <span className="custom-section-pill">Custom</span>}
                </div>

                <div className="section-hdr-right" onClick={(e) => e.stopPropagation()}>
                  {/* Solved badge */}
                  {solvedInSec > 0 && (
                    <span className="section-solved-chip" title={`${solvedInSec} solved in this section`}>
                      🟢 {solvedInSec}/{sectionQs.length}
                    </span>
                  )}

                  {/* Question Count Chip */}
                  <span className="section-count-chip">
                    {sectionQs.length} {sectionQs.length === 1 ? 'question' : 'questions'}
                  </span>

                  {/* Status Indicator */}
                  {isCollapsed && (
                    <span className="section-minimized-chip">Minimized</span>
                  )}

                  {/* Custom Section Delete Button */}
                  {isCustom && (
                    <button
                      type="button"
                      className="section-delete-btn"
                      onClick={() => handleDeleteCustomSection(secTitle, allSectionQs.length)}
                      title={`Delete "${secTitle}" section`}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>

              {/* Questions Container (display none when collapsed to preserve MathJax and save space) */}
              <div
                className="section-questions-wrapper"
                style={{ display: isCollapsed ? 'none' : 'block' }}
              >
                {sectionQs.length === 0 ? (
                  <div className="section-empty-box">
                    <div className="section-empty-icon">📂</div>
                    <div className="section-empty-title">This section has no questions yet</div>
                    <p className="section-empty-desc">
                      Click the <strong>📑</strong> button on any question card to move it into &ldquo;{secTitle}&rdquo;.
                    </p>
                  </div>
                ) : (
                  sectionQs.map(q => {
                    const globalIdx = questions.indexOf(q);
                    return (
                      <QuestionCard
                        key={q.id}
                        question={q}
                        index={globalIdx}
                        starred={!!starred[q.id]}
                        chapterId={dppData.id}
                        chapterTitle={dppData.title}
                        onSelectOption={handleSelectOption}
                        onStartTimer={startTimer}
                        onPauseTimer={pauseTimer}
                        onResetTimer={resetTimer}
                        onSetDuration={setDuration}
                        onToggleStar={toggleStar}
                        onDeleteQuestion={handleDeleteQuestion}
                        onUpdateQuestion={handleUpdateQuestion}
                        onStatusChange={() => {
                          setStatuses(getQuestionStatuses());
                          setSubqStatuses(getAllSubQuestionStatuses());
                        }}
                        availableSections={allSectionTitles}
                        onMoveSection={handleMoveQuestionSection}
                        onAddSection={handleAddSection}
                      />
                    );
                  })
                )}
              </div>
            </div>
          );
        })
      )}

      {/* Add Section Modal */}
      <AddSectionModal
        isOpen={isAddSectionOpen}
        onClose={() => setIsAddSectionOpen(false)}
        onAddSection={handleAddSection}
        chapterTitle={dppData.title}
        existingSections={allSectionTitles}
      />
    </div>
  );
}
