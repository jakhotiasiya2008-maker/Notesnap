import { registerSW } from 'virtual:pwa-register';
import { CanvasBackground } from './animations/canvasBackground.js';
import {
  animateHeroIntro,
  initMagneticButtons,
  init3DTilt,
  playSnapMoment,
  animateStatCounters
} from './animations/motion.js';
import {
  initSoundSettings,
  setSoundEnabled,
  isSoundEnabled,
  playClick
} from './animations/sounds.js';
import { runSummarizerWorker } from './core/workerClient.js';
import { SAMPLE_NOTES } from './core/sampleNotes.js';
import { saveSheet, getSetting, setSetting } from './storage/db.js';
import { QuizController } from './ui/quizView.js';
import { HistoryController } from './ui/historyView.js';
import { showToast } from './ui/toast.js';
import { exportText, exportMarkdown, copyToClipboard, printSheet } from './ui/export.js';

// Application State
const state = {
  currentView: 'snap', // 'snap' | 'sheet' | 'quiz' | 'history'
  summaryMode: 'medium',
  activeSheet: null,
  isSummarizing: false,
  deferredInstallPrompt: null,
  canvasBg: null
};

// Controllers
let quizController = null;
let historyController = null;

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  initBackgroundCanvas();
  await initThemeAndSound();
  initPWA();
  initNavigation();
  initNotesInput();
  initControllers();
  checkShareTarget();
  animateHeroIntro();
  initMagneticButtons();
  init3DTilt();
});

// ==========================================================================
// Ambient Canvas Background
// ==========================================================================
function initBackgroundCanvas() {
  const canvasEl = document.getElementById('ambientCanvas');
  if (canvasEl) {
    state.canvasBg = new CanvasBackground(canvasEl);
  }
}

// ==========================================================================
// Theme & Sound Effects Management
// ==========================================================================
async function initThemeAndSound() {
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const sunIcon = themeToggleBtn.querySelector('.theme-icon-sun');
  const moonIcon = themeToggleBtn.querySelector('.theme-icon-moon');

  // Check saved theme or system preference
  const savedTheme = await getSetting('theme', null);
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');

  applyTheme(initialTheme);

  themeToggleBtn.addEventListener('click', async () => {
    playClick();
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    await setSetting('theme', newTheme);
  });

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      sunIcon.style.display = 'none';
      moonIcon.style.display = 'block';
    } else {
      sunIcon.style.display = 'block';
      moonIcon.style.display = 'none';
    }
    if (state.canvasBg) {
      state.canvasBg.setTheme(theme === 'dark');
    }
  }

  // Sound Settings
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundOnIcon = soundToggleBtn.querySelector('.sound-icon-on');
  const soundOffIcon = soundToggleBtn.querySelector('.sound-icon-off');

  const savedSound = await getSetting('sound_enabled', false);
  initSoundSettings(savedSound);
  updateSoundUI(savedSound);

  soundToggleBtn.addEventListener('click', async () => {
    const newState = !isSoundEnabled();
    setSoundEnabled(newState);
    if (newState) playClick();
    updateSoundUI(newState);
    await setSetting('sound_enabled', newState);
    showToast(newState ? 'Sound effects enabled' : 'Sound effects muted', { type: 'info', duration: 1800 });
  });

  function updateSoundUI(enabled) {
    soundOnIcon.style.display = enabled ? 'block' : 'none';
    soundOffIcon.style.display = enabled ? 'none' : 'block';
    soundToggleBtn.classList.toggle('active', enabled);
  }
}

// ==========================================================================
// PWA Setup & Service Worker
// ==========================================================================
function initPWA() {
  // Service Worker Registration with update prompt
  if ('serviceWorker' in navigator) {
    const updateSW = registerSW({
      onNeedRefresh() {
        showToast('New version of NoteSnap ready!', {
          type: 'info',
          duration: 10000,
          action: {
            label: 'Refresh',
            onClick: () => updateSW(true)
          }
        });
      },
      onOfflineReady() {
        showToast('NoteSnap is ready for offline study!', { type: 'success' });
      }
    });
  }

  // Install Prompt handling
  const installBtn = document.getElementById('installAppBtn');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredInstallPrompt = e;
    installBtn.classList.add('visible');
  });

  installBtn.addEventListener('click', async () => {
    playClick();
    if (!state.deferredInstallPrompt) return;
    state.deferredInstallPrompt.prompt();
    const { outcome } = await state.deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      showToast('Thank you for installing NoteSnap!', { type: 'success' });
    }
    state.deferredInstallPrompt = null;
    installBtn.classList.remove('visible');
  });

  window.addEventListener('appinstalled', () => {
    installBtn.classList.remove('visible');
    state.deferredInstallPrompt = null;
  });
}

