import { useState, useEffect, useCallback, useRef } from 'react';
import QuestionCard from './QuestionCard';
import { useTimerEngine, formatTime } from '../hooks/useTimerEngine';

export default function DPPView({ dppData, onBack }) {
  const containerRef = useRef(null);

  // Flatten all questions
  const [questions, setQuestions] = useState(() => {
    const all = [];
    dppData.sections.forEach(sec => all.push(...sec.questions));
    return all;
  });

  // Typeset all math after questions render — simple polling approach
  useEffect(() => {
    const timer = setInterval(() => {
      if (window.MathJax && typeof window.MathJax.typeset === 'function') {
        try {
          window.MathJax.typeset();
        } catch (e) {
          // If typeset fails (e.g. duplicate processing), ignore
        }
        clearInterval(timer);
      }
    }, 300);
    return () => clearInterval(timer);
  }, [dppData]);

  // Build section map
  const sectionMap = [];
  let idx = 0;
  dppData.sections.forEach(sec => {
    sectionMap.push({ title: sec.title, startIdx: idx, count: sec.questions.length });
    idx += sec.questions.length;
  });

  const { startTimer, pauseTimer, resetTimer, setDuration } = useTimerEngine(setQuestions);

  // Session timer
  const [sessionElapsed, setSessionElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const iv = setInterval(() => setSessionElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(iv);
  }, []);

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
      timerRemaining: q.timerDuration,
    })));
  }, []);

  const answered = questions.filter(q => q.selectedOption !== null).length;
  const total = questions.length;

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
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="session-timer">⏱ {formatTime(sessionElapsed)}</span>
          <button className="btn btn-outline btn-sm" onClick={handleResetAll}>↺ Reset All</button>
        </div>
      </div>

      {/* DPP Header */}
      <div className="dpp-header fade-in">
        <div className="dpp-title-bar">{dppData.title}</div>
        <div className="dpp-meta-bar">
          {dppData.meta.subject && <span><strong>Subject:</strong> {dppData.meta.subject}</span>}
          {dppData.meta.topic && <span><strong>Topic:</strong> {dppData.meta.topic}</span>}
          <span><strong>Total Questions:</strong> {total}</span>
        </div>
      </div>

      {/* Sections + Questions */}
      {sectionMap.map((sec, si) => (
        <div key={si}>
          <div className="section-hdr fade-in">{sec.title}</div>
          {questions.slice(sec.startIdx, sec.startIdx + sec.count).map((q, i) => {
            const globalIdx = sec.startIdx + i;
            return (
              <QuestionCard
                key={q.id}
                question={q}
                index={globalIdx}
                onSelectOption={handleSelectOption}
                onStartTimer={startTimer}
                onPauseTimer={pauseTimer}
                onResetTimer={resetTimer}
                onSetDuration={setDuration}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
