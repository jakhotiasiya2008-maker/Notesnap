import { openDB } from 'idb';

const DB_NAME = 'notesnap_db';
const DB_VERSION = 1;

let dbPromise = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        // Saved revision sheets store
        if (!db.objectStoreNames.contains('sheets')) {
          const sheetStore = db.createObjectStore('sheets', { keyPath: 'id' });
          sheetStore.createIndex('updatedAt', 'updatedAt');
          sheetStore.createIndex('title', 'title');
        }

        // Flashcards and Spaced Repetition store
        if (!db.objectStoreNames.contains('flashcards')) {
          const cardStore = db.createObjectStore('flashcards', { keyPath: 'id' });
          cardStore.createIndex('sheetId', 'sheetId');
          cardStore.createIndex('nextReviewDate', 'nextReviewDate');
        }

        // User settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      }
    });
  }
  return dbPromise;
}

// === Sheets CRUD ===

export async function saveSheet(sheet) {
  const db = await getDB();
  const item = {
    ...sheet,
    updatedAt: sheet.updatedAt || Date.now(),
    createdAt: sheet.createdAt || Date.now()
  };
  await db.put('sheets', item);
  return item;
}

export async function getAllSheets() {
  const db = await getDB();
  const tx = db.transaction('sheets', 'readonly');
  const index = tx.store.index('updatedAt');
  const sheets = await index.getAll();
  return sheets.reverse(); // newest first
}

export async function getSheetById(id) {
  const db = await getDB();
  return db.get('sheets', id);
}

export async function renameSheet(id, newTitle) {
  const db = await getDB();
  const sheet = await db.get('sheets', id);
  if (sheet) {
    sheet.title = newTitle;
    sheet.updatedAt = Date.now();
    await db.put('sheets', sheet);
    return sheet;
  }
  return null;
}

export async function deleteSheet(id) {
  const db = await getDB();
  const sheet = await db.get('sheets', id);
  await db.delete('sheets', id);
  return sheet; // return for undo
}

// === Flashcards & Spaced Repetition CRUD ===

export async function saveFlashcardState(card) {
  const db = await getDB();
  await db.put('flashcards', card);
}

export async function getCardsForSheet(sheetId) {
  const db = await getDB();
  const tx = db.transaction('flashcards', 'readonly');
  const index = tx.store.index('sheetId');
  return index.getAll(sheetId);
}

// === Settings ===

export async function getSetting(key, defaultValue = null) {
  const db = await getDB();
  const val = await db.get('settings', key);
  return val !== undefined ? val : defaultValue;
}

export async function setSetting(key, value) {
  const db = await getDB();
  await db.put('settings', value, key);
}
