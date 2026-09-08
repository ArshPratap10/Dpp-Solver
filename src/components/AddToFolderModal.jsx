import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  getFolders,
  createFolder,
  addQuestionToFolder,
  removeQuestionFromFolder,
  getFoldersForQuestion,
} from '../utils/storage';

const EMOJI_CHOICES = ['📁', '🔥', '⚡', '🎯', '📚', '💎', '💡', '🧮', '📐', '⭐'];

export default function AddToFolderModal({ question, chapterId, chapterTitle, isOpen, onClose }) {
  const [folders, setFolders] = useState([]);
  const [selectedFolderIds, setSelectedFolderIds] = useState([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderIcon, setNewFolderIcon] = useState('📁');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (isOpen && question) {
      setFolders(getFolders());
      setSelectedFolderIds(getFoldersForQuestion(question.id));
      setIsCreating(false);
      setNewFolderName('');
    }
  }, [isOpen, question]);

  if (!isOpen || !question) return null;

  const handleToggleFolder = (folderId) => {
    const isCurrentlyIn = selectedFolderIds.includes(folderId);
    if (isCurrentlyIn) {
      removeQuestionFromFolder(folderId, question.id);
      setSelectedFolderIds(prev => prev.filter(id => id !== folderId));
    } else {
      addQuestionToFolder(folderId, question, chapterId, chapterTitle);
      setSelectedFolderIds(prev => [...prev, folderId]);
    }
  };

  const handleCreateAndAdd = (e) => {
    e.preventDefault();
    const clean = newFolderName.trim();
    if (!clean) return;

    const newFolder = createFolder({
      name: clean,
      icon: newFolderIcon,
    });
    addQuestionToFolder(newFolder.id, question, chapterId, chapterTitle);

    setFolders(getFolders());
    setSelectedFolderIds(prev => [...prev, newFolder.id]);
    setNewFolderName('');
    setIsCreating(false);
  };

  const modalContent = (
    <div className="modal-backdrop fade-in" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">📁 Add Question to Folder</div>
          <button type="button" className="modal-close-btn" onClick={onClose} title="Close">✕</button>
        </div>

        <div className="modal-body">
          <p className="modal-intro">
            Organize questions into custom folders. Questions within each folder will automatically be arranged in a <strong>chapter-wise manner</strong>.
          </p>

          <div className="folder-selection-list">
            {folders.length === 0 ? (
              <div className="empty-tags-hint">No folders yet. Create your first folder below!</div>
            ) : (
              folders.map((folder) => {
                const isSelected = selectedFolderIds.includes(folder.id);
                return (
                  <div
                    key={folder.id}
                    className={`folder-select-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleToggleFolder(folder.id)}
                  >
                    <div className="folder-select-left">
                      <span className="folder-select-icon">{folder.icon || '📁'}</span>
                      <div>
                        <div className="folder-select-name">{folder.name}</div>
                        {folder.description && (
                          <div className="folder-select-desc">{folder.description}</div>
                        )}
                      </div>
                    </div>
                    <div className="folder-checkbox">
                      {isSelected ? '✓' : ''}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Create New Folder */}
          {!isCreating ? (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ width: '100%', marginTop: '8px' }}
              onClick={() => setIsCreating(true)}
            >
              + Create New Folder
            </button>
          ) : (
            <form onSubmit={handleCreateAndAdd} className="new-folder-form fade-in">
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                New Folder Details
              </div>
              <div className="emoji-picker-row">
                {EMOJI_CHOICES.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    className={`emoji-btn ${newFolderIcon === emoji ? 'active' : ''}`}
                    onClick={() => setNewFolderIcon(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <input
                  type="text"
                  className="form-input"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder Name (e.g. Tough Problems)"
                  autoFocus
                />
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={!newFolderName.trim()}
                >
                  Create & Add
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setIsCreating(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose} style={{ marginLeft: 'auto' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
}
