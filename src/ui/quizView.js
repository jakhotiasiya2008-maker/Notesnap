import gsap from 'gsap';
import { flipFlashcard, swipeCardFlyOff, animateCorrectFeedback, animateWrongFeedback, fireQuizCompletionConfetti } from '../animations/motion.js';
import { calculateNextReview, RATING } from '../core/spacedRepetition.js';
import { saveFlashcardState } from '../storage/db.js';
import { showToast } from './toast.js';

export class QuizController {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.options = options;
    this.items = [];
    this.activeQueue = [];
    this.missedItems = [];
    this.currentIndex = 0;
    this.mode = 'flashcards'; // 'flashcards' | 'choice' | 'type'
    this.score = { correct: 0, wrong: 0 };
    this.isAnswered = false;
    this.isFlipped = false;
  }

  setQuizItems(items, sheetId = '') {
    this.sheetId = sheetId;
    this.items = items.map(item => ({
      ...item,
      sheetId,
      userRating: null,
      wasCorrect: null
    }));
    this.reset(this.items);
  }

  reset(queue) {
    this.activeQueue = [...queue];
    this.missedItems = [];
    this.currentIndex = 0;
    this.score = { correct: 0, wrong: 0 };
    this.isAnswered = false;
    this.isFlipped = false;
    this.render();
  }

  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.isAnswered = false;
    this.isFlipped = false;
    this.render();
  }

  render() {
    if (!this.container) return;

    if (!this.activeQueue || this.activeQueue.length === 0) {
      this.renderEmptyState();
      return;
    }

    if (this.currentIndex >= this.activeQueue.length) {
      this.renderCompletionScreen();
      return;
    }

    const currentItem = this.activeQueue[this.currentIndex];
    const total = this.activeQueue.length;
    const progressPercent = Math.round((this.currentIndex / total) * 100);

    this.container.innerHTML = `
      <div class="quiz-wrapper">
        <!-- Quiz Header & Progress -->
        <div class="quiz-header">
          <div class="quiz-mode-pill-group" role="tablist">
            <button class="quiz-mode-pill ${this.mode === 'flashcards' ? 'active' : ''}" data-mode="flashcards" role="tab" aria-selected="${this.mode === 'flashcards'}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
              Flashcards
            </button>
            <button class="quiz-mode-pill ${this.mode === 'choice' ? 'active' : ''}" data-mode="choice" role="tab" aria-selected="${this.mode === 'choice'}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
              Multiple Choice
            </button>
            <button class="quiz-mode-pill ${this.mode === 'type' ? 'active' : ''}" data-mode="type" role="tab" aria-selected="${this.mode === 'type'}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
              Type In
            </button>
          </div>

          <div class="quiz-counter-badge">
            <span class="quiz-counter-num">${this.currentIndex + 1}</span>
            <span class="quiz-counter-total">/ ${total}</span>
          </div>
        </div>

        <div class="quiz-progress-bar-bg" aria-hidden="true">
          <div class="quiz-progress-bar-fill" style="width: ${progressPercent}%;"></div>
        </div>

        <!-- Main Interactive Quiz Area -->
        <div class="quiz-card-stage" id="quizCardStage">
          ${this.renderCardContent(currentItem)}
        </div>

        <!-- Controls / Spaced Repetition Bar -->
        <div class="quiz-bottom-controls" id="quizControls">
          ${this.renderControls(currentItem)}
        </div>
      </div>
    `;

    this.attachEventListeners(currentItem);
  }

  renderCardContent(item) {
    if (this.mode === 'flashcards') {
      return `
        <div class="flashcard-3d-wrapper" id="flashcardElement" role="region" aria-label="Flashcard. Click or tap to flip.">
          <div class="flashcard-inner ${this.isFlipped ? 'is-flipped' : ''}">
            <!-- FRONT -->
            <div class="flashcard-face flashcard-front">
              <div class="flashcard-badge">${item.heading || 'Concept'}</div>
              <p class="flashcard-cloze-text">${escapeHtml(item.prompt)}</p>
              <div class="flashcard-hint-row">
                <span class="flashcard-tap-hint">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
                  Tap card or press Space to flip
                </span>
              </div>
            </div>

            <!-- BACK -->
            <div class="flashcard-face flashcard-back">
              <div class="flashcard-badge highlight-badge">Answer</div>
              <div class="flashcard-answer-word">${escapeHtml(item.targetWord)}</div>
              <p class="flashcard-full-context">${escapeHtml(item.fullSentence)}</p>
              <div class="flashcard-hint-row">
                <span class="flashcard-tap-hint">Swipe left for Hard, right for Easy</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    if (this.mode === 'choice') {
      return `
        <div class="choice-quiz-box">
          <div class="quiz-question-heading">${escapeHtml(item.heading)}</div>
          <p class="quiz-question-prompt">${escapeHtml(item.prompt)}</p>

          <div class="choice-options-grid" id="choiceOptionsGrid">
            ${item.options.map((opt, i) => `
              <button class="choice-option-btn" data-answer="${escapeHtml(opt)}" data-index="${i}">
                <span class="choice-key-letter">${String.fromCharCode(65 + i)}</span>
                <span class="choice-label">${escapeHtml(opt)}</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (this.mode === 'type') {
      return `
        <div class="type-quiz-box">
          <div class="quiz-question-heading">${escapeHtml(item.heading)}</div>
          <p class="quiz-question-prompt">${escapeHtml(item.prompt)}</p>

          <form class="type-answer-form" id="typeAnswerForm">
            <div class="type-input-group">
              <input type="text" class="type-answer-input" id="typeAnswerInput" 
                     placeholder="Type the missing keyword..." autocomplete="off" autocorrect="off" spellcheck="false" autofocus />
              <button type="submit" class="type-submit-btn">Check</button>
            </div>
          </form>

          <div class="type-feedback-reveal" id="typeFeedbackArea" style="display: none;"></div>
        </div>
      `;
    }

    return '';
  }

  renderControls(item) {
    if (this.mode === 'flashcards') {
      return `
        <div class="srs-actions-row">
          <button class="srs-btn srs-again-btn" data-rating="again" title="Review again (1 day)">
            <span class="srs-icon">↺</span>
            <span class="srs-label">Again</span>
            <span class="srs-sub">Next round</span>
          </button>
          <button class="srs-btn srs-hard-btn" data-rating="hard" title="Difficult concept (resurfaces sooner)">
            <span class="srs-icon">⚡</span>
            <span class="srs-label">Hard</span>
            <span class="srs-sub">Shorter interval</span>
          </button>
          <button class="srs-btn srs-easy-btn" data-rating="easy" title="Well known concept (graduates)">
            <span class="srs-icon">✓</span>
            <span class="srs-label">Easy</span>
            <span class="srs-sub">Mastered</span>
          </button>
        </div>
      `;
    }

    // For choice and type-in modes:
    return `
      <div class="quiz-nav-row">
        <button class="btn btn-secondary quiz-skip-btn" id="quizSkipBtn">Skip</button>
        <button class="btn btn-primary quiz-next-btn" id="quizNextBtn" style="display: ${this.isAnswered ? 'inline-flex' : 'none'};">
          Next Question →
        </button>
      </div>
    `;
  }

  attachEventListeners(currentItem) {
    // Mode switcher buttons
    const modeButtons = this.container.querySelectorAll('.quiz-mode-pill');
    modeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.setMode(btn.dataset.mode);
      });
    });

    // 1. Flashcard listeners
    if (this.mode === 'flashcards') {
      const card = this.container.querySelector('#flashcardElement');
      if (card) {
        card.addEventListener('click', (e) => {
          // Flip on card body click
          if (!e.target.closest('.srs-btn')) {
            this.toggleCardFlip(card);
          }
        });

        // Touch swipe gestures
        this.initTouchSwipe(card, currentItem);
      }

      // SRS rating buttons
      const srsButtons = this.container.querySelectorAll('.srs-btn');
      srsButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const rating = btn.dataset.rating;
          this.handleSRSSelection(currentItem, rating);
        });
      });
    }

    // 2. Multiple choice listeners
    if (this.mode === 'choice') {
      const optionButtons = this.container.querySelectorAll('.choice-option-btn');
      optionButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          if (this.isAnswered) return;
          this.handleChoiceAnswer(btn, currentItem);
        });
      });

      const nextBtn = this.container.querySelector('#quizNextBtn');
      if (nextBtn) nextBtn.addEventListener('click', () => this.advance());

      const skipBtn = this.container.querySelector('#quizSkipBtn');
      if (skipBtn) skipBtn.addEventListener('click', () => this.skipQuestion(currentItem));
    }

    // 3. Type-the-answer listeners
    if (this.mode === 'type') {
      const form = this.container.querySelector('#typeAnswerForm');
      const input = this.container.querySelector('#typeAnswerInput');
      if (form && input) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          if (this.isAnswered) {
            this.advance();
            return;
          }
          this.handleTypeAnswer(input.value.trim(), currentItem);
        });
      }

      const nextBtn = this.container.querySelector('#quizNextBtn');
      if (nextBtn) nextBtn.addEventListener('click', () => this.advance());

      const skipBtn = this.container.querySelector('#quizSkipBtn');
      if (skipBtn) skipBtn.addEventListener('click', () => this.skipQuestion(currentItem));
    }
  }

  toggleCardFlip(card) {
    this.isFlipped = !this.isFlipped;
    flipFlashcard(card.querySelector('.flashcard-inner'), this.isFlipped);
  }

  initTouchSwipe(cardElement, item) {
    let startX = 0;
    let startY = 0;
    let currentDeltaX = 0;
    let isDragging = false;

    const onStart = (e) => {
      startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
      startY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
      isDragging = true;
    };

    const onMove = (e) => {
      if (!isDragging) return;
      const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
      const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
      currentDeltaX = clientX - startX;
      const deltaY = clientY - startY;

      if (Math.abs(currentDeltaX) > 10) {
        gsap.to(cardElement, {
          x: currentDeltaX,
          rotation: currentDeltaX * 0.05,
          duration: 0.05
        });
      }
    };

    const onEnd = () => {
      if (!isDragging) return;
      isDragging = false;

      const threshold = 85;
      if (currentDeltaX > threshold) {
        // Swiped right = Easy
        swipeCardFlyOff(cardElement, 'right', () => {
          this.handleSRSSelection(item, RATING.EASY);
        });
      } else if (currentDeltaX < -threshold) {
        // Swiped left = Again / Hard
        swipeCardFlyOff(cardElement, 'left', () => {
          this.handleSRSSelection(item, RATING.AGAIN);
        });
      } else {
        // Snap back
        gsap.to(cardElement, {
          x: 0,
          rotation: 0,
          duration: 0.35,
          ease: 'back.out(1.5)'
        });
      }
      currentDeltaX = 0;
    };

    cardElement.addEventListener('touchstart', onStart, { passive: true });
    cardElement.addEventListener('touchmove', onMove, { passive: true });
    cardElement.addEventListener('touchend', onEnd);
  }

  async handleSRSSelection(item, rating) {
    const updatedReviewState = calculateNextReview(item.reviewState, rating);
    item.reviewState = updatedReviewState;
    item.userRating = rating;

    // Save to IndexedDB
    try {
      await saveFlashcardState({
        id: item.id,
        sheetId: this.sheetId,
        prompt: item.prompt,
        targetWord: item.targetWord,
        fullSentence: item.fullSentence,
        heading: item.heading,
        reviewState: updatedReviewState
      });
    } catch (e) {
      console.warn('Could not persist flashcard SRS:', e);
    }

    if (rating === RATING.AGAIN) {
      this.score.wrong++;
      this.missedItems.push(item);
      // Re-queue card to end of study session
      this.activeQueue.push(item);
      showToast('Re-queued for this session', { type: 'info', duration: 1800 });
    } else {
      this.score.correct++;
    }

    this.advance();
  }

  handleChoiceAnswer(selectedBtn, item) {
    this.isAnswered = true;
    const selectedAnswer = selectedBtn.dataset.answer.toLowerCase();
    const correctAnswer = item.targetWord.toLowerCase();
    const allButtons = this.container.querySelectorAll('.choice-option-btn');

    if (selectedAnswer === correctAnswer) {
      selectedBtn.classList.add('correct');
      animateCorrectFeedback(selectedBtn);
      this.score.correct++;
    } else {
      selectedBtn.classList.add('wrong');
      animateWrongFeedback(selectedBtn);
      this.score.wrong++;
      this.missedItems.push(item);

      // Reveal correct option
      allButtons.forEach(btn => {
        if (btn.dataset.answer.toLowerCase() === correctAnswer) {
          btn.classList.add('reveal-correct');
        }
      });
    }

    // Disable all options
    allButtons.forEach(btn => btn.setAttribute('disabled', 'true'));

    // Reveal next button
    const nextBtn = this.container.querySelector('#quizNextBtn');
    if (nextBtn) {
      nextBtn.style.display = 'inline-flex';
      nextBtn.focus();
    }
  }

  handleTypeAnswer(userText, item) {
    if (!userText) return;
    this.isAnswered = true;

    const cleanInput = userText.trim().toLowerCase();
    const target = item.targetWord.toLowerCase();
    const inputEl = this.container.querySelector('#typeAnswerInput');
    const feedbackArea = this.container.querySelector('#typeFeedbackArea');
    const submitBtn = this.container.querySelector('.type-submit-btn');

    if (inputEl) inputEl.setAttribute('disabled', 'true');
    if (submitBtn) submitBtn.setAttribute('disabled', 'true');

    const isMatch = cleanInput === target || (target.length > 5 && levenshteinDistance(cleanInput, target) <= 1);

    if (feedbackArea) {
      feedbackArea.style.display = 'block';
      if (isMatch) {
        feedbackArea.className = 'type-feedback-reveal feedback-correct';
        feedbackArea.innerHTML = `
          <div class="feedback-badge-row">
            <span class="feedback-status-badge">✓ Correct!</span>
            <span class="feedback-term">${escapeHtml(item.targetWord)}</span>
          </div>
          <p class="feedback-full-sentence">${escapeHtml(item.fullSentence)}</p>
        `;
        animateCorrectFeedback(inputEl);
        this.score.correct++;
      } else {
        feedbackArea.className = 'type-feedback-reveal feedback-wrong';
        feedbackArea.innerHTML = `
          <div class="feedback-badge-row">
            <span class="feedback-status-badge wrong-badge">✕ Not quite</span>
            <span class="feedback-term">Expected: <strong>${escapeHtml(item.targetWord)}</strong></span>
          </div>
          <p class="feedback-full-sentence">${escapeHtml(item.fullSentence)}</p>
        `;
        animateWrongFeedback(inputEl);
        this.score.wrong++;
        this.missedItems.push(item);
      }
    }

    const nextBtn = this.container.querySelector('#quizNextBtn');
    if (nextBtn) {
      nextBtn.style.display = 'inline-flex';
      nextBtn.focus();
    }
  }

  skipQuestion(item) {
    this.missedItems.push(item);
    this.advance();
  }

  advance() {
    this.currentIndex++;
    this.isAnswered = false;
    this.isFlipped = false;
    this.render();
  }

  renderCompletionScreen() {
    fireQuizCompletionConfetti();

    const totalQuestions = this.score.correct + this.score.wrong;
    const accuracy = totalQuestions > 0 ? Math.round((this.score.correct / totalQuestions) * 100) : 100;

    this.container.innerHTML = `
      <div class="quiz-completion-card">
        <div class="completion-hero">
          <div class="completion-icon-ring">
            <svg class="progress-ring-svg" width="120" height="120" viewBox="0 0 120 120">
              <circle class="ring-bg" cx="60" cy="60" r="50" fill="none" stroke-width="8"/>
              <circle class="ring-fill" cx="60" cy="60" r="50" fill="none" stroke-width="8"
                      stroke-dasharray="314" stroke-dashoffset="${314 - (314 * accuracy) / 100}"/>
            </svg>
            <span class="ring-accuracy-label">${accuracy}%</span>
          </div>
          <h2 class="completion-title">${accuracy >= 80 ? 'Mastery Achieved! 🎉' : 'Session Completed! 👏'}</h2>
          <p class="completion-subtitle">You tested ${totalQuestions} key concepts from your notes.</p>
        </div>

        <div class="completion-stats-grid">
          <div class="completion-stat-tile">
            <span class="c-stat-val text-success">${this.score.correct}</span>
            <span class="c-stat-lbl">Mastered</span>
          </div>
          <div class="completion-stat-tile">
            <span class="c-stat-val text-warning">${this.missedItems.length}</span>
            <span class="c-stat-lbl">Need Review</span>
          </div>
          <div class="completion-stat-tile">
            <span class="c-stat-val">${totalQuestions}</span>
            <span class="c-stat-lbl">Total Answered</span>
          </div>
        </div>

        <div class="completion-actions-row">
          ${this.missedItems.length > 0 ? `
            <button class="btn btn-warning study-missed-btn" id="studyMissedBtn">
              ↺ Study Missed Items (${this.missedItems.length})
            </button>
          ` : ''}
          <button class="btn btn-primary restart-quiz-btn" id="restartQuizBtn">
            Restart All Cards
          </button>
          <button class="btn btn-secondary back-to-sheet-btn" id="backToSheetBtn">
            View Revision Sheet
          </button>
        </div>
      </div>
    `;

    const studyMissedBtn = this.container.querySelector('#studyMissedBtn');
    if (studyMissedBtn) {
      studyMissedBtn.addEventListener('click', () => {
        const uniqueMissed = Array.from(new Set(this.missedItems.map(i => i.id)))
          .map(id => this.missedItems.find(i => i.id === id));
        this.reset(uniqueMissed);
      });
    }

    const restartBtn = this.container.querySelector('#restartQuizBtn');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        this.reset(this.items);
      });
    }

    const backToSheetBtn = this.container.querySelector('#backToSheetBtn');
    if (backToSheetBtn && this.options.onBackToSheet) {
      backToSheetBtn.addEventListener('click', () => {
        this.options.onBackToSheet();
      });
    }
  }

  renderEmptyState() {
    this.container.innerHTML = `
      <div class="empty-quiz-state">
        <div class="empty-state-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
        </div>
        <h3>No Quiz Questions Yet</h3>
        <p>Snap a set of lecture notes first to generate instant cloze flashcards and quizzes!</p>
      </div>
    `;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}
