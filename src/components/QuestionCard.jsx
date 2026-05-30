import { memo, useRef } from 'react';
import { formatTime } from '../hooks/useTimerEngine';

const PRESETS = [
  { label: '3m', sec: 180 },
  { label: '5m', sec: 300 },
];

// Memoized so timer re-renders don't wipe MathJax output
const MathContent = memo(({ html }) => (
  <span dangerouslySetInnerHTML={{ __html: html }} />
));

export default function QuestionCard({
  question, index,
  onSelectOption, onStartTimer, onPauseTimer, onResetTimer, onSetDuration,
}) {
  const cardRef = useRef(null);

  const { timerState, timerRemaining, timerDuration, selectedOption, options } = question;
  const isRunning = timerState === 'running';
  const isPaused = timerState === 'paused';
  const isExpired = timerState === 'expired';
  const isIdle = timerState === 'idle';
  const isWarning = isRunning && timerRemaining <= 30;
  const isDanger = isRunning && timerRemaining <= 10;

  // Card click → start timer if idle
  const handleCardClick = (e) => {
    // Don't start if clicking on options/buttons
    if (e.target.closest('.opt-item') || e.target.closest('.preset-btn') || e.target.closest('.timer-ctrl')) return;
    if (isIdle) {
      onStartTimer(question.id);
    }
  };

  // Card class
  let cardCls = 'q-card';
  if (options.length === 0) cardCls += ' no-opts';
  if (isRunning && !isWarning) cardCls += ' active-timer';
  if (isWarning) cardCls += ' warning-timer';
  if (isExpired) cardCls += ' expired-timer';
  if (selectedOption && !isRunning && !isExpired) cardCls += ' answered-card';

  // Timer pill class
  let pillCls = 'timer-pill';
  if (isIdle) pillCls += ' idle';
  if (isWarning && !isDanger) pillCls += ' warning';
  if (isDanger || isExpired) pillCls += ' danger';

  return (
    <div
      className={cardCls}
      onClick={handleCardClick}
      style={{ animationDelay: `${Math.min(index * 0.03, 0.4)}s` }}
      ref={cardRef}
    >
      {/* Header Row */}
      <div className="q-header-row">
        <span className="q-num">Q{index + 1}</span>
        <span className="q-source">{question.header}</span>

        {/* Timer Pill & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {/* Presets (only when idle) */}
          {isIdle && (
            <div className="timer-presets">
              {PRESETS.map(p => (
                <button
                  key={p.sec}
                  className={`preset-btn ${timerDuration === p.sec ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); onSetDuration(question.id, p.sec); }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* Timer display */}
          <span className={pillCls}>
            {isExpired ? "⏰ Time's Up!" : isIdle ? `⏱ ${formatTime(timerDuration)}` : formatTime(timerRemaining)}
          </span>

          {/* Pause / Reset controls */}
          {isRunning && (
            <button className="timer-ctrl" onClick={(e) => { e.stopPropagation(); onPauseTimer(question.id); }} title="Pause">
              ⏸
            </button>
          )}
          {isPaused && (
            <button className="timer-ctrl" onClick={(e) => { e.stopPropagation(); onStartTimer(question.id); }} title="Resume">
              ▶
            </button>
          )}
          {(isExpired || isPaused) && (
            <button className="timer-ctrl" onClick={(e) => { e.stopPropagation(); onResetTimer(question.id); }} title="Reset">
              ↺
            </button>
          )}
        </div>
      </div>

      {/* Question Body */}
      <div className="q-body">
        <MathContent html={question.questionHtml} />
      </div>

      {/* Options Row */}
      {options.length > 0 && (
        <ul className="opts-row">
          {options.map(opt => (
            <li
              key={opt.label}
              className={`opt-item ${selectedOption === opt.label ? 'selected' : ''}`}
              onClick={(e) => { e.stopPropagation(); onSelectOption(question.id, opt.label); }}
            >
              <span className="opt-label">({opt.label})</span>
              <MathContent html={opt.html} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
