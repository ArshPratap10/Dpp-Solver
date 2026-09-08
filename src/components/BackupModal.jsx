import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { exportAllData, validateBackup, importAllData } from '../utils/storage';

export default function BackupModal({ isOpen, onClose }) {
  const fileInputRef = useRef(null);
  const [exported, setExported] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importMode, setImportMode] = useState('merge'); // 'merge' | 'overwrite'
  const [importStatus, setImportStatus] = useState(null); // { type: 'success' | 'error', message: string }

  if (!isOpen) return null;

  const handleExport = () => {
    try {
      exportAllData();
      setExported(true);
      setTimeout(() => setExported(false), 3000);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export backup: ' + err.message);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportStatus(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const stats = validateBackup(parsed);
        setImportFile(parsed);
        setImportPreview(stats);
      } catch (err) {
        setImportStatus({ type: 'error', message: err.message || 'Invalid JSON file.' });
        setImportFile(null);
        setImportPreview(null);
      }
    };
    reader.readAsText(file);
  };

  const handleApplyImport = () => {
    if (!importFile) return;

    if (importMode === 'overwrite') {
      const confirmText = 'WARNING: Overwriting will replace your current folders, statuses, and custom tags with the backup file. Proceed?';
      if (!window.confirm(confirmText)) return;
    }

    try {
      importAllData(importFile, importMode);
      setImportStatus({
        type: 'success',
        message: `Successfully restored backup in ${importMode === 'merge' ? 'Merge' : 'Clean Restore'} mode!`,
      });
      setImportFile(null);
      setImportPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setImportStatus({ type: 'error', message: 'Failed to apply backup: ' + err.message });
    }
  };

  const modalContent = (
    <div className="modal-backdrop fade-in" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">💾 Backup & Data Sync</div>
          <button type="button" className="modal-close-btn" onClick={onClose} title="Close">✕</button>
        </div>

        <div className="modal-body">
          {/* Export Section */}
          <div className="backup-section">
            <h3 className="backup-section-title">📤 Export Backup</h3>
            <p className="backup-section-desc">
              Download all your custom folders, chapter-wise questions, custom tags (TAH, KCLS), problem statuses (🟢/🟡/🔴), and trash as a single `.json` file.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleExport}
            >
              {exported ? '✓ Backup Downloaded!' : 'Download Backup File (.json)'}
            </button>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />

          {/* Import Section */}
          <div className="backup-section">
            <h3 className="backup-section-title">📥 Import / Sync Backup</h3>
            <p className="backup-section-desc">
              Restore your questions and folders from an existing DPP Solver JSON backup file.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Select Backup File (.json)
            </button>

            {/* Preview of file to import */}
            {importPreview && (
              <div className="backup-preview-box fade-in">
                <div style={{ fontWeight: 700, marginBottom: '6px' }}>Backup Preview:</div>
                <div className="backup-preview-grid">
                  <div>📁 Folders: <strong>{importPreview.foldersCount}</strong></div>
                  <div>🗑️ Trashed: <strong>{importPreview.trashCount}</strong></div>
                  <div>🏷️ Custom Tags: <strong>{importPreview.customizationsCount}</strong></div>
                  <div>🚦 Statuses: <strong>{importPreview.statusesCount}</strong></div>
                </div>

                <div style={{ marginTop: '12px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    Import Mode:
                  </label>
                  <div style={{ display: 'flex', gap: '14px' }}>
                    <label style={{ fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="importMode"
                        value="merge"
                        checked={importMode === 'merge'}
                        onChange={() => setImportMode('merge')}
                      />
                      Merge with existing data
                    </label>
                    <label style={{ fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="importMode"
                        value="overwrite"
                        checked={importMode === 'overwrite'}
                        onChange={() => setImportMode('overwrite')}
                      />
                      Clean Overwrite
                    </label>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: '12px' }}
                  onClick={handleApplyImport}
                >
                  Apply & Restore Backup
                </button>
              </div>
            )}

            {/* Status Messages */}
            {importStatus && (
              <div className={`backup-status-msg ${importStatus.type} fade-in`}>
                {importStatus.message}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose} style={{ marginLeft: 'auto' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
}
