import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { formatTime } from '../hooks/useTimerEngine';
import {
  setQuestionStatus,
  createFolder,
  addQuestionToFolder,
  QUESTION_STATUS,
} from '../utils/storage';

const MathContent = memo(({ html }) => (
  <span dangerouslySetInnerHTML={{ __html: html }} />
));

export default function SprintView({ questions = [], title = 'Sprint Practice', onExit }) {
  const containerRef = useRef(null);

  // Sprint Setup Phase vs Active vs Completed
  const [stage, setStage] = useState('setup'); // 'setup' | 'active' | 'completed'
  const [sprintQuestions, setSprintQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Setup options
  const [qCountChoice, setQCountChoice] = useState(Math.min(questions.length, 10));
  const [durationMinutes, setDurationMinutes] = useState(Math.min(questions.length, 10) * 3); // 3 mins per question
  const [randomizeOrder, setRandomizeOrder] = useState(false);

  // Sprint state: responses: { [qId]: selectedOption }
  const [responses, setResponses] = useState({});
  // Review flags: { [qId]: boolean }
  const [markedForReview, setMarkedForReview] = useState({});
  // Timing
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Review phase question statuses
  const [reviewStatuses, setReviewStatuses] = useState({});
  const [doubtFolderCreated, setDoubtFolderCreated] = useState(false);

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
  }, [stage, currentIndex, sprintQuestions]);

  // Start Sprint
  const handleStartSprint = () => {
    let pool = [...questions];
    if (randomizeOrder) {
      pool.sort(() => Math.random() - 0.5);
    }
    const selected = pool.slice(0, qCountChoice);
    setSprintQuestions(selected);
    setCurrentIndex(0);
    setResponses({});
    setMarkedForReview({});
    setReviewStatuses({});
    setDoubtFolderCreated(false);

    const secs = durationMinutes * 60;
    setTotalDuration(secs);
    setTimeRemaining(secs);
    setElapsedSeconds(0);
    setStage('active');
  };

  // Countdown timer for active sprint
  useEffect(() => {
    if (stage !== 'active') return;
    const iv = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(iv);
          handleSubmitSprint();
          return 0;
        }
        return prev - 1;
      });
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(iv);
  }, [stage]);

  const handleSubmitSprint = useCallback(() => {
    setStage('completed');
  }, []);

  const handleSelectOption = (qId, label) => {
    setResponses(prev => ({
      ...prev,
      [qId]: prev[qId] === label ? null : label,
    }));
  };

  const handleClearResponse = (qId) => {
    setResponses(prev => {
      const next = { ...prev };
      delete next[qId];
      return next;
    });
  };

  const handleToggleMarkReview = (qId) => {
    setMarkedForReview(prev => ({
      ...prev,
      [qId]: !prev[qId],
    }));
  };

  const handleNext = () => {
    if (currentIndex < sprintQuestions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Status assignment in scorecard review
  const handleAssignStatus = (qId, status) => {
    setQuestionStatus(qId, status);
    setReviewStatuses(prev => ({
      ...prev,
      [qId]: status,
    }));
  };

  // Create doubts folder from sprint
  const handleCreateDoubtsFolder = () => {
    const doubtQuestions = sprintQuestions.filter(q => reviewStatuses[q.id] === QUESTION_STATUS.DOUBT);
    if (doubtQuestions.length === 0) return;

    const folderName = `Sprint Doubts (${new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })})`;
    const newFolder = createFolder({
      name: folderName,
      icon: '🔴',
      description: `Questions marked as Doubt from sprint: ${title}`,
    });

    doubtQuestions.forEach(q => {
      addQuestionToFolder(newFolder.id, q, q.chapterId, q.chapterTitle);
    });

    setDoubtFolderCreated(true);
  };

  // Current Question
  const currentQ = sprintQuestions[currentIndex];

  // Calculated Stats
  const answeredCount = Object.values(responses).filter(v => v !== null).length;
  const reviewCount = Object.values(markedForReview).filter(Boolean).length;
  const unattemptedCount = sprintQuestions.length - answeredCount;

  return (
    <div className="sprint-container" ref={containerRef}>
      {/* ── STAGE 1: SETUP SCREEN ── */}
      {stage === 'setup' && (
        <div className="sprint-setup-card fade-in">
          <div className="sprint-setup-icon">🎯</div>
          <h1 className="sprint-setup-title">Mock Test / Sprint Mode</h1>
          <p className="sprint-setup-subtitle">
            Simulate JEE exam pressure with a timed sprint from <strong>{title}</strong>.
          </p>

          <div className="sprint-config-grid">
            <div className="form-group">
              <label className="form-label">Number of Questions (Available: {questions.length})</label>
              <div className="preset-tags-grid">
                {[5, 10, 15, 20, 25, questions.length].filter((v, i, a) => v <= questions.length && a.indexOf(v) === i).map(num => (
                  <button
                    key={num}
                    type="button"
                    className={`preset-tag-chip ${qCountChoice === num ? 'active' : ''}`}
                    onClick={() => {
                      setQCountChoice(num);
                      setDurationMinutes(num * 3);
                    }}
                  >
                    {num === questions.length ? `All (${num})` : `${num} Questions`}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Sprint Duration</label>
              <div className="preset-tags-grid">
                {[15, 30, 45, 60, qCountChoice * 3].filter((v, i, a) => a.indexOf(v) === i).map(mins => (
                  <button
                    key={mins}
                    type="button"
                    className={`preset-tag-chip ${durationMinutes === mins ? 'active' : ''}`}
                    onClick={() => setDurationMinutes(mins)}
                  >
                    ⏱ {mins} Mins {mins === qCountChoice * 3 ? '(Recommended: 3m/Q)' : ''}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}>
                <input
                  type="checkbox"
                  checked={randomizeOrder}
                  onChange={(e) => setRandomizeOrder(e.target.checked)}
                />
                Shuffle / Randomize question sequence
              </label>
            </div>
          </div>

          <div className="sprint-setup-actions">
            <button type="button" className="btn btn-outline" onClick={onExit}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleStartSprint}>
              🚀 Start Sprint ({qCountChoice} Qs • {durationMinutes}m)
            </button>
          </div>
        </div>
      )}

      {/* ── STAGE 2: ACTIVE EXAM SCREEN ── */}
      {stage === 'active' && currentQ && (
        <div className="sprint-active-layout fade-in">
          {/* Top Exam Header */}
          <div className="sprint-exam-header">
            <div className="sprint-exam-title">
              <span>🎯 {title}</span>
              <span className="sprint-q-progress">
                Question {currentIndex + 1} of {sprintQuestions.length}
              </span>
            </div>

            {/* Countdown Timer */}
            <div className={`sprint-timer-pill ${timeRemaining <= 300 ? 'warning' : ''} ${timeRemaining <= 60 ? 'danger' : ''}`}>
              ⏱ Time Left: {formatTime(timeRemaining)}
            </div>

            <button
              type="button"
              className="btn btn-outline btn-sm danger-text"
              onClick={() => {
                if (window.confirm('Are you sure you want to submit your test now?')) {
                  handleSubmitSprint();
                }
              }}
            >
              Submit Sprint
            </button>
          </div>

          <div className="sprint-body-grid">
            {/* Left/Main: Active Question */}
            <div className="sprint-main-panel">
              <div className="sprint-q-card">
                <div className="sprint-q-header">
                  <span className="q-num-badge">Q{currentIndex + 1}</span>
                  <span className="sprint-q-source">{currentQ.header || currentQ.chapterTitle || 'Question'}</span>
                  {currentQ.tags?.map(t => (
                    <span key={t} className="tag-badge" style={{ background: '#4f46e5', color: '#fff' }}>{t}</span>
                  ))}
                  {markedForReview[currentQ.id] && (
                    <span className="sprint-marked-badge">🟣 Marked for Review</span>
                  )}
                </div>

                <div className="q-body" style={{ padding: '16px 0' }}>
                  <MathContent html={currentQ.questionHtml} />
                </div>

                {/* MCQ Options */}
                {currentQ.options?.length > 0 && (
                  <div className="sprint-opts-list">
                    {currentQ.options.map(opt => (
                      <div
                        key={opt.label}
                        className={`sprint-opt-item ${responses[currentQ.id] === opt.label ? 'selected' : ''}`}
                        onClick={() => handleSelectOption(currentQ.id, opt.label)}
                      >
                        <span className="opt-label">({opt.label})</span>
                        <MathContent html={opt.html} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Question Action Bar */}
                <div className="sprint-action-bar">
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => handleClearResponse(currentQ.id)}
                      disabled={!responses[currentQ.id]}
                    >
                      Clear Choice
                    </button>
                    <button
                      type="button"
                      className={`btn btn-outline btn-sm ${markedForReview[currentQ.id] ? 'marked-active' : ''}`}
                      onClick={() => handleToggleMarkReview(currentQ.id)}
                    >
                      {markedForReview[currentQ.id] ? '✓ Marked for Review' : 'Mark for Review'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={handlePrev}
                      disabled={currentIndex === 0}
                    >
                      ← Previous
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleNext}
                      disabled={currentIndex === sprintQuestions.length - 1}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Question Navigation Palette */}
            <div className="sprint-palette-panel">
              <h3 className="palette-title">Question Palette</h3>
              <div className="palette-legend">
                <div className="legend-item"><span className="legend-dot answered"></span> Answered ({answeredCount})</div>
                <div className="legend-item"><span className="legend-dot marked"></span> Review ({reviewCount})</div>
                <div className="legend-item"><span className="legend-dot unanswered"></span> Unanswered ({unattemptedCount})</div>
              </div>

              <div className="palette-grid">
                {sprintQuestions.map((q, idx) => {
                  const isAns = responses[q.id] !== undefined && responses[q.id] !== null;
                  const isMark = markedForReview[q.id];
                  const isCurr = idx === currentIndex;

                  let cls = 'palette-btn';
                  if (isCurr) cls += ' current';
                  if (isAns) cls += ' answered';
                  if (isMark) cls += ' marked';

                  return (
                    <button
                      key={q.id}
                      type="button"
                      className={cls}
                      onClick={() => setCurrentIndex(idx)}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STAGE 3: SCORECARD / RESULT SCREEN ── */}
      {stage === 'completed' && (
        <div className="sprint-scorecard-card fade-in">
          <div className="scorecard-header">
            <div className="scorecard-icon">🏆</div>
            <h1 className="scorecard-title">Sprint Completed!</h1>
            <p className="scorecard-subtitle">
              Practiced {sprintQuestions.length} questions from <strong>{title}</strong>
            </p>
          </div>

          {/* Stats Bar */}
          <div className="scorecard-stats-grid">
            <div className="scorecard-stat-box">
              <div className="scorecard-stat-num" style={{ color: '#059669' }}>{answeredCount}</div>
              <div className="scorecard-stat-label">Attempted</div>
            </div>
            <div className="scorecard-stat-box">
              <div className="scorecard-stat-num" style={{ color: '#8b5cf6' }}>{reviewCount}</div>
              <div className="scorecard-stat-label">Marked Review</div>
            </div>
            <div className="scorecard-stat-box">
              <div className="scorecard-stat-num" style={{ color: '#dc2626' }}>{unattemptedCount}</div>
              <div className="scorecard-stat-label">Unanswered</div>
            </div>
            <div className="scorecard-stat-box">
              <div className="scorecard-stat-num">{formatTime(elapsedSeconds)}</div>
              <div className="scorecard-stat-label">Time Spent</div>
            </div>
          </div>

          {/* Action to create doubts folder */}
          <div className="scorecard-actions-row">
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleCreateDoubtsFolder}
              disabled={doubtFolderCreated || Object.values(reviewStatuses).filter(s => s === QUESTION_STATUS.DOUBT).length === 0}
            >
              {doubtFolderCreated ? '✓ Doubts Folder Created!' : '📁 Save Doubts as New Folder'}
            </button>
            <button type="button" className="btn btn-primary" onClick={onExit}>
              Done & Return
            </button>
          </div>

          {/* Question-by-Question Review with Status Assignment */}
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '32px', marginBottom: '16px' }}>
            Question Review & Status Tracking
          </h2>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Assign preparation statuses (🟢 Solved, 🟡 Revise, 🔴 Doubt) directly from your sprint results:
          </p>

          <div className="scorecard-review-list">
            {sprintQuestions.map((q, idx) => {
              const myAnswer = responses[q.id];
              const curStatus = reviewStatuses[q.id];

              return (
                <div key={q.id} className="scorecard-q-review-item fade-in">
                  <div className="scorecard-q-review-top">
                    <div>
                      <span className="q-num-badge" style={{ marginRight: '8px' }}>Q{idx + 1}</span>
                      <strong style={{ fontSize: '0.92rem' }}>{q.header || q.chapterTitle}</strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>
                        Your Choice: <strong>{myAnswer ? `(${myAnswer})` : 'None'}</strong>
                      </span>

                      {/* Status Tag Selector */}
                      <div className="status-button-group">
                        <button
                          type="button"
                          className={`status-chip ${curStatus === QUESTION_STATUS.SOLVED ? 'active-solved' : ''}`}
                          onClick={() => handleAssignStatus(q.id, QUESTION_STATUS.SOLVED)}
                          title="Mark as Solved"
                        >
                          🟢 Solved
                        </button>
                        <button
                          type="button"
                          className={`status-chip ${curStatus === QUESTION_STATUS.REVISE ? 'active-revise' : ''}`}
                          onClick={() => handleAssignStatus(q.id, QUESTION_STATUS.REVISE)}
                          title="Mark as Needs Revision"
                        >
                          🟡 Revise
                        </button>
                        <button
                          type="button"
                          className={`status-chip ${curStatus === QUESTION_STATUS.DOUBT ? 'active-doubt' : ''}`}
                          onClick={() => handleAssignStatus(q.id, QUESTION_STATUS.DOUBT)}
                          title="Mark as Doubt"
                        >
                          🔴 Doubt
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="q-body" style={{ padding: '10px 0 6px' }}>
                    <MathContent html={q.questionHtml} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
