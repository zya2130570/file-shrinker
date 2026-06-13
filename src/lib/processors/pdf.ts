import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { OPTIMIZED_DIR } from '../storage';
import type { ProcessorResult } from '@/types';

const execFileAsync = promisify(execFile);

async function tryGhostscript(inputPath: string, outputPath: string): Promise<boolean> {
  // TODO: Install Ghostscript (`apt install ghostscript`) to enable PDF optimization
  try {
    await execFileAsync('gs', [
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.4',
      '-dPDFSETTINGS=/ebook',
      '-dNOPAUSE',
      '-dQUIET',
      '-dBATCH',
      `-sOutputFile=${outputPath}`,
      inputPath,
    ]);
    return true;
  } catch {
    return false;
  }
}

async function tryQpdf(inputPath: string, outputPath: string): Promise<boolean> {
  // TODO: Install qpdf (`apt install qpdf`) to enable PDF linearization
  try {
    await execFileAsync('qpdf', ['--linearize', inputPath, outputPath]);
    return true;
  } catch {
    return false;
  }
}

export async function processPdf(
  inputPath: string,
  uuid: string
): Promise<ProcessorResult> {
  const outputPath = path.join(OPTIMIZED_DIR, `${uuid}.pdf`);
  const originalSize = fs.statSync(inputPath).size;

  // Try Ghostscript first, then qpdf
  const gsSuccess = await tryGhostscript(inputPath, outputPath);
  if (gsSuccess && fs.existsSync(outputPath)) {
    const optimizedSize = fs.statSync(outputPath).size;
    if (optimizedSize < originalSize) {
      return {
        optimizedPath: outputPath,
        optimizedSize,
        compressionMethod: 'Ghostscript /ebook',
        status: 'optimized',
      };
    }
    fs.unlinkSync(outputPath);
  }

  const qpdfSuccess = await tryQpdf(inputPath, outputPath);
  if (qpdfSuccess && fs.existsSync(outputPath)) {
    const optimizedSize = fs.statSync(outputPath).size;
    if (optimizedSize < originalSize) {
      return {
        optimizedPath: outputPath,
        optimizedSize,
        compressionMethod: 'qpdf linearize',
        status: 'optimized',
      };
    }
    fs.unlinkSync(outputPath);
  }

  // Neither tool available or no savings
  return {
    optimizedPath: null,
    optimizedSize: null,
    compressionMethod: null,
    status: 'unsupported',
  };
}
