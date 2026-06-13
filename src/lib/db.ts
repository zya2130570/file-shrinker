import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'file-shrinker.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  fs.mkdirSync(DB_DIR, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      original_filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      original_size INTEGER NOT NULL,
      optimized_size INTEGER,
      compression_method TEXT,
      upload_date TEXT NOT NULL DEFAULT (datetime('now')),
      original_path TEXT NOT NULL,
      optimized_path TEXT,
      optimization_status TEXT NOT NULL DEFAULT 'pending',
      user_id TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_files_upload_date ON files(upload_date DESC);
    CREATE INDEX IF NOT EXISTS idx_files_mime_type ON files(mime_type);
    CREATE INDEX IF NOT EXISTS idx_files_status ON files(optimization_status);
  `);

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
