import { useState, useCallback, useEffect } from 'react';
import HomePage from './components/HomePage';
import DPPView from './components/DPPView';
import FolderView from './components/FolderView';
import TrashView from './components/TrashView';
import { parseDPPHtml } from './utils/parser';
import { getTheme } from './utils/storage';

export default function App() {
  const [activeDPP, setActiveDPP] = useState(null); // parsed DPP data
  const [activeFolder, setActiveFolder] = useState(null); // folder object
  const [showTrash, setShowTrash] = useState(false); // trash view
  const [customDPPs, setCustomDPPs] = useState([]); // user-uploaded DPPs

  useEffect(() => {
    const current = getTheme();
    document.documentElement.setAttribute('data-theme', current);
  }, []);

  const handleLoadDPP = useCallback((htmlString, chapterId) => {
    const parsed = parseDPPHtml(htmlString, chapterId);

    // Check if already in custom list, if not and it's a new upload, add it
    const isCustom = !['seq-series', 'basic-math', 'quadratic-eq', 'seq-series-class', 'circle-combined', 'straight-lines-part1', 'parabola-part1'].includes(chapterId);
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

    setActiveDPP({ ...parsed, id: chapterId });
    setActiveFolder(null);
    setShowTrash(false);
  }, []);

  const handleOpenFolder = useCallback((folder) => {
    setActiveFolder(folder);
    setActiveDPP(null);
    setShowTrash(false);
  }, []);

  const handleOpenTrash = useCallback(() => {
    setShowTrash(true);
    setActiveDPP(null);
    setActiveFolder(null);
  }, []);

  const handleBackToHome = useCallback(() => {
    setActiveDPP(null);
    setActiveFolder(null);
    setShowTrash(false);
  }, []);

  if (showTrash) {
    return <TrashView onBack={handleBackToHome} />;
  }

  if (activeFolder) {
    return (
      <FolderView
        folder={activeFolder}
        onBack={handleBackToHome}
        onFolderDeleted={() => handleBackToHome()}
      />
    );
  }

  if (activeDPP) {
    return (
      <DPPView
        dppData={activeDPP}
        onBack={handleBackToHome}
        onOpenTrash={handleOpenTrash}
      />
    );
  }

  return (
    <HomePage
      onLoadDPP={handleLoadDPP}
      loadedChapters={customDPPs}
      onOpenFolder={handleOpenFolder}
      onOpenTrash={handleOpenTrash}
    />
  );
}
