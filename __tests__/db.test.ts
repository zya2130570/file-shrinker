import fs from 'fs';
import path from 'path';
import os from 'os';

// Use temp dir for test DB
const testDbDir = path.join(os.tmpdir(), `fsa-test-${Date.now()}`);
fs.mkdirSync(testDbDir, { recursive: true });

jest.mock('@/lib/db', () => {
  const Database = require('better-sqlite3');
  const db = new Database(path.join(testDbDir, 'test.db'));
  db.pragma('journal_mode = WAL');
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
    )
  `);
  return { getDb: () => db };
});

import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

describe('Database operations', () => {
  let db: ReturnType<typeof getDb>;

  beforeAll(() => {
    db = getDb();
  });

  afterEach(() => {
    db.exec('DELETE FROM files');
  });

  afterAll(() => {
    fs.rmSync(testDbDir, { recursive: true, force: true });
  });

  it('inserts a file record', () => {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO files (id, original_filename, mime_type, original_size, upload_date, original_path, optimization_status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, 'test.png', 'image/png', 1024, new Date().toISOString(), '/tmp/test.png', 'pending');

    const row = db.prepare('SELECT * FROM files WHERE id = ?').get(id) as any;
    expect(row.id).toBe(id);
    expect(row.original_filename).toBe('test.png');
    expect(row.mime_type).toBe('image/png');
    expect(row.original_size).toBe(1024);
    expect(row.optimization_status).toBe('pending');
  });

  it('updates optimization status', () => {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO files (id, original_filename, mime_type, original_size, upload_date, original_path, optimization_status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, 'test.txt', 'text/plain', 2048, new Date().toISOString(), '/tmp/test.txt', 'processing');

    db.prepare(`
      UPDATE files SET optimized_size = ?, compression_method = ?, optimized_path = ?, optimization_status = ?
      WHERE id = ?
    `).run(512, 'gzip level 9', '/tmp/opt.gz', 'optimized', id);

    const row = db.prepare('SELECT * FROM files WHERE id = ?').get(id) as any;
    expect(row.optimization_status).toBe('optimized');
    expect(row.optimized_size).toBe(512);
    expect(row.compression_method).toBe('gzip level 9');
  });

  it('lists files', () => {
    const ids = [uuidv4(), uuidv4()];
    for (const id of ids) {
      db.prepare(`
        INSERT INTO files (id, original_filename, mime_type, original_size, upload_date, original_path, optimization_status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, `file-${id}.txt`, 'text/plain', 100, new Date().toISOString(), `/tmp/${id}.txt`, 'optimized');
    }

    const rows = db.prepare('SELECT * FROM files ORDER BY upload_date DESC').all();
    expect(rows.length).toBe(2);
  });

  it('deletes a file record', () => {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO files (id, original_filename, mime_type, original_size, upload_date, original_path, optimization_status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, 'del.txt', 'text/plain', 100, new Date().toISOString(), '/tmp/del.txt', 'pending');

    db.prepare('DELETE FROM files WHERE id = ?').run(id);
    const row = db.prepare('SELECT * FROM files WHERE id = ?').get(id);
    expect(row).toBeUndefined();
  });

  it('calculates savings percent via SQL', () => {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO files (id, original_filename, mime_type, original_size, optimized_size, upload_date, original_path, optimization_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, 'img.png', 'image/png', 1000, 600, new Date().toISOString(), '/tmp/img.png', 'optimized');

    const row = db.prepare(`
      SELECT *,
        ROUND((CAST(original_size - optimized_size AS REAL) / original_size) * 100, 1) AS savings_percent
      FROM files WHERE id = ?
    `).get(id) as any;

    expect(row.savings_percent).toBe(40.0);
  });
});
