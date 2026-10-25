/**
 * Spaced Repetition Algorithm (SM-2 variant adapted for quick study sessions)
 * Ratings:
 *  - 'again': Failed card, resets streak, interval = 1 day, resurfaces in current queue
 *  - 'hard': Difficult card, minor interval increase, lower ease factor
 *  - 'easy': Mastered card, generous interval increase, higher ease factor
 */

export const RATING = {
  AGAIN: 'again',
  HARD: 'hard',
  EASY: 'easy'
};

/**
 * Calculates updated review state given previous state and rating
 */
export function calculateNextReview(currentState = {}, rating) {
  let interval = currentState.interval || 1;
  let easeFactor = currentState.easeFactor || 2.5;
  let repetitions = currentState.repetitions || 0;

  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  switch (rating) {
    case RATING.AGAIN:
      repetitions = 0;
      interval = 1; // 1 day (or immediate review)
      easeFactor = Math.max(1.3, easeFactor - 0.2);
      break;

    case RATING.HARD:
      repetitions += 1;
      interval = Math.max(1, Math.round(interval * 1.2));
      easeFactor = Math.max(1.3, easeFactor - 0.15);
      break;

    case RATING.EASY:
      if (repetitions === 0) {
        interval = 2;
      } else if (repetitions === 1) {
        interval = 4;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      repetitions += 1;
      easeFactor = Math.min(3.0, easeFactor + 0.15);
      break;

    default:
      break;
  }

  const nextReviewDate = now + (interval * ONE_DAY_MS);

  return {
    interval,
    easeFactor: parseFloat(easeFactor.toFixed(2)),
    repetitions,
    lastReviewed: now,
    nextReviewDate,
    lastRating: rating
  };
}
