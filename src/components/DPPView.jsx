import { useState, useEffect, useCallback, useRef } from 'react';
import QuestionCard from './QuestionCard';
import { useTimerEngine, formatTime } from '../hooks/useTimerEngine';

// Dynamic keys are used inside the component now

function loadJSON(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
}

export default function DPPView({ dppData, onBack }) {
  const containerRef = useRef(null);
  const starKey = `dpp-starred-${dppData.id}`;
  const selKey = `dpp-selections-${dppData.id}`;

  // Load persisted selections
  const savedSelections = useRef(loadJSON(selKey));

  // Flatten all questions, restoring saved selections
  const [questions, setQuestions] = useState(() => {
    const all = [];
    dppData.sections.forEach(sec => all.push(...sec.questions));
    // Restore saved selected options
    return all.map(q => ({
      ...q,
      selectedOption: savedSelections.current[q.id] || null,
    }));
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
  useEffect(() => { localStorage.setItem(starKey, JSON.stringify(starred)); }, [starred, starKey]);

  const toggleStar = useCallback((id) => {
    setStarred(prev => {
      const next = { ...prev };
      if (next[id]) delete next[id]; else next[id] = true;
      return next;
    });
  }, []);

  // Filter mode
  const [showStarredOnly, setShowStarredOnly] = useState(false);

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
  }, [dppData, showStarredOnly]);

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
      timerRemaining: q.timerDuration,
    })));
  }, []);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
          {dppData.meta.subject && <span><strong>Subject:</strong> {dppData.meta.subject}</span>}
          {dppData.meta.topic && <span><strong>Topic:</strong> {dppData.meta.topic}</span>}
          <span><strong>Total Questions:</strong> {total}</span>
        </div>
      </div>

      {/* Sections + Questions */}
      {sectionMap.map((sec, si) => {
        const sectionQs = questions.slice(sec.startIdx, sec.startIdx + sec.count);
        const visibleQs = showStarredOnly
          ? sectionQs.filter(q => starred[q.id])
          : sectionQs;

        if (visibleQs.length === 0) return null;

        return (
          <div key={si}>
            <div className="section-hdr fade-in">{sec.title}</div>
            {visibleQs.map(q => {
              const globalIdx = questions.indexOf(q);
              return (
                <QuestionCard
                  key={q.id}
                  question={q}
                  index={globalIdx}
                  starred={!!starred[q.id]}
                  onSelectOption={handleSelectOption}
                  onStartTimer={startTimer}
                  onPauseTimer={pauseTimer}
                  onResetTimer={resetTimer}
                  onSetDuration={setDuration}
                  onToggleStar={toggleStar}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
