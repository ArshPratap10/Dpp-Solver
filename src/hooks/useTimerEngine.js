import { useRef, useCallback, useEffect } from 'react';

/**
 * Manages per-question countdown timers with start/pause/reset.
 */
export function useTimerEngine(setQuestions) {
  const intervalsRef = useRef(new Map());
  const startDataRef = useRef(new Map());

  const stopInterval = useCallback((qId) => {
    if (intervalsRef.current.has(qId)) {
      clearInterval(intervalsRef.current.get(qId));
      intervalsRef.current.delete(qId);
      startDataRef.current.delete(qId);
    }
  }, []);

  const startTimer = useCallback((qId, remainingOverride) => {
    stopInterval(qId);

    setQuestions(prev => {
      const q = prev.find(x => x.id === qId);
      if (!q) return prev;

      const remaining = remainingOverride ?? (q.timerState === 'paused' ? q.timerRemaining : q.timerDuration);

      startDataRef.current.set(qId, {
        startedAt: Date.now(),
        initialRemaining: remaining,
      });

      const intervalId = setInterval(() => {
        const data = startDataRef.current.get(qId);
        if (!data) return;
        const elapsed = (Date.now() - data.startedAt) / 1000;
        const left = Math.max(0, data.initialRemaining - elapsed);

        setQuestions(p => p.map(x => {
          if (x.id !== qId) return x;
          if (left <= 0) {
            stopInterval(qId);
            // Beep
            try {
              const ctx = new (window.AudioContext || window.webkitAudioContext)();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain); gain.connect(ctx.destination);
              osc.frequency.value = 800; osc.type = 'sine';
              gain.gain.value = 0.12;
              osc.start();
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
              osc.stop(ctx.currentTime + 0.5);
            } catch (_) {}
            return { ...x, timerRemaining: 0, timerState: 'expired' };
          }
          return { ...x, timerRemaining: left, timerState: 'running' };
        }));
      }, 200);

      intervalsRef.current.set(qId, intervalId);

      return prev.map(x =>
        x.id === qId ? { ...x, timerState: 'running', timerRemaining: remaining } : x
      );
    });
  }, [setQuestions, stopInterval]);

  const pauseTimer = useCallback((qId) => {
    stopInterval(qId);
    setQuestions(prev => prev.map(q =>
      q.id === qId ? { ...q, timerState: 'paused' } : q
    ));
  }, [setQuestions, stopInterval]);

  const resetTimer = useCallback((qId, newDuration) => {
    stopInterval(qId);
    setQuestions(prev => prev.map(q =>
      q.id === qId ? {
        ...q,
        timerState: 'idle',
        timerDuration: newDuration ?? q.timerDuration,
        timerRemaining: newDuration ?? q.timerDuration,
      } : q
    ));
  }, [setQuestions, stopInterval]);

  const setDuration = useCallback((qId, duration) => {
    setQuestions(prev => prev.map(q => {
      if (q.id !== qId) return q;
      if (q.timerState === 'running') return q;
      return { ...q, timerDuration: duration, timerRemaining: duration, timerState: 'idle' };
    }));
  }, [setQuestions]);

  useEffect(() => {
    return () => {
      intervalsRef.current.forEach(id => clearInterval(id));
      intervalsRef.current.clear();
    };
  }, []);

  return { startTimer, pauseTimer, resetTimer, setDuration };
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
