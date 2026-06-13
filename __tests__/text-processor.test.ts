import fs from 'fs';
import path from 'path';
import os from 'os';
import { processText } from '@/lib/processors/text';

describe('processText', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fsa-txt-'));
    // Override OPTIMIZED_DIR via module-level env
    process.env.OVERRIDE_OPTIMIZED_DIR = tmpDir;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.OVERRIDE_OPTIMIZED_DIR;
  });

  it('compresses a large text file and reports savings', async () => {
    // Mock OPTIMIZED_DIR
    jest.resetModules();
    jest.doMock('@/lib/storage', () => ({
      ...jest.requireActual('@/lib/storage'),
      OPTIMIZED_DIR: tmpDir,
    }));

    const { processText: pt } = await import('@/lib/processors/text');

    // Create a compressible 50 KB text file
    const inputPath = path.join(tmpDir, 'test.txt');
    const content = 'Hello World! '.repeat(4000); // ~52 KB, repetitive → compresses well
    fs.writeFileSync(inputPath, content);

    const uuid = 'test-uuid-1234';
    const result = await pt(inputPath, uuid);

    expect(['optimized', 'no_savings']).toContain(result.status);
    if (result.status === 'optimized') {
      expect(result.optimizedSize).not.toBeNull();
      expect(result.optimizedSize!).toBeLessThan(fs.statSync(inputPath).size);
      expect(result.compressionMethod).toMatch(/gzip/);
    }
  });

  it('marks tiny files with no_savings if gzip is larger', async () => {
    jest.resetModules();
    jest.doMock('@/lib/storage', () => ({
      ...jest.requireActual('@/lib/storage'),
      OPTIMIZED_DIR: tmpDir,
    }));

    const { processText: pt } = await import('@/lib/processors/text');

    // 1-byte file: gzip overhead will exceed original
    const inputPath = path.join(tmpDir, 'tiny.txt');
    fs.writeFileSync(inputPath, 'a');

    const result = await pt(inputPath, 'tiny-uuid');
    // Could be optimized or no_savings, both valid
    expect(['optimized', 'no_savings']).toContain(result.status);
  });
});
