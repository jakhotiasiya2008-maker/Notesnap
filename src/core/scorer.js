import { isStopword } from './stopwords.js';
import { getCleanTokens } from './tokenizer.js';

/**
 * Calculates Term Frequency (TF) and Inverse Document Frequency (IDF)
 * across an array of sentences.
 */
export function computeTFIDF(sentences) {
  const docCount = sentences.length;
  if (docCount === 0) return { tfMap: new Map(), idfMap: new Map(), termFrequency: new Map() };

  // Document frequency: how many sentences contain word w
  const docFrequency = new Map();
  // Global term frequency
  const termFrequency = new Map();
  // Per-sentence term frequencies: Map<sentenceId, Map<term, count>>
  const sentTfMap = new Map();

  for (const s of sentences) {
    const rawTokens = getCleanTokens(s.text);
    const validTokens = rawTokens.filter(t => !isStopword(t) && t.length > 2);
    const seenInSent = new Set();
    const tokenCounts = new Map();

    for (const t of validTokens) {
      tokenCounts.set(t, (tokenCounts.get(t) || 0) + 1);
      termFrequency.set(t, (termFrequency.get(t) || 0) + 1);

      if (!seenInSent.has(t)) {
        seenInSent.add(t);
        docFrequency.set(t, (docFrequency.get(t) || 0) + 1);
      }
    }

    sentTfMap.set(s.id, tokenCounts);
  }

  // Calculate smoothed IDF: log((N + 1) / (df + 1)) + 1
  const idfMap = new Map();
  for (const [term, df] of docFrequency.entries()) {
    const idf = Math.log((docCount + 1) / (df + 1)) + 1.0;
    idfMap.set(term, idf);
  }

  return { sentTfMap, idfMap, termFrequency };
}

/**
 * Score all sentences using multi-feature extraction algorithm
 */
export function scoreSentences(sentences) {
  if (!sentences || sentences.length === 0) return [];

  const { sentTfMap, idfMap, termFrequency } = computeTFIDF(sentences);

  // Group sentences by heading to apply relative position weighting
  const headingFirstIndex = new Map();
  sentences.forEach((s) => {
    if (!headingFirstIndex.has(s.heading)) {
      headingFirstIndex.set(s.heading, s.index);
    }
  });

  return sentences.map(s => {
    const tokenCounts = sentTfMap.get(s.id) || new Map();
    let tfIdfScore = 0;
    let validTokenCount = 0;

    for (const [term, count] of tokenCounts.entries()) {
      const idf = idfMap.get(term) || 1.0;
      // Augmented term frequency normalized by sentence length
      const tf = count / Math.max(1, s.wordCount);
      tfIdfScore += tf * idf;
      validTokenCount += count;
    }

    // Baseline normalize
    let score = tfIdfScore;

    // Feature 1: Definition boost ("X is", "X refers to", "X means")
    let definitionBoost = 0;
    if (s.hasDefinition) {
      definitionBoost = 1.6;
      score += definitionBoost;
    }

    // Feature 2: Numbers & formulas boost
    let formulaBoost = 0;
    if (s.hasFormula) formulaBoost += 0.9;
    if (s.hasNumber) formulaBoost += 0.6;
    score += formulaBoost;

    // Feature 3: ALL-CAPS / acronym boost
    let capsBoost = 0;
    if (s.hasAllCapWord) {
      capsBoost = 0.8;
      score += capsBoost;
    }

    // Feature 4: Heading alignment (if words in sentence also appear in its heading)
    let headingBoost = 0;
    if (s.heading && s.heading !== 'Overview') {
      const headingTokens = getCleanTokens(s.heading).filter(t => !isStopword(t));
      const hasHeadingMatch = headingTokens.some(ht => tokenCounts.has(ht));
      if (hasHeadingMatch) {
        headingBoost = 1.2;
        score += headingBoost;
      }
    }

    // Feature 5: Structural position (first sentence under a heading gets a thesis boost)
    let positionBoost = 0;
    if (headingFirstIndex.get(s.heading) === s.index) {
      positionBoost = 0.8;
      score += positionBoost;
    }

    // Feature 6: Length penalties
    let lengthPenalty = 1.0;
    if (s.wordCount < 6) {
      // Very short sentences or fragments
      lengthPenalty = 0.35;
    } else if (s.wordCount < 10) {
      lengthPenalty = 0.75;
    } else if (s.wordCount > 45) {
      // Run-on sentences
      lengthPenalty = 0.7;
    }

    const finalScore = score * lengthPenalty;

    return {
      ...s,
      baseScore: tfIdfScore,
      definitionBoost,
      formulaBoost,
      capsBoost,
      headingBoost,
      positionBoost,
      lengthPenalty,
      finalScore
    };
  });
}

/**
 * Extracts top keywords from the corpus with their frequency and importance
 */
export function extractTopKeywords(sentences, limit = 15) {
  const { termFrequency, idfMap } = computeTFIDF(sentences);

  const keywords = [];
  for (const [term, freq] of termFrequency.entries()) {
    if (term.length < 3) continue;
    // Don't include pure numbers as keywords unless combined with letters
    if (/^\d+$/.test(term)) continue;

    const idf = idfMap.get(term) || 1.0;
    const importance = freq * idf;
    keywords.push({ term, freq, importance });
  }

  keywords.sort((a, b) => b.importance - a.importance);
  return keywords.slice(0, limit);
}
