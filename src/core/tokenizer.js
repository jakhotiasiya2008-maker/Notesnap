/**
 * Tokenizer & Text Normalizer
 * Handles sentence splitting with abbreviation protection, bullet parsing, and heading detection.
 */

const COMMON_ABBREVIATIONS = [
  'dr', 'mr', 'mrs', 'ms', 'prof', 'sr', 'jr', 'vs', 'etc', 'eg', 'ie',
  'fig', 'figs', 'eq', 'eqs', 'approx', 'dept', 'vol', 'no', 'al', 'jan',
  'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  'st', 'ave', 'blvd', 'rd', 'u.s', 'u.k', 'e.u', 'ph.d', 'm.d', 'b.a', 'b.s'
];

// Regex matching abbreviations followed by a dot
const ABBR_REGEX = new RegExp(`\\b(${COMMON_ABBREVIATIONS.join('|')})\\.$`, 'i');

/**
 * Checks if a string looks like a section heading or topic header
 */
export function isHeading(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.length > 90) return false;

  // Markdown headers
  if (/^#{1,6}\s+\S+/.test(trimmed)) return true;

  // Underlined headers or section markers
  if (/^(section|chapter|part|unit|module|topic|lecture)\s+\d+[:.]?/i.test(trimmed)) return true;
  if (/^[0-9]+(\.[0-9]+)*\s+[A-Z]/.test(trimmed)) return true;
  if (/^[IVXLCDM]+\.\s+[A-Z]/.test(trimmed)) return true;

  // Capitalized title lines ending with colon or standalone all-caps
  if (trimmed.endsWith(':') && trimmed.split(/\s+/).length <= 8) return true;
  if (trimmed === trimmed.toUpperCase() && trimmed.length >= 4 && /[A-Z]/.test(trimmed) && trimmed.split(/\s+/).length <= 7) return true;

  return false;
}

/**
 * Clean clean markdown header symbols from heading text
 */
export function cleanHeading(line) {
  return line.replace(/^#{1,6}\s+/, '').replace(/:$/, '').trim();
}

/**
 * Splits raw note text into structured paragraphs, headings, and sentences.
 * Returns array of Sentence objects:
 * { id, text, rawText, heading, index, wordCount, hasDefinition, hasNumber, hasFormula, hasAllCapWord }
 */
export function splitNotes(rawText) {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split(/\r?\n/);
  const sentences = [];
  let currentHeading = 'Overview';
  let sentenceIndex = 0;

  for (let line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Heading detection
    if (isHeading(trimmedLine)) {
      currentHeading = cleanHeading(trimmedLine);
      continue;
    }

    // Strip bullet markers for sentence parsing while remembering bullet status
    let cleanedLine = trimmedLine.replace(/^[-*•–—]\s+/, '').replace(/^\d+[\.)]\s+/, '');

    // Now split the line into sentences respecting abbreviations
    const rawSentenceList = splitIntoSentences(cleanedLine);

    for (const rawSent of rawSentenceList) {
      const sentText = rawSent.trim();
      if (!sentText) continue;

      const words = tokenizeWords(sentText);
      if (words.length === 0) continue;

      // Extract linguistic features for scoring
      const hasDefinition = /\b(is|are|refers to|defined as|means|signifies|represents|known as)\b/i.test(sentText);
      const hasNumber = /\b\d+(\.\d+)?%?\b/.test(sentText);
      const hasFormula = /[=+\-*/^<>≈≤≥λμσΔ\\]/.test(sentText) || /\b(H2O|CO2|ATP|DNA|RNA|O2|NaCl)\b/.test(sentText);
      const hasAllCapWord = words.some(w => w.length >= 3 && w === w.toUpperCase() && !COMMON_ABBREVIATIONS.includes(w.toLowerCase()));

      sentences.push({
        id: `s_${sentenceIndex}`,
        index: sentenceIndex,
        text: sentText,
        rawText: sentText,
        heading: currentHeading,
        words,
        wordCount: words.length,
        hasDefinition,
        hasNumber,
        hasFormula,
        hasAllCapWord
      });

      sentenceIndex++;
    }
  }

  return sentences;
}

/**
 * Splits a text block into individual sentences while preserving periods in abbreviations & decimals.
 */
export function splitIntoSentences(text) {
  if (!text) return [];

  // Protect decimals like 3.14 or 1.5
  let protectedText = text.replace(/(\d+)\.(\d+)/g, '$1__DECIMAL__$2');

  // Protect common abbreviations
  for (const abbr of COMMON_ABBREVIATIONS) {
    const regex = new RegExp(`\\b${abbr}\\.`, 'gi');
    protectedText = protectedText.replace(regex, (match) => match.slice(0, -1) + '__DOT__');
  }

  // Split on punctuation followed by space or end of line
  const rawParts = protectedText.split(/([.!?]+(?:\s+|$))/);
  const result = [];
  let buffer = '';

  for (let i = 0; i < rawParts.length; i += 2) {
    const textPart = rawParts[i];
    const punct = rawParts[i + 1] || '';
    let sentence = (textPart + punct)
      .replace(/__DECIMAL__/g, '.')
      .replace(/__DOT__/g, '.');

    sentence = sentence.trim();
    if (sentence) {
      result.push(sentence);
    }
  }

  return result.length > 0 ? result : [text.trim()];
}

/**
 * Tokenize string into lowercase alphanumeric words
 */
export function tokenizeWords(text) {
  if (!text) return [];
  // Match word characters, allowing internal hyphens (e.g. self-driving, well-known)
  const matches = text.match(/\b[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*\b/g);
  return matches ? matches : [];
}

/**
 * Tokenize words into lower-case clean tokens for TF-IDF
 */
export function getCleanTokens(text) {
  return tokenizeWords(text).map(w => w.toLowerCase());
}
