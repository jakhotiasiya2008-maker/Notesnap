import { getAllSheets, deleteSheet, saveSheet, renameSheet } from '../storage/db.js';
import { showToast } from './toast.js';

export class HistoryController {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.options = options; // { onOpenSheet: (sheet) => void }
    this.sheets = [];
  }

  async loadAndRender() {
    try {
      this.sheets = await getAllSheets();
      this.render();
    } catch (e) {
      console.error('Failed to load history:', e);
      this.container.innerHTML = `<div class="error-state">Failed to load history</div>`;
    }
  }

  render() {
    if (!this.container) return;

    if (this.sheets.length === 0) {
      this.container.innerHTML = `
        <div class="empty-history-state">
          <div class="empty-state-icon">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <h3>No Saved Sheets</h3>
          <p>Sheets you generate are automatically preserved offline in IndexedDB so you can study anytime.</p>
        </div>
      `;
      return;
    }

    this.container.innerHTML = `
      <div class="history-list-header">
        <h3 class="history-section-title">Saved Revision Sheets (${this.sheets.length})</h3>
        <p class="history-section-desc">Stored offline on this device.</p>
      </div>
      <div class="history-cards-grid">
        ${this.sheets.map(sheet => this.renderSheetCard(sheet)).join('')}
      </div>
    `;

    this.attachEventListeners();
  }

  renderSheetCard(sheet) {
    const timeStr = formatRelativeTime(sheet.updatedAt || sheet.createdAt);
    const compression = sheet.stats?.compressionRate || 0;
    const sentenceCount = sheet.stats?.sentenceCountSummary || sheet.sentences?.length || 0;

    return `
      <div class="history-card" data-sheet-id="${sheet.id}">
        <div class="history-card-header">
          <div class="history-title-wrap">
            <h4 class="history-sheet-title" title="${escapeHtml(sheet.title)}">${escapeHtml(sheet.title || 'Untitled Sheet')}</h4>
            <span class="history-time-badge">${timeStr}</span>
          </div>
          <div class="history-card-actions">
            <button class="history-btn-icon rename-sheet-btn" data-id="${sheet.id}" title="Rename sheet">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button class="history-btn-icon delete-sheet-btn" data-id="${sheet.id}" title="Delete sheet">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>

        <p class="history-card-snippet">
          ${escapeHtml(sheet.sentences?.[0]?.text || sheet.rawText?.slice(0, 110) || 'No preview available')}...
        </p>

        <div class="history-card-footer">
          <div class="history-stats-pill">
            <span class="badge-accent">${compression}% condensed</span>
            <span class="badge-dim">${sentenceCount} sentences</span>
          </div>
          <button class="btn btn-sm btn-primary open-sheet-btn" data-id="${sheet.id}">
            Open Sheet →
          </button>
        </div>
      </div>
    `;
  }

  attachEventListeners() {
    // Open sheet
    this.container.querySelectorAll('.open-sheet-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const sheet = this.sheets.find(s => s.id === id);
        if (sheet && this.options.onOpenSheet) {
          this.options.onOpenSheet(sheet);
        }
      });
    });

    // Rename sheet
    this.container.querySelectorAll('.rename-sheet-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const sheet = this.sheets.find(s => s.id === id);
        if (!sheet) return;

        const newTitle = window.prompt('Rename revision sheet:', sheet.title);
        if (newTitle && newTitle.trim() && newTitle.trim() !== sheet.title) {
          await renameSheet(id, newTitle.trim());
          sheet.title = newTitle.trim();
          this.render();
          showToast('Sheet renamed', { type: 'success' });
        }
      });
    });

    // Delete sheet with undo
    this.container.querySelectorAll('.delete-sheet-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const sheetIndex = this.sheets.findIndex(s => s.id === id);
        if (sheetIndex === -1) return;

        const deletedSheet = this.sheets[sheetIndex];
        // Optimistically remove
        this.sheets.splice(sheetIndex, 1);
        this.render();

        // Perform DB deletion
        await deleteSheet(id);

        showToast(`Deleted "${deletedSheet.title || 'Revision Sheet'}"`, {
          type: 'info',
          duration: 5000,
          action: {
            label: 'Undo',
            onClick: async () => {
              await saveSheet(deletedSheet);
              this.sheets.splice(sheetIndex, 0, deletedSheet);
              this.render();
              showToast('Restored sheet', { type: 'success' });
            }
          }
        });
      });
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Just now';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
