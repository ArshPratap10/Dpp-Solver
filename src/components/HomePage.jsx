import { useRef } from 'react';

// Pre-defined chapter list — users can add more DPP files anytime
const CHAPTERS = [
  {
    id: 'seq-series',
    icon: '📐',
    title: 'Sequence & Series',
    subject: 'Mathematics',
    file: '/dpps/seq_series_merged.html',
    questionCount: 35,
    tags: ['AP', 'GP', 'HP', 'AGP', 'Telescoping'],
  },
  {
    id: 'basic-math',
    icon: '🧮',
    title: 'Basic Mathematics',
    subject: 'Mathematics',
    file: '/dpps/basic_mathematics.html',
    questionCount: 78,
    tags: ['Surds', 'Logarithms', 'Modulus', 'Polynomials', 'Inequalities'],
  },
];

export default function HomePage({ onLoadDPP, loadedChapters }) {
  const fileRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onLoadDPP(ev.target.result, file.name.replace(/\.html?$/i, ''));
    };
    reader.readAsText(file);
  };

  const handleChapterClick = async (chapter) => {
    try {
      const response = await fetch(chapter.file);
      if (!response.ok) throw new Error('File not found');
      const html = await response.text();
      onLoadDPP(html, chapter.id);
    } catch (err) {
      console.error('Failed to load DPP:', err);
      alert('Could not load the DPP file. Please upload it manually.');
    }
  };

  return (
    <div className="home-container">
      <h1 className="home-title">📝 DPP Solver</h1>
      <p className="home-subtitle">Select a chapter to start timed practice or upload your own DPP</p>

      <div className="chapter-grid">
        {CHAPTERS.map(ch => (
          <div
            key={ch.id}
            className="chapter-card fade-in"
            onClick={() => handleChapterClick(ch)}
          >
            <div className="chapter-card-icon">{ch.icon}</div>
            <div className="chapter-card-title">{ch.title}</div>
            <div className="chapter-card-meta">
              <span>{ch.subject}</span>
              <span>•</span>
              <span>{ch.questionCount} Questions</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '10px' }}>
              {ch.tags.map(t => (
                <span key={t} className="chapter-card-badge">{t}</span>
              ))}
            </div>
          </div>
        ))}

        {/* Loaded custom DPPs */}
        {loadedChapters.map(ch => (
          <div
            key={ch.id}
            className="chapter-card fade-in"
            onClick={() => onLoadDPP(ch.html, ch.id)}
          >
            <div className="chapter-card-icon">📄</div>
            <div className="chapter-card-title">{ch.title}</div>
            <div className="chapter-card-meta">
              <span>{ch.questionCount} Questions</span>
            </div>
          </div>
        ))}

        {/* Upload Card */}
        <div
          className="chapter-card upload-card fade-in"
          onClick={() => fileRef.current?.click()}
        >
          <div className="upload-card-icon">➕</div>
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Upload DPP</div>
          <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>
            Drop or browse .html files
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".html,.htm"
            onChange={handleFileUpload}
          />
        </div>
      </div>
    </div>
  );
}
