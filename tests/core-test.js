import assert from 'node:assert';
import { splitNotes, splitIntoSentences, isHeading, cleanHeading } from '../src/core/tokenizer.js';
import { scoreSentences, extractTopKeywords } from '../src/core/scorer.js';
import { summarizeNotes } from '../src/core/summarizer.js';
import { generateQuizItems } from '../src/core/cloze.js';
import { calculateNextReview, RATING } from '../src/core/spacedRepetition.js';
import { SAMPLE_NOTES } from '../src/core/sampleNotes.js';

console.log('--- Running NoteSnap Core Tests ---');

// Test 1: Heading detection
assert.strictEqual(isHeading('# Cellular Respiration'), true, 'Should detect markdown h1');
assert.strictEqual(isHeading('## Stage 1: Glycolysis'), true, 'Should detect markdown h2');
assert.strictEqual(isHeading('1. INTRODUCTION'), true, 'Should detect numbered header');
assert.strictEqual(isHeading('Normal body sentence that just happens to be here.'), false, 'Should not detect regular text as heading');
console.log('✓ Heading detection tests passed');

// Test 2: Sentence splitting with abbreviations
const sampleText = 'Dr. Watson and Prof. Moriarty met at 2.5 km from the lab. The reaction yielded 98.5% purity! What happened next?';
const splitResults = splitIntoSentences(sampleText);
assert.strictEqual(splitResults.length, 3, `Expected 3 sentences, got ${splitResults.length}: ${JSON.stringify(splitResults)}`);
assert.ok(splitResults[0].includes('Dr. Watson and Prof. Moriarty'), 'Abbreviations should not break sentences');
console.log('✓ Sentence splitting with abbreviations passed');

// Test 3: Note splitting & feature extraction
const parsed = splitNotes(SAMPLE_NOTES[0].content);
assert.ok(parsed.length >= 10, `Expected at least 10 sentences from bio notes, got ${parsed.length}`);
const withFormula = parsed.find(s => s.hasFormula);
assert.ok(withFormula, 'Should detect formulas in chemical equations');
const withDefinition = parsed.find(s => s.hasDefinition);
assert.ok(withDefinition, 'Should detect definitions like "is" or "refers to"');
console.log('✓ Note parsing & feature detection passed');

// Test 4: Summarization across length modes
for (const mode of ['short', 'medium', 'detailed']) {
  const summary = summarizeNotes(SAMPLE_NOTES[0].content, mode);
  assert.ok(summary.sentences.length > 0, `Mode ${mode} should produce sentences`);
  assert.ok(summary.keywords.length > 0, `Mode ${mode} should extract keywords`);
  assert.ok(summary.stats.compressionRate > 0, `Mode ${mode} should show compression`);
  assert.ok(summary.groups.length > 0, `Mode ${mode} should group by headings`);
  console.log(`✓ Summarization mode [${mode}]: ${summary.sentences.length} sentences selected (${summary.stats.compressionRate}% compressed)`);
}

// Test 5: Cloze question generation
const summary = summarizeNotes(SAMPLE_NOTES[0].content, 'medium');
const quizItems = generateQuizItems(summary.sentences, summary.keywords);
assert.ok(quizItems.length > 0, 'Should generate quiz items from summary');
assert.ok(quizItems[0].prompt.includes('________'), 'Cloze prompt should have blank placeholder');
assert.strictEqual(quizItems[0].options.length, 4, 'Multiple choice should have 4 options');
assert.ok(quizItems[0].options.includes(quizItems[0].targetWord.toLowerCase()), 'Options must include correct answer');
console.log(`✓ Cloze generation passed (${quizItems.length} quiz items created)`);

// Test 6: Spaced repetition logic
const state0 = { interval: 1, easeFactor: 2.5, repetitions: 0 };
const stateAgain = calculateNextReview(state0, RATING.AGAIN);
assert.strictEqual(stateAgain.repetitions, 0);
assert.strictEqual(stateAgain.interval, 1);
assert.ok(stateAgain.easeFactor < 2.5, 'Ease should decrease on Again');

const stateEasy = calculateNextReview(state0, RATING.EASY);
assert.strictEqual(stateEasy.repetitions, 1);
assert.strictEqual(stateEasy.interval, 2);
assert.ok(stateEasy.easeFactor > 2.5, 'Ease should increase on Easy');
console.log('✓ Spaced repetition algorithm passed');

console.log('All core tests completed successfully!');
