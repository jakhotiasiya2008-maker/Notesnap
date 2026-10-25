import { summarizeNotes } from './summarizer.js';
import { generateQuizItems } from './cloze.js';

let worker = null;
let requestId = 0;
const pendingRequests = new Map();

function initWorker() {
  if (worker) return worker;
  if (typeof Worker !== 'undefined') {
    try {
      worker = new Worker(new URL('../workers/summarizer.worker.js', import.meta.url), {
        type: 'module'
      });

      worker.onmessage = (event) => {
        const { id, success, data, error } = event.data;
        const resolver = pendingRequests.get(id);
        if (resolver) {
          pendingRequests.delete(id);
          if (success) {
            resolver.resolve(data);
          } else {
            resolver.reject(new Error(error));
          }
        }
      };

      worker.onerror = (err) => {
        console.error('Worker error:', err);
      };
    } catch (e) {
      console.warn('Worker initialization fallback to main thread:', e);
      worker = null;
    }
  }
  return worker;
}

export function runSummarizerWorker(text, mode = 'medium') {
  const currentWorker = initWorker();

  if (!currentWorker) {
    // Fallback on main thread if web worker is disabled or unavailable
    return Promise.resolve().then(() => {
      const summaryResult = summarizeNotes(text, mode);
      const quizItems = generateQuizItems(summaryResult.sentences, summaryResult.keywords);
      return {
        ...summaryResult,
        quizItems
      };
    });
  }

  const id = ++requestId;
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    currentWorker.postMessage({ id, action: 'summarize', text, mode });
  });
}
