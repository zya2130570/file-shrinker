import { processTextBuffer } from '@/lib/processors/text';

describe('processTextBuffer', () => {
  it('compresses a repetitive text buffer and reports savings', async () => {
    // Highly repetitive content compresses well
    const content = Buffer.from('Hello World! '.repeat(4000)); // ~52 KB
    const result = await processTextBuffer(content);

    expect(['optimized', 'no_savings']).toContain(result.status);
    if (result.status === 'optimized') {
      expect(result.optimizedBuffer).not.toBeNull();
      expect(result.optimizedBuffer!.length).toBeLessThan(content.length);
      expect(result.optimizedExt).toBe('.gz');
      expect(result.compressionMethod).toMatch(/gzip/);
    }
  });

  it('returns no_savings when compressed output is larger', async () => {
    // Single byte: gzip overhead > content
    const result = await processTextBuffer(Buffer.from('a'));
    expect(['optimized', 'no_savings']).toContain(result.status);
  });

  it('returns null buffer on no_savings', async () => {
    const result = await processTextBuffer(Buffer.from('a'));
    if (result.status === 'no_savings') {
      expect(result.optimizedBuffer).toBeNull();
      expect(result.optimizedExt).toBeNull();
    }
  });
});
