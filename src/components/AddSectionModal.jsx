import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const SUGGESTED_SECTIONS = [
  'Section C: Advanced Practice',
  'Star Problems & Revision',
  'Important Formulas & Key Concepts',
  'Self-Study / Homework',
  'Speed Drill Practice',
  'Doubts & Follow-up',
];

export default function AddSectionModal({
  isOpen,
  onClose,
  onAddSection,
  chapterTitle = 'DPP',
  existingSections = [],
}) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setError('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e?.preventDefault();
    const clean = title.trim();
    if (!clean) {
      setError('Please enter a section name.');
      return;
    }

    const duplicate = existingSections.some(
      s => s.toLowerCase() === clean.toLowerCase()
    );
    if (duplicate) {
      setError(`A section named "${clean}" already exists in this chapter.`);
      return;
    }

    onAddSection(clean);
    onClose();
  };

  const handleSelectPreset = (preset) => {
    setTitle(preset);
    setError('');
    inputRef.current?.focus();
  };

  return createPortal(
    <div className="modal-backdrop fade-in" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">➕ Add New Section</div>
          <button type="button" className="modal-close-btn" onClick={onClose} title="Close">✕</button>
        </div>

        <div className="modal-body">
          <p className="modal-subtitle">
            Create a custom section in <strong>{chapterTitle}</strong> to group and organize questions:
          </p>

          <form onSubmit={handleSubmit} className="modal-form-wrapper">
            <div className="form-group">
              <label className="form-label" htmlFor="section-title-input">
                Section Name:
              </label>
              <input
                id="section-title-input"
                ref={inputRef}
                type="text"
                className={`form-input ${error ? 'input-error' : ''}`}
                placeholder="e.g. Section C: Advanced Problems"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (error) setError('');
                }}
                maxLength={60}
              />
              {error && <div className="form-error-text">⚠️ {error}</div>}
            </div>

            {/* Suggestions Chips */}
            <div className="form-group" style={{ marginTop: '14px' }}>
              <label className="form-label">Suggested Section Names:</label>
              <div className="preset-chips-grid">
                {SUGGESTED_SECTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className={`tag-preset-chip ${title === suggestion ? 'active' : ''}`}
                    onClick={() => handleSelectPreset(suggestion)}
                  >
                    + {suggestion}
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-footer" style={{ marginTop: '20px' }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={!title.trim()}
              >
                Create Section
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