// ==========================================================================
// Web Share Target Handler
// ==========================================================================
function checkShareTarget() {
  const urlParams = new URLSearchParams(window.location.search);
  const sharedTitle = urlParams.get('title');
  const sharedText = urlParams.get('text');
  const sharedUrl = urlParams.get('url');

  if (sharedText || sharedTitle || sharedUrl) {
    const titleInput = document.getElementById('sheetTitleInput');
    const textarea = document.getElementById('notesTextarea');

    if (sharedTitle && titleInput) titleInput.value = sharedTitle;
    let fullText = sharedText || '';
    if (sharedUrl) fullText += (fullText ? '\n\n' : '') + sharedUrl;
    if (fullText && textarea) {
      textarea.value = fullText;
      updateTextMetrics();
      showToast('Shared notes loaded!', { type: 'success' });
    }

    // Clean up query parameters from browser bar
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

// ==========================================================================
// Navigation & View Routing
// ==========================================================================
function initNavigation() {
  const desktopButtons = document.querySelectorAll('.desktop-nav .nav-tab-btn');
  const mobileButtons = document.querySelectorAll('.mobile-bottom-nav .mobile-nav-item');
  const logoBtn = document.getElementById('brandLogoBtn');

  const navItems = [...desktopButtons, ...mobileButtons];

  navItems.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      playClick();
      const target = btn.dataset.target;
      switchView(target);
    });
  });

  if (logoBtn) {
    logoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      playClick();
      switchView('snap');
    });
  }

  // Handle hash changes
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#tab-', '');
    if (['snap', 'sheet', 'quiz', 'history'].includes(hash)) {
      switchView(hash);
    }
  });

  // Check initial hash
  if (window.location.hash) {
    const initialHash = window.location.hash.replace('#tab-', '');
    if (['snap', 'sheet', 'quiz', 'history'].includes(initialHash)) {
      switchView(initialHash);
    }
  }
}

export function switchView(targetView) {
  if (state.currentView === targetView) return;

  const performSwitch = () => {
    state.currentView = targetView;
    window.location.hash = `tab-${targetView}`;

    // Update Section Visibility
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.remove('active');
    });
    const targetSection = document.getElementById(`view-${targetView}`);
    if (targetSection) targetSection.classList.add('active');

    // Update Nav Buttons
    document.querySelectorAll('.nav-tab-btn, .mobile-nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.target === targetView);
    });

    // View specific hooks
    if (targetView === 'history' && historyController) {
      historyController.loadAndRender();
    }
    if (targetView === 'sheet') {
      animateStatCounters();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Use View Transitions API if supported
  if ('startViewTransition' in document) {
    document.startViewTransition(performSwitch);
  } else {
    performSwitch();
  }
}

// ==========================================================================
// Controllers Setup
// ==========================================================================
function initControllers() {
  const quizMount = document.getElementById('quizAppMount');
  if (quizMount) {
    quizController = new QuizController(quizMount, {
      onBackToSheet: () => switchView('sheet')
    });
  }

  const historyMount = document.getElementById('historyAppMount');
  if (historyMount) {
    historyController = new HistoryController(historyMount, {
      onOpenSheet: (sheet) => {
        state.activeSheet = sheet;
        renderRevisionSheet(sheet);
        if (quizController && sheet.quizItems) {
          quizController.setQuizItems(sheet.quizItems, sheet.id);
        }
        switchView('sheet');
        showToast(`Loaded "${sheet.title || 'Revision Sheet'}"`, { type: 'success' });
      }
    });
  }
}

