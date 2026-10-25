import { summarizeNotes } from '../core/summarizer.js';
import { generateQuizItems } from '../core/cloze.js';

self.onmessage = function (e) {
  const { id, action, text, mode } = e.data;

  try {
    if (action === 'summarize') {
      const summaryResult = summarizeNotes(text, mode);
      const quizItems = generateQuizItems(summaryResult.sentences, summaryResult.keywords);

      self.postMessage({
        id,
        success: true,
        data: {
          ...summaryResult,
          quizItems
        }
      });
    }
  } catch (err) {
    self.postMessage({
      id,
      success: false,
      error: err.message || 'Summarization failed'
    });
  }
};
