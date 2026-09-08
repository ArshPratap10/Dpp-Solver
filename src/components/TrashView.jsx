import { useState, useEffect, useRef } from 'react';
import QuestionCard from './QuestionCard';
import {
  getTrashList,
  restoreFromTrash,
  restoreAllTrash,
  deletePermanently,
  emptyTrash,
} from '../utils/storage';

export default function TrashView({ onBack }) {
  const containerRef = useRef(null);
  const [trashList, setTrashList] = useState(() => getTrashList());
  const [searchTerm, setSearchTerm] = useState('');

  const refreshList = () => {
    setTrashList(getTrashList());
  };

  useEffect(() => {
    window.addEventListener('dpp_storage_updated', refreshList);
    return () => window.removeEventListener('dpp_storage_updated', refreshList);
  }, []);

  // Typeset MathJax
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
  }, [trashList]);

  const handleRestore = (questionId) => {
    restoreFromTrash(questionId);
    refreshList();
  };

  const handleDeletePermanent = (questionId) => {
    if (window.confirm('Are you sure you want to permanently delete this question? This cannot be undone.')) {
      deletePermanently(questionId);
      refreshList();
    }
  };

  const handleRestoreAll = () => {
    if (trashList.length === 0) return;
    if (window.confirm(`Restore all ${trashList.length} question(s) back to their chapters?`)) {
      restoreAllTrash();
      refreshList();
    }
  };

  const handleEmptyTrash = () => {
    if (trashList.length === 0) return;
    if (window.confirm(`Permanently delete all ${trashList.length} question(s) in the trash? This cannot be undone.`)) {
      emptyTrash();
      refreshList();
    }
  };

  const filteredTrash = trashList.filter(item => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const matchChap = item.chapterTitle?.toLowerCase().includes(term);
    const matchHeader = item.question?.header?.toLowerCase().includes(term);
    const matchBody = item.question?.questionHtml?.toLowerCase().includes(term);
    const matchTag = item.question?.tags?.some(t => t.toLowerCase().includes(term));
    return matchChap || matchHeader || matchBody || matchTag;
  });

  return (
    <div className="dpp-container" ref={containerRef}>
      {/* Sticky Top Bar */}
      <div className="top-bar">
        <div className="top-bar-left">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <div className="top-bar-stats">
            <span style={{ fontWeight: 700, color: '#dc2626' }}>
              🗑️ Trash ({trashList.length})
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {trashList.length > 0 && (
            <>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleRestoreAll}
              >
                ↺ Restore All
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm danger-text"
                onClick={handleEmptyTrash}
              >
                Empty Trash
              </button>
            </>
          )}
        </div>
      </div>

      {/* Trash Header Card */}
      <div className="trash-header-card fade-in">
        <div className="trash-header-title">🗑️ Question Trash Bin</div>
        <p className="trash-header-desc">
          Questions you delete from chapters and folders are moved here. You can inspect, restore them back to their chapters, or permanently delete them.
        </p>

        {trashList.length > 0 && (
          <div className="trash-search-row">
            <input
              type="text"
              className="form-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search deleted questions by chapter, tag (TAH, KCLS), or keyword..."
            />
          </div>
        )}
      </div>

      {/* Trash Questions List */}
      {trashList.length === 0 ? (
        <div className="empty-state-card fade-in">
          <div className="empty-state-icon">🎉</div>
          <div className="empty-state-title">Trash is empty</div>
          <p className="empty-state-subtitle">
            No deleted questions. When you delete a question from any DPP or custom folder, it will appear here safely.
          </p>
          <button className="btn btn-primary" onClick={onBack} style={{ marginTop: '16px' }}>
            ← Back to Home
          </button>
        </div>
      ) : filteredTrash.length === 0 ? (
        <div className="empty-state-card fade-in">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-title">No matching questions in trash</div>
          <button className="btn btn-outline btn-sm" onClick={() => setSearchTerm('')} style={{ marginTop: '12px' }}>
            Clear Search
          </button>
        </div>
      ) : (
        <div className="trash-list">
          {filteredTrash.map((item, idx) => {
            const timeAgo = item.trashedAt
              ? new Date(item.trashedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date(item.trashedAt).toLocaleDateString()
              : '';

            return (
              <div key={item.questionId} className="trash-item-wrapper fade-in">
                <div className="trash-item-meta">
                  <span className="trash-source-badge">📚 {item.chapterTitle || 'DPP'}</span>
                  {timeAgo && <span className="trash-timestamp">Deleted {timeAgo}</span>}
                </div>

                <QuestionCard
                  question={item.question}
                  index={idx}
                  chapterId={item.chapterId}
                  chapterTitle={item.chapterTitle}
                  isTrashMode={true}
                  onRestoreQuestion={handleRestore}
                  onDeletePermanent={handleDeletePermanent}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
