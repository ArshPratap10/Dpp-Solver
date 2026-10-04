import { memo, useRef, useState, useEffect } from 'react';
import { formatTime } from '../hooks/useTimerEngine';
import {
  getTagStyle,
  getFoldersForQuestion,
  getQuestionStatus,
  cycleQuestionStatus,
  QUESTION_STATUS,
  getSubQuestionStatuses,
  setSubQuestionStatus,
  cycleSubQuestionStatus,
} from '../utils/storage';
import EditHeadingModal from './EditHeadingModal';
import AddToFolderModal from './AddToFolderModal';
import MoveSectionModal from './MoveSectionModal';

const PRESETS = [
  { label: '3m', sec: 180 },
  { label: '5m', sec: 300 },
];

// Memoized so timer re-renders don't wipe MathJax output
const MathContent = memo(({ html }) => (
  <span dangerouslySetInnerHTML={{ __html: html }} />
));

export default function QuestionCard({
  question,
  index,
  starred = false,
  chapterId,
  chapterTitle,
  onSelectOption,
  onStartTimer,
  onPauseTimer,
  onResetTimer,
  onSetDuration,
  onToggleStar,
  onDeleteQuestion,
  onUpdateQuestion,
  onRemoveFromFolder,
  onStatusChange,
  isTrashMode = false,
  onRestoreQuestion,
  onDeletePermanent,
  availableSections = [],
  onMoveSection,
  onAddSection,
}) {
  const cardRef = useRef(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isFolderOpen, setIsFolderOpen] = useState(false);
  const [isSectionOpen, setIsSectionOpen] = useState(false);
  const [folderCount, setFolderCount] = useState(0);
  const [status, setStatus] = useState(() => getQuestionStatus(question.id));

  const hasSubQuestions = Array.isArray(question.subQuestions) && question.subQuestions.length > 0;
  const [subqStatuses, setSubqStatuses] = useState(() => hasSubQuestions ? getSubQuestionStatuses(question.id) : {});

  const { timerState = 'idle', timerRemaining = 180, timerDuration = 180, selectedOption = null, options = [] } = question;
  const isRunning = timerState === 'running';
  const isPaused = timerState === 'paused';
  const isExpired = timerState === 'expired';
  const isIdle = timerState === 'idle';
  const isWarning = isRunning && timerRemaining <= 30;
  const isDanger = isRunning && timerRemaining <= 10;

  // Track folder assignments and status
  useEffect(() => {
    if (!isTrashMode && question?.id) {
      const fIds = getFoldersForQuestion(question.id);
      setFolderCount(fIds.length);
      setStatus(getQuestionStatus(question.id));
      if (hasSubQuestions) {
        setSubqStatuses(getSubQuestionStatuses(question.id));
      }
    }
  }, [question?.id, isFolderOpen, isTrashMode, hasSubQuestions]);

  const handleCycleSubStatus = (subIdx) => {
    const next = cycleSubQuestionStatus(question.id, subIdx);
    const updated = { ...subqStatuses };
    if (!next) delete updated[subIdx];
    else updated[subIdx] = next;
    setSubqStatuses(updated);
    onStatusChange?.(question.id);
  };

  const handleSetSubStatus = (subIdx, targetStatus) => {
    const current = subqStatuses[subIdx];
    const next = current === targetStatus ? null : targetStatus;
    setSubQuestionStatus(question.id, subIdx, next);
    const updated = { ...subqStatuses };
    if (!next) delete updated[subIdx];
    else updated[subIdx] = next;
    setSubqStatuses(updated);
    onStatusChange?.(question.id);
  };

  // Card click → start timer if idle (only if not in trash)
  const handleCardClick = (e) => {
    if (isTrashMode) return;
    if (
      e.target.closest('.opt-item') ||
      e.target.closest('.preset-btn') ||
      e.target.closest('.timer-ctrl') ||
      e.target.closest('.star-btn') ||
      e.target.closest('.card-action-btn') ||
      e.target.closest('.tag-badge') ||
      e.target.closest('.status-pill-btn')
    ) {
      return;
    }
    if (isIdle && onStartTimer) {
      onStartTimer(question.id);
    }
  };

  // Card class
  let cardCls = 'q-card fade-in';
  if (options.length === 0) cardCls += ' no-opts';
  if (isRunning && !isWarning) cardCls += ' active-timer';
  if (isWarning) cardCls += ' warning-timer';
  if (isExpired) cardCls += ' expired-timer';
  if (selectedOption && !isRunning && !isExpired) cardCls += ' answered-card';
  if (isTrashMode) cardCls += ' trashed-card';

  // Status classes
  const subqValues = Object.values(subqStatuses);
  const subqSolvedCount = subqValues.filter(v => v === QUESTION_STATUS.SOLVED).length;
  const subqReviseCount = subqValues.filter(v => v === QUESTION_STATUS.REVISE).length;
  const subqWrongCount = subqValues.filter(v => v === QUESTION_STATUS.WRONG || v === 'DOUBT').length;
  const subqTotalMarked = subqValues.length;

  if (hasSubQuestions) {
    if (subqSolvedCount === question.subQuestions.length && question.subQuestions.length > 0) {
      cardCls += ' card-status-solved';
    } else if (subqWrongCount > 0) {
      cardCls += ' card-status-doubt';
    } else if (subqReviseCount > 0) {
      cardCls += ' card-status-revise';
    } else if (subqSolvedCount > 0) {
      cardCls += ' card-status-solved';
    }
  } else {
    if (status === QUESTION_STATUS.SOLVED) cardCls += ' card-status-solved';
    if (status === QUESTION_STATUS.REVISE) cardCls += ' card-status-revise';
    if (status === QUESTION_STATUS.WRONG || status === 'DOUBT') cardCls += ' card-status-doubt';
  }

  // Timer pill class
  let pillCls = 'timer-pill';
  if (isIdle) pillCls += ' idle';
  if (isWarning && !isDanger) pillCls += ' warning';
  if (isDanger || isExpired) pillCls += ' danger';

  const tags = question.tags || [];

  return (
    <div
      className={cardCls}
      onClick={handleCardClick}
      style={{ animationDelay: `${Math.min(index * 0.03, 0.4)}s` }}
      ref={cardRef}
    >
      {/* Top Header Row */}
      <div className="q-header-row">
        <span className="q-num-badge">Q{index + 1}</span>

        {/* Question Header / Source Text */}
        <span className="q-source" title={question.header || 'No label'}>
          {question.header || question.chapterTitle || 'Question'}
        </span>

        {/* Tags Row in Header */}
        <div className="q-tags-container">
          {tags.map((tag) => {
            const style = getTagStyle(tag);
            return (
              <span
                key={tag}
                className="tag-badge"
                style={{
                  backgroundColor: style.background,
                  color: style.color,
                  borderColor: style.borderColor,
                }}
              >
                {tag}
              </span>
            );
          })}
        </div>

        {/* Section Badge */}
        {question.sectionTitle && (
          <span
            className="q-section-badge"
            title={`Section: ${question.sectionTitle}${onMoveSection ? ' • Click to change section' : ''}`}
            onClick={(e) => {
              if (!isTrashMode && onMoveSection) {
                e.stopPropagation();
                setIsSectionOpen(true);
              }
            }}
          >
            📑 {question.sectionTitle}
          </span>
        )}

        {/* Action Controls */}
        <div className="q-actions-group">
          {isTrashMode ? (
            /* Trash Actions */
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm card-action-btn restore-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onRestoreQuestion?.(question.id);
                }}
                title="Restore this question"
              >
                ↺ Restore
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm card-action-btn delete-perm-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeletePermanent?.(question.id);
                }}
                title="Delete permanently"
              >
                🗑️ Delete Permanently
              </button>
            </div>
          ) : (
            /* Active Mode Actions */
            <>
              {/* Question Preparation Status Workflow Button (or Sub-Questions Progress) */}
              {hasSubQuestions ? (
                <div
                  className={`status-pill-btn card-action-btn subq-summary-pill ${
                    subqSolvedCount === question.subQuestions.length && question.subQuestions.length > 0
                      ? 'status-solved'
                      : subqTotalMarked > 0
                      ? 'status-subq-active'
                      : 'status-none'
                  }`}
                  title={`Sub-questions: ${subqSolvedCount}/${question.subQuestions.length} Solved${subqReviseCount ? `, ${subqReviseCount} Revise` : ''}${subqWrongCount ? `, ${subqWrongCount} Wrong` : ''}`}
                >
                  {subqSolvedCount === question.subQuestions.length && question.subQuestions.length > 0 ? (
                    <span>🟢 All Solved ({question.subQuestions.length})</span>
                  ) : subqTotalMarked > 0 ? (
                    <span className="subq-badge-counts">
                      {subqSolvedCount > 0 && <span className="subq-count-chip chip-solved">🟢 {subqSolvedCount}</span>}
                      {subqReviseCount > 0 && <span className="subq-count-chip chip-revise">🟡 {subqReviseCount}</span>}
                      {subqWrongCount > 0 && <span className="subq-count-chip chip-wrong">🔴 {subqWrongCount}</span>}
                      <span className="subq-ratio-text">{subqTotalMarked}/{question.subQuestions.length}</span>
                    </span>
                  ) : (
                    <span>⚪ 0/{question.subQuestions.length} Sub-Q</span>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  className={`status-pill-btn card-action-btn ${status ? `status-${status.toLowerCase()}` : 'status-none'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = cycleQuestionStatus(question.id);
                    setStatus(next);
                    onStatusChange?.(question.id, next);
                  }}
                  title="Click to cycle status: Solved (🟢) → Needs Revision (🟡) → Wrong (🔴) → Clear"
                >
                  {status === QUESTION_STATUS.SOLVED && '🟢 Solved'}
                  {status === QUESTION_STATUS.REVISE && '🟡 Revise'}
                  {(status === QUESTION_STATUS.WRONG || status === 'DOUBT') && '🔴 Wrong'}
                  {!status && '⚪ Status'}
                </button>
              )}

              {/* Star Button */}
              {onToggleStar && (
                <button
                  type="button"
                  className={`star-btn card-action-btn ${starred ? 'starred' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleStar(question.id);
                  }}
                  title={starred ? 'Unstar' : 'Star this question'}
                >
                  {starred ? '★' : '☆'}
                </button>
              )}

              {/* Edit Heading / Tags Button */}
              <button
                type="button"
                className="icon-action-btn card-action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditOpen(true);
                }}
                title="Edit question heading & tags (TAH, KCLS, Mindbender, custom)"
              >
                🏷️
              </button>

              {/* Add to Folder Button */}
              <button
                type="button"
                className={`icon-action-btn card-action-btn ${folderCount > 0 ? 'in-folder' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFolderOpen(true);
                }}
                title={folderCount > 0 ? `In ${folderCount} folder(s) - Click to manage` : 'Add to folder'}
              >
                📁 {folderCount > 0 && <span className="folder-count-badge">{folderCount}</span>}
              </button>

              {/* Move Section Button */}
              {onMoveSection && (
                <button
                  type="button"
                  className="icon-action-btn card-action-btn section-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSectionOpen(true);
                  }}
                  title={`Section: ${question.sectionTitle || 'Default'} — Click to move to another section`}
                >
                  📑
                </button>
              )}

              {/* Remove from folder (only when in Folder View) */}
              {onRemoveFromFolder && (
                <button
                  type="button"
                  className="icon-action-btn card-action-btn remove-folder-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFromFolder(question.id);
                  }}
                  title="Remove from this folder"
                >
                  ✕
                </button>
              )}

              {/* Delete / Move to Trash Button */}
              {onDeleteQuestion && (
                <button
                  type="button"
                  className="icon-action-btn card-action-btn delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteQuestion(question);
                  }}
                  title="Move question to Trash"
                >
                  🗑️
                </button>
              )}

              {/* Timer Pill & Controls */}
              {onStartTimer && (
                <div className="timer-section">
                  {/* Presets (only when idle) */}
                  {isIdle && (
                    <div className="timer-presets">
                      {PRESETS.map((p) => (
                        <button
                          key={p.sec}
                          type="button"
                          className={`preset-btn ${timerDuration === p.sec ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSetDuration?.(question.id, p.sec);
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Timer display */}
                  <span className={pillCls}>
                    {isExpired
                      ? "⏰ Time's Up!"
                      : isIdle
                      ? `⏱ ${formatTime(timerDuration)}`
                      : formatTime(timerRemaining)}
                  </span>

                  {/* Pause / Resume / Reset controls */}
                  {isRunning && (
                    <button
                      type="button"
                      className="timer-ctrl"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPauseTimer?.(question.id);
                      }}
                      title="Pause"
                    >
                      ⏸
                    </button>
                  )}
                  {isPaused && (
                    <button
                      type="button"
                      className="timer-ctrl"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartTimer?.(question.id);
                      }}
                      title="Resume"
                    >
                      ▶
                    </button>
                  )}
                  {(isExpired || isPaused) && (
                    <button
                      type="button"
                      className="timer-ctrl"
                      onClick={(e) => {
                        e.stopPropagation();
                        onResetTimer?.(question.id);
                      }}
                      title="Reset"
                    >
                      ↺
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Chapter Badge (useful in Folder & Trash View) */}
      {(chapterTitle || question.chapterTitle) && (isTrashMode || onRemoveFromFolder) && (
        <div className="q-chapter-chip">
          <span>📚 {chapterTitle || question.chapterTitle}</span>
        </div>
      )}

      {/* Question Body */}
      <div className="q-body">
        {hasSubQuestions ? (
          <div className="q-subq-wrapper">
            {question.introHtml && (
              <div className="q-intro-text">
                <MathContent html={question.introHtml} />
              </div>
            )}
            <div className="subq-list">
              {question.subQuestions.map((subQ) => {
                const subStatus = subqStatuses[subQ.index] || null;
                const isSolved = subStatus === QUESTION_STATUS.SOLVED;
                const isRevise = subStatus === QUESTION_STATUS.REVISE;
                const isWrong = subStatus === QUESTION_STATUS.WRONG || subStatus === 'DOUBT';

                let subCls = 'subq-item fade-in';
                if (isSolved) subCls += ' subq-status-solved';
                else if (isRevise) subCls += ' subq-status-revise';
                else if (isWrong) subCls += ' subq-status-wrong';

                return (
                  <div key={subQ.index} className={subCls}>
                    <span className="subq-label">{subQ.label}</span>
                    <div className="subq-content">
                      <MathContent html={subQ.html} />
                    </div>
                    <div className="subq-status-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className={`status-pill-btn subq-status-btn ${
                          isSolved
                            ? 'status-solved'
                            : isRevise
                            ? 'status-revise'
                            : isWrong
                            ? 'status-doubt'
                            : 'status-none'
                        }`}
                        onClick={() => handleCycleSubStatus(subQ.index)}
                        title="Click to cycle status: Solved (🟢) → Needs Revision (🟡) → Wrong (🔴) → Clear"
                      >
                        {isSolved && '🟢 Solved'}
                        {isRevise && '🟡 Revise'}
                        {isWrong && '🔴 Wrong'}
                        {!subStatus && '⚪ Status'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <MathContent html={question.questionHtml} />
        )}
      </div>

      {/* Options Row */}
      {options.length > 0 && (
        <ul className="opts-row">
          {options.map((opt) => (
            <li
              key={opt.label}
              className={`opt-item ${selectedOption === opt.label ? 'selected' : ''}`}
              onClick={(e) => {
                if (isTrashMode) return;
                e.stopPropagation();
                onSelectOption?.(question.id, opt.label);
              }}
            >
              <span className="opt-label">({opt.label})</span>
              <MathContent html={opt.html} />
            </li>
          ))}
        </ul>
      )}

      {/* Modals */}
      <EditHeadingModal
        question={question}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onUpdated={onUpdateQuestion}
      />

      <AddToFolderModal
        question={question}
        chapterId={chapterId || question.chapterId}
        chapterTitle={chapterTitle || question.chapterTitle}
        isOpen={isFolderOpen}
        onClose={() => {
          setIsFolderOpen(false);
          const fIds = getFoldersForQuestion(question.id);
          setFolderCount(fIds.length);
        }}
      />

      <MoveSectionModal
        question={question}
        chapterId={chapterId || question.chapterId}
        chapterTitle={chapterTitle || question.chapterTitle}
        availableSections={availableSections}
        currentSection={question.sectionTitle}
        isOpen={isSectionOpen}
        onClose={() => setIsSectionOpen(false)}
        onMoveSection={onMoveSection}
        onAddSection={onAddSection}
      />
    </div>
  );
}
