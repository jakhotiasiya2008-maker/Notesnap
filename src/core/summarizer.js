import { splitNotes } from './tokenizer.js';
import { scoreSentences, extractTopKeywords } from './scorer.js';

export const LENGTH_MODES = {
  short: { ratio: 0.12, minSentences: 3, label: 'Short (10%)' },
  medium: { ratio: 0.25, minSentences: 5, label: 'Medium (25%)' },
  detailed: { ratio: 0.40, minSentences: 8, label: 'Detailed (40%)' }
};

/**
 * Perform extractive summarization
 * @param {string} rawText 
 * @param {'short'|'medium'|'detailed'} lengthMode 
 */
export function summarizeNotes(rawText, lengthMode = 'medium') {
  if (!rawText || !rawText.trim()) {
    return {
      groups: [],
      sentences: [],
      keywords: [],
      stats: {
        originalWords: 0,
        summaryWords: 0,
        compressionRate: 0,
        timeSavedSeconds: 0,
        sentenceCountOriginal: 0,
        sentenceCountSummary: 0
      }
    };
  }

  // 1. Split into sentence objects
  const allSentences = splitNotes(rawText);
  if (allSentences.length === 0) {
    return {
      groups: [],
      sentences: [],
      keywords: [],
      stats: { originalWords: 0, summaryWords: 0, compressionRate: 0, timeSavedSeconds: 0, sentenceCountOriginal: 0, sentenceCountSummary: 0 }
    };
  }

  // 2. Score sentences
  const scoredSentences = scoreSentences(allSentences);
  const topKeywords = extractTopKeywords(allSentences, 16);
  const keywordSet = new Set(topKeywords.map(k => k.term.toLowerCase()));

  // 3. Determine how many sentences to pick
  const config = LENGTH_MODES[lengthMode] || LENGTH_MODES.medium;
  const targetCount = Math.max(
    Math.min(config.minSentences, scoredSentences.length),
    Math.round(scoredSentences.length * config.ratio)
  );

  // 4. Select top-scoring sentences
  // Ensure we get good distribution across headings if notes have multiple headings
  const sortedByScore = [...scoredSentences].sort((a, b) => b.finalScore - a.finalScore);
  const selectedSet = new Set();

  // First pass: ensure each heading with substantial sentences gets at least 1 top sentence
  const headingGroups = new Map();
  scoredSentences.forEach(s => {
    if (!headingGroups.has(s.heading)) headingGroups.set(s.heading, []);
    headingGroups.get(s.heading).push(s);
  });

  if (headingGroups.size > 1) {
    for (const [heading, list] of headingGroups.entries()) {
      if (selectedSet.size >= targetCount) break;
      const bestInGroup = [...list].sort((a, b) => b.finalScore - a.finalScore)[0];
      if (bestInGroup) {
        selectedSet.add(bestInGroup.id);
      }
    }
  }

  // Fill remaining quota with highest scoring
  for (const item of sortedByScore) {
    if (selectedSet.size >= targetCount) break;
    selectedSet.add(item.id);
  }

  // 5. Keep chosen sentences in original sequential order
  const summarySentences = scoredSentences.filter(s => selectedSet.has(s.id));

  // 6. Highlight keywords in sentences
  const highlightedSentences = summarySentences.map(s => {
    return {
      ...s,
      highlightedHtml: highlightSentenceKeywords(s.text, keywordSet)
    };
  });

  // 7. Group summary sentences by detected headings
  const groupedSections = [];
  let currentGroup = null;

  for (const s of highlightedSentences) {
    if (!currentGroup || currentGroup.heading !== s.heading) {
      currentGroup = {
        heading: s.heading,
        sentences: []
      };
      groupedSections.push(currentGroup);
    }
    currentGroup.sentences.push(s);
  }

  // 8. Calculate stats
  const originalWords = allSentences.reduce((acc, s) => acc + s.wordCount, 0);
  const summaryWords = summarySentences.reduce((acc, s) => acc + s.wordCount, 0);
  const compressionRate = originalWords > 0 
    ? Math.max(0, Math.round((1 - summaryWords / originalWords) * 100))
    : 0;

  // Average reading speed: 220 words per minute (3.66 words/sec)
  const wordsSaved = Math.max(0, originalWords - summaryWords);
  const timeSavedSeconds = Math.round((wordsSaved / 220) * 60);

  return {
    groups: groupedSections,
    sentences: highlightedSentences,
    allSentencesCount: allSentences.length,
    keywords: topKeywords,
    stats: {
      originalWords,
      summaryWords,
      compressionRate,
      timeSavedSeconds,
      sentenceCountOriginal: allSentences.length,
      sentenceCountSummary: highlightedSentences.length
    }
  };
}

/**
 * Wrap recognized keywords in <mark class="snap-kw"> tags
 */
export function highlightSentenceKeywords(text, keywordSet) {
  if (!keywordSet || keywordSet.size === 0) return escapeHtml(text);

  // Sort keywords by length descending so longer compound terms match first
  const sortedKeywords = Array.from(keywordSet).sort((a, b) => b.length - a.length);
  const escapedKeywords = sortedKeywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`\\b(${escapedKeywords.join('|')})\\b`, 'gi');

  return escapeHtml(text).replace(regex, '<mark class="snap-kw">$1</mark>');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
