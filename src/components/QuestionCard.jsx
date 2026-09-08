import { memo, useRef, useState, useEffect } from 'react';
import { formatTime } from '../hooks/useTimerEngine';
import {
  getTagStyle,
  getFoldersForQuestion,
  getQuestionStatus,
  cycleQuestionStatus,
  QUESTION_STATUS,
} from '../utils/storage';
import EditHeadingModal from './EditHeadingModal';
import AddToFolderModal from './AddToFolderModal';

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
}) {
  const cardRef = useRef(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isFolderOpen, setIsFolderOpen] = useState(false);
  const [folderCount, setFolderCount] = useState(0);
  const [status, setStatus] = useState(() => getQuestionStatus(question.id));

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
    }
  }, [question?.id, isFolderOpen, isTrashMode]);

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
  if (status === QUESTION_STATUS.SOLVED) cardCls += ' card-status-solved';
  if (status === QUESTION_STATUS.REVISE) cardCls += ' card-status-revise';
  if (status === QUESTION_STATUS.DOUBT) cardCls += ' card-status-doubt';

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
              {/* Question Preparation Status Workflow Button */}
              <button
                type="button"
                className={`status-pill-btn card-action-btn ${status ? `status-${status.toLowerCase()}` : 'status-none'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  const next = cycleQuestionStatus(question.id);
                  setStatus(next);
                  onStatusChange?.(question.id, next);
                }}
                title="Click to cycle status: Solved (🟢) → Needs Revision (🟡) → Doubt (🔴)"
              >
                {status === QUESTION_STATUS.SOLVED && '🟢 Solved'}
                {status === QUESTION_STATUS.REVISE && '🟡 Revise'}
                {status === QUESTION_STATUS.DOUBT && '🔴 Doubt'}
                {!status && '⚪ Status'}
              </button>

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
        <MathContent html={question.questionHtml} />
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
    </div>
  );
}
