import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  getTagStyle,
  saveQuestionCustomization,
  resetQuestionCustomization,
} from '../utils/storage';

const STANDARD_PRESETS = [
  'TAH',
  'KCLS',
  'Mindbender',
  'ASRQ',
  'JEE Mains',
  'JEE Advanced',
  'Important',
  'Tricky',
  'Must Revise',
];

export default function EditHeadingModal({ question, isOpen, onClose, onUpdated }) {
  const [header, setHeader] = useState('');
  const [tags, setTags] = useState([]);
  const [customTagInput, setCustomTagInput] = useState('');

  // Sync state whenever modal opens or question changes
  useEffect(() => {
    if (isOpen && question) {
      setHeader(question.header || '');
      setTags(question.tags || []);
      setCustomTagInput('');
    }
  }, [isOpen, question]);

  if (!isOpen || !question) return null;

  const handleTogglePreset = (presetName) => {
    if (tags.includes(presetName)) {
      setTags(tags.filter(t => t !== presetName));
    } else {
      setTags([...tags, presetName]);
    }
  };

  const handleRemoveTag = (tagName) => {
    setTags(tags.filter(t => t !== tagName));
  };

  const handleAddCustomTag = (e) => {
    e?.preventDefault();
    const clean = customTagInput.trim();
    if (!clean) return;
    if (!tags.includes(clean)) {
      setTags([...tags, clean]);
    }
    setCustomTagInput('');
  };

  const handleSave = (e) => {
    e?.preventDefault();
    const cleanHeader = header.trim();
    saveQuestionCustomization(question.id, {
      header: cleanHeader,
      tags,
    });
    if (onUpdated) {
      onUpdated(question.id, {
        header: cleanHeader,
        tags,
      });
    }
    onClose();
  };

  const handleReset = () => {
    if (window.confirm('Reset this question heading and tags to their original defaults?')) {
      resetQuestionCustomization(question.id);
      const originalHeader = question.originalHeader || '';
      const originalTags = question.originalTags || [];
      setHeader(originalHeader);
      setTags(originalTags);
      if (onUpdated) {
        onUpdated(question.id, {
          header: originalHeader,
          tags: originalTags,
        });
      }
      onClose();
    }
  };

  const modalContent = (
    <div className="modal-backdrop fade-in" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">✏️ Custom Name & Heading</div>
          <button type="button" className="modal-close-btn" onClick={onClose} title="Close">✕</button>
        </div>

        <form onSubmit={handleSave} className="modal-form-wrapper">
          <div className="modal-body">
            {/* Custom Question Heading / Name Input */}
            <div className="form-group">
              <label className="form-label">
                Custom Question Name / Heading
              </label>
              <input
                type="text"
                className="form-input"
                value={header}
                onChange={(e) => setHeader(e.target.value)}
                placeholder="e.g. TAH 01, KCLS Mindbender, Homework Q3..."
                autoFocus
              />
              <span className="form-help">
                Set a custom name or label for this question (press Enter to save).
              </span>
            </div>

            {/* Quick Preset Tags */}
            <div className="form-group">
              <label className="form-label">
                Popular Heading / Difficulty Tags (Click to toggle)
              </label>
              <div className="preset-tags-grid">
                {STANDARD_PRESETS.map((preset) => {
                  const isActive = tags.includes(preset);
                  const style = getTagStyle(preset);
                  return (
                    <button
                      key={preset}
                      type="button"
                      className={`preset-tag-chip ${isActive ? 'active' : ''}`}
                      onClick={() => handleTogglePreset(preset)}
                      style={isActive ? { backgroundColor: style.background, borderColor: style.borderColor, color: style.color } : {}}
                    >
                      {isActive ? '✓ ' : '+ '}
                      {preset}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Tags */}
            <div className="form-group">
              <label className="form-label">Active Tags on this Question</label>
              {tags.length === 0 ? (
                <div className="empty-tags-hint">No tags assigned yet. Click any preset above or add your own custom tag below.</div>
              ) : (
                <div className="active-tags-row">
                  {tags.map((t) => {
                    const style = getTagStyle(t);
                    return (
                      <span
                        key={t}
                        className="active-tag-pill"
                        style={{ backgroundColor: style.background, color: style.color, borderColor: style.borderColor }}
                      >
                        {t}
                        <button
                          type="button"
                          className="remove-tag-btn"
                          onClick={() => handleRemoveTag(t)}
                          title="Remove tag"
                        >
                          ✕
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add Custom Tag */}
            <div className="form-group">
              <label className="form-label">Add Your Own Custom Tag / Badge</label>
              <div className="custom-tag-form">
                <input
                  type="text"
                  className="form-input"
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomTag();
                    }
                  }}
                  placeholder="Type custom tag (e.g. Tricky, Must Revise)..."
                />
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleAddCustomTag}
                  disabled={!customTagInput.trim()}
                >
                  + Add Tag
                </button>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleReset}
              title="Reset to original DPP labels"
            >
              ↺ Reset to Default
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm save-changes-btn">
                💾 Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
}
