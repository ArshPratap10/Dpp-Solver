import { useState, useCallback } from 'react';
import HomePage from './components/HomePage';
import DPPView from './components/DPPView';
import { parseDPPHtml } from './utils/parser';

export default function App() {
  const [activeDPP, setActiveDPP] = useState(null); // parsed DPP data
  const [customDPPs, setCustomDPPs] = useState([]); // user-uploaded DPPs

  const handleLoadDPP = useCallback((htmlString, chapterId) => {
    const parsed = parseDPPHtml(htmlString);

    // Check if already in custom list, if not and it's a new upload, add it
    const isCustom = !['seq-series', 'basic-math'].includes(chapterId);
    if (isCustom) {
      setCustomDPPs(prev => {
        const exists = prev.find(c => c.id === chapterId);
        if (exists) return prev;
        return [...prev, {
          id: chapterId,
          title: parsed.title,
          html: htmlString,
          questionCount: parsed.totalQuestions,
        }];
      });
    }

    setActiveDPP(parsed);
  }, []);

  const handleBack = useCallback(() => {
    setActiveDPP(null);
  }, []);

  if (activeDPP) {
    return <DPPView dppData={activeDPP} onBack={handleBack} />;
  }

  return <HomePage onLoadDPP={handleLoadDPP} loadedChapters={customDPPs} />;
}
