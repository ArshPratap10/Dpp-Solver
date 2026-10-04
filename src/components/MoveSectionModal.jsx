import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function MoveSectionModal({
  isOpen,
  onClose,
  question,
  chapterId,
  chapterTitle,
  availableSections = [],
  currentSection = '',
  onMoveSection,
  onAddSection,
}) {
  const [selectedSection, setSelectedSection] = useState(currentSection);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newSectionInput, setNewSectionInput] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && question) {
      setSelectedSection(question.sectionTitle || currentSection || (availableSections[0] || ''));
      setIsCreatingNew(false);
      setNewSectionInput('');
      setError('');
    }
  }, [isOpen, question, currentSection, availableSections]);

  if (!isOpen || !question) return null;

  const originalSection = question.originalSectionTitle || question.sectionTitle || 'Questions';
  const hasMovedFromOriginal = question.sectionTitle && originalSection && question.sectionTitle !== originalSection;

  const handleConfirmMove = () => {
    if (!selectedSection) return;
    if (selectedSection === question.sectionTitle) {
      onClose();
      return;
    }
    onMoveSection(question.id, selectedSection);
    onClose();
  };

  const handleCreateAndMove = (e) => {
    e?.preventDefault();
    const clean = newSectionInput.trim();
    if (!clean) {
      setError('Please enter a section name.');
      return;
    }
    const duplicate = availableSections.some(
      s => s.toLowerCase() === clean.toLowerCase()
    );
    if (duplicate) {
      // Just select the existing one
      setSelectedSection(clean);
      setIsCreatingNew(false);
      setNewSectionInput('');
      setError('');
      return;
    }

    if (onAddSection) {
      onAddSection(clean);
    }
    onMoveSection(question.id, clean);
    onClose();
  };

  const handleResetToOriginal = () => {
    if (originalSection) {
      onMoveSection(question.id, originalSection);
      onClose();
    }
  };

  return createPortal(
    <div className="modal-backdrop fade-in" onClick={onClose}>
      <div className="modal-dialog move-section-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">📑 Move to Section</div>
          <button type="button" className="modal-close-btn" onClick={onClose} title="Close">✕</button>
        </div>

        <div className="modal-body">
          {/* Question Summary Bar */}
          <div className="move-modal-q-meta">
            <span className="move-modal-q-header">
              {question.header || 'Question'}
            </span>
            <div className="move-modal-curr-sec">
              Current Section: <strong>{question.sectionTitle || 'Default'}</strong>
            </div>
          </div>

          <p className="modal-subtitle" style={{ marginTop: '12px', marginBottom: '10px' }}>
            Select the destination section for this question:
          </p>

          {/* Section Selection List */}
          <div className="section-options-list">
            {availableSections.map((secTitle) => {
              const isCurrent = (question.sectionTitle || '') === secTitle;
              const isSelected = selectedSection === secTitle;
              const isOriginal = originalSection === secTitle;

              return (
                <div
                  key={secTitle}
                  className={`section-option-row ${isSelected ? 'selected' : ''} ${isCurrent ? 'is-current' : ''}`}
                  onClick={() => {
                    setSelectedSection(secTitle);
                    setIsCreatingNew(false);
                    setError('');
                  }}
                >
                  <div className="section-option-radio">
                    <span className={`radio-dot ${isSelected ? 'active' : ''}`} />
                  </div>
                  <div className="section-option-info">
                    <span className="section-option-title">{secTitle}</span>
                    <div className="section-option-badges">
                      {isCurrent && <span className="sec-badge current-badge">Current</span>}
                      {isOriginal && !isCurrent && <span className="sec-badge original-badge">Original</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Inline Create New Section */}
          <div className="create-section-inline-box">
            {!isCreatingNew ? (
              <button
                type="button"
                className="btn btn-outline btn-sm full-width-btn"
                onClick={() => {
                  setIsCreatingNew(true);
                  setError('');
                }}
              >
                ➕ Create & Move to New Section
              </button>
            ) : (
              <form onSubmit={handleCreateAndMove} className="inline-create-form">
                <label className="form-label" style={{ fontSize: '12px' }}>
                  New Section Name:
                </label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <input
                    type="text"
                    className={`form-input ${error ? 'input-error' : ''}`}
                    placeholder="e.g. Self-Study / Practice Set 2"
                    value={newSectionInput}
                    onChange={(e) => {
                      setNewSectionInput(e.target.value);
                      if (error) setError('');
                    }}
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={!newSectionInput.trim()}
                  >
                    Create & Move
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      setIsCreatingNew(false);
                      setNewSectionInput('');
                      setError('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
                {error && <div className="form-error-text" style={{ marginTop: '4px' }}>⚠️ {error}</div>}
              </form>
            )}
          </div>

          {/* Reset to Original Section if moved */}
          {hasMovedFromOriginal && (
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <button
                type="button"
                className="btn-link-action"
                onClick={handleResetToOriginal}
              >
                ↺ Reset to original section ({originalSection})
              </button>
            </div>
          )}

          {/* Footer Controls */}
          <div className="modal-footer" style={{ marginTop: '20px' }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleConfirmMove}
              disabled={!selectedSection || selectedSection === question.sectionTitle}
            >
              Move Question
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