// ==========================================================================
// Notes Input & Summarization Logic
// ==========================================================================
function initNotesInput() {
  const textarea = document.getElementById('notesTextarea');
  const titleInput = document.getElementById('sheetTitleInput');
  const generateBtn = document.getElementById('generateBtn');
  const clearBtn = document.getElementById('clearNotesBtn');
  const importBtn = document.getElementById('importFileBtn');
  const filePicker = document.getElementById('filePickerInput');
  const sampleBtn = document.getElementById('sampleNotesBtn');
  const sampleMenu = document.getElementById('sampleNotesMenu');
  const dropzoneArea = document.getElementById('dropzoneArea');
  const dropzoneOverlay = document.getElementById('dropzoneOverlay');
  const lengthButtons = document.querySelectorAll('.length-option-btn');

  // Populate Sample Notes Menu
  if (sampleMenu) {
    sampleMenu.innerHTML = SAMPLE_NOTES.map(s => `
      <button class="sample-menu-item" type="button" data-id="${s.id}">
        <span class="sample-item-category">${escapeHtml(s.category)}</span>
        <span class="sample-item-title">${escapeHtml(s.title)}</span>
      </button>
    `).join('');

    sampleMenu.querySelectorAll('.sample-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        playClick();
        const id = item.dataset.id;
        const note = SAMPLE_NOTES.find(n => n.id === id);
        if (note) {
          titleInput.value = note.title;
          textarea.value = note.content;
          updateTextMetrics();
          sampleMenu.classList.remove('open');
          showToast(`Sample notes loaded: ${note.title}`, { type: 'info' });
        }
      });
    });

    sampleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      playClick();
      sampleMenu.classList.toggle('open');
    });

    document.addEventListener('click', () => {
      sampleMenu.classList.remove('open');
    });
  }

  // Textarea metrics update
  textarea.addEventListener('input', updateTextMetrics);

  // Summary Length selector
  lengthButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      playClick();
      lengthButtons.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-checked', 'true');
      state.summaryMode = btn.dataset.length;
    });
  });

  // File Import Button & Picker
  importBtn.addEventListener('click', () => {
    playClick();
    filePicker.click();
  });

  filePicker.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleLoadedFile(file);
    filePicker.value = '';
  });

  // Drag and Drop files
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzoneArea.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzoneOverlay.classList.add('active');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzoneArea.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzoneOverlay.classList.remove('active');
    }, false);
  });

  dropzoneArea.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) handleLoadedFile(file);
  });

  function handleLoadedFile(file) {
    if (!file.name.match(/\.(txt|md|text)$/i)) {
      showToast('Please import a plain text (.txt or .md) file', { type: 'error' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      textarea.value = ev.target.result;
      const cleanFileName = file.name.replace(/\.[^/.]+$/, '');
      if (!titleInput.value) titleInput.value = cleanFileName;
      updateTextMetrics();
      showToast(`Imported ${file.name}`, { type: 'success' });
    };
    reader.readAsText(file);
  }

  // Clear Button
  clearBtn.addEventListener('click', () => {
    playClick();
    if (textarea.value.trim() && confirm('Clear current notes input?')) {
      textarea.value = '';
      titleInput.value = '';
      updateTextMetrics();
    }
  });

  // Keyboard shortcut: Ctrl+Enter or Cmd+Enter to generate
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if (state.currentView === 'snap' && !state.isSummarizing) {
        e.preventDefault();
        onSnapClicked();
      }
    }
  });

  generateBtn.addEventListener('click', onSnapClicked);

  async function onSnapClicked() {
    const rawText = textarea.value.trim();
    if (!rawText) {
      showToast('Please paste or import some notes first!', { type: 'error' });
      textarea.focus();
      return;
    }

    if (rawText.split(/\s+/).length < 20) {
      showToast('Notes should have at least ~20 words for summarization', { type: 'error' });
      return;
    }

    state.isSummarizing = true;
    generateBtn.setAttribute('disabled', 'true');
    generateBtn.innerHTML = `
      <span class="skeleton-shimmer" style="display:inline-block; width:16px; height:16px; border-radius:50%;"></span>
      <span>Snapping...</span>
    `;

    try {
      // Execute in Web Worker
      const result = await runSummarizerWorker(rawText, state.summaryMode);

      const title = titleInput.value.trim() || detectDefaultTitle(rawText);

      const sheetRecord = {
        id: `sheet_${Date.now()}`,
        title,
        rawText,
        mode: state.summaryMode,
        groups: result.groups,
        sentences: result.sentences,
        keywords: result.keywords,
        quizItems: result.quizItems,
        stats: result.stats,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // Persist to IndexedDB
      await saveSheet(sheetRecord);
      state.activeSheet = sheetRecord;

      // Populate Revision Sheet UI
      renderRevisionSheet(sheetRecord);

      // Provide QuizController with generated Cloze items
      if (quizController) {
        quizController.setQuizItems(result.quizItems, sheetRecord.id);
      }

      // Execute Signature "Snap" choreography
      const inputCard = document.getElementById('inputCard');
      const sheetContainer = document.getElementById('revisionSheetContainer');

      playSnapMoment(inputCard, sheetContainer, () => {
        switchView('sheet');
        showToast('Notes snapped into revision sheet!', { type: 'success' });
      });
    } catch (err) {
      console.error('Extraction error:', err);
      showToast('Failed to summarize notes: ' + err.message, { type: 'error' });
    } finally {
      state.isSummarizing = false;
      generateBtn.removeAttribute('disabled');
      generateBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
        <span>Snap Notes</span>
        <span class="snap-kbd-shortcut">Ctrl+↵</span>
      `;
    }
  }

  // Wire up Revision Sheet buttons
  document.getElementById('exportTxtBtn')?.addEventListener('click', () => {
    playClick();
    if (state.activeSheet) exportText(state.activeSheet);
  });

  document.getElementById('exportMdBtn')?.addEventListener('click', () => {
    playClick();
    if (state.activeSheet) exportMarkdown(state.activeSheet);
  });

  document.getElementById('copyClipboardBtn')?.addEventListener('click', () => {
    playClick();
    if (state.activeSheet) copyToClipboard(state.activeSheet);
  });

  document.getElementById('printSheetBtn')?.addEventListener('click', () => {
    playClick();
    printSheet();
  });

  document.getElementById('startQuizBtn')?.addEventListener('click', () => {
    playClick();
    switchView('quiz');
  });
}

function updateTextMetrics() {
  const textarea = document.getElementById('notesTextarea');
  const charDisplay = document.getElementById('charCountDisplay');
  const wordDisplay = document.getElementById('wordCountDisplay');

  const text = textarea.value;
  const charCount = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  charDisplay.textContent = `${charCount.toLocaleString()} character${charCount === 1 ? '' : 's'}`;
  wordDisplay.textContent = `${words.toLocaleString()} word${words === 1 ? '' : 's'}`;
}

function detectDefaultTitle(text) {
  const firstLine = text.trim().split('\n')[0].replace(/^#{1,6}\s+/, '').trim();
  if (firstLine && firstLine.length < 50) return firstLine;
  return `Revision Sheet (${new Date().toLocaleDateString()})`;
}

// ==========================================================================
// Revision Sheet Renderer
// ==========================================================================
function renderRevisionSheet(sheet) {
  const titleEl = document.getElementById('sheetResultsHeading');
  const metaEl = document.getElementById('sheetSubtitleMeta');
  const sheetContainer = document.getElementById('revisionSheetContainer');
  const chipsCloud = document.getElementById('keyTermsChipsCloud');

  titleEl.textContent = sheet.title || 'Revision Sheet';
  metaEl.textContent = `Extracted ${sheet.sentences?.length || 0} key sentences • ${sheet.stats?.compressionRate || 0}% condensed from original notes.`;

  // Update Stats Strip data targets for animated counters
  const statCompression = document.getElementById('statCompression');
  const statTimeSaved = document.getElementById('statTimeSaved');
  const statSentenceCount = document.getElementById('statSentenceCount');
  const statWordsSaved = document.getElementById('statWordsSaved');

  const timeSavedMins = Math.max(1, Math.round((sheet.stats?.timeSavedSeconds || 60) / 60));
  const wordsTrimmed = Math.max(0, (sheet.stats?.originalWords || 0) - (sheet.stats?.summaryWords || 0));

  statCompression.setAttribute('data-target', sheet.stats?.compressionRate || 0);
  statTimeSaved.setAttribute('data-target', timeSavedMins);
  statSentenceCount.setAttribute('data-target', sheet.stats?.sentenceCountSummary || sheet.sentences?.length || 0);
  statWordsSaved.setAttribute('data-target', wordsTrimmed);

  animateStatCounters();

  // Populate Key Terms Frequency Chips
  if (sheet.keywords && sheet.keywords.length > 0) {
    chipsCloud.innerHTML = sheet.keywords.map(kw => `
      <span class="snap-kw-chip" title="Appears ${kw.freq} times in original text">
        <span>${escapeHtml(kw.term)}</span>
        <span class="chip-freq-badge">${kw.freq}x</span>
      </span>
    `).join('');
  } else {
    chipsCloud.innerHTML = `<span style="font-size: 0.85rem; color: var(--text-muted);">No distinct keywords extracted</span>`;
  }

  // Populate Revision Document Grouped by Detected Headings
  if (sheet.groups && sheet.groups.length > 0) {
    sheetContainer.innerHTML = sheet.groups.map(group => `
      <div class="sheet-section-group">
        <h3 class="sheet-section-heading">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          <span>${escapeHtml(group.heading)}</span>
        </h3>
        <div class="sheet-sentences-list">
          ${group.sentences.map(s => `
            <div class="snap-sentence-item">
              ${s.highlightedHtml || escapeHtml(s.text)}
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  } else if (sheet.sentences && sheet.sentences.length > 0) {
    sheetContainer.innerHTML = `
      <div class="sheet-sentences-list">
        ${sheet.sentences.map(s => `
          <div class="snap-sentence-item">
            ${s.highlightedHtml || escapeHtml(s.text)}
          </div>
        `).join('')}
      </div>
    `;
  } else {
    sheetContainer.innerHTML = `<p style="color: var(--text-muted);">No key sentences selected.</p>`;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
