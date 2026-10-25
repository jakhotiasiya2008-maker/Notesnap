import { isStopword } from './stopwords.js';
import { tokenizeWords } from './tokenizer.js';

/**
 * Generate Cloze (fill-in-the-blank) items from key sentences and keywords
 * @param {Array} summarySentences 
 * @param {Array} topKeywords 
 */
export function generateQuizItems(summarySentences, topKeywords) {
  if (!summarySentences || summarySentences.length === 0) return [];

  const keywordList = topKeywords.map(k => k.term.toLowerCase());
  const keywordSet = new Set(keywordList);
  const quizItems = [];

  summarySentences.forEach((sentence, idx) => {
    const rawTokens = tokenizeWords(sentence.text);
    // Find candidate words in this sentence that match top keywords
    const candidateMatches = rawTokens.filter(word => {
      const lower = word.toLowerCase();
      return keywordSet.has(lower) && !isStopword(lower) && lower.length >= 3;
    });

    if (candidateMatches.length === 0) {
      // Fallback: pick any substantial non-stopword longer than 4 characters
      const fallbacks = rawTokens.filter(w => !isStopword(w.toLowerCase()) && w.length >= 4);
      if (fallbacks.length > 0) {
        candidateMatches.push(fallbacks[0]);
      }
    }

    if (candidateMatches.length === 0) return;

    // Pick the most distinct keyword or longest
    candidateMatches.sort((a, b) => b.length - a.length);
    const targetWord = candidateMatches[0];

    // Create cloze sentence by replacing the word (case-insensitive exact word boundary)
    const escapedTarget = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedTarget}\\b`, 'i');

    const promptText = sentence.text.replace(regex, '________');

    // Generate 3 distractors from other keywords
    const otherKeywords = keywordList.filter(k => k.toLowerCase() !== targetWord.toLowerCase() && k.length >= 3);
    const shuffledOthers = shuffleArray([...otherKeywords]);
    const distractors = shuffledOthers.slice(0, 3);

    // If we don't have enough distractors, add plausible academic fallback distractors
    const backupDistractors = ['hypothesis', 'variable', 'equilibrium', 'mechanism', 'catalyst', 'protocol', 'gradient', 'paradigm'];
    for (const b of backupDistractors) {
      if (distractors.length >= 3) break;
      if (b.toLowerCase() !== targetWord.toLowerCase() && !distractors.includes(b)) {
        distractors.push(b);
      }
    }

    // Combine correct answer with distractors and shuffle
    const options = shuffleArray([
      targetWord.toLowerCase(),
      ...distractors.map(d => d.toLowerCase())
    ]);

    quizItems.push({
      id: `q_${sentence.id || idx}_${Date.now()}_${idx}`,
      sentenceId: sentence.id,
      heading: sentence.heading || 'Key Concept',
      fullSentence: sentence.text,
      targetWord: targetWord,
      prompt: promptText,
      options,
      // Default SRS state
      reviewState: {
        interval: 1, // days
        easeFactor: 2.5,
        repetitions: 0,
        lastReviewed: null,
        nextReviewDate: Date.now()
      }
    });
  });

  return quizItems;
}

/**
 * Fisher-Yates array shuffle helper
 */
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
