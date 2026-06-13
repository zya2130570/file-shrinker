# File Shrinker Archive

A full-stack web app for uploading, optimizing, previewing, and downloading files. The original is always preserved; optimized copies are created where possible.

## Features

- **Drag-and-drop upload** with progress bar; supports images, PDFs, audio, video, text, CSV, JSON
- **Automatic optimization** — Sharp for images, gzip for text/CSV/JSON, FFmpeg for audio/video (when available), Ghostscript/qpdf for PDFs (when available)
- **Dashboard** with per-file stats: original size, optimized size, percent saved, compression method
- **Filters** by type (images, PDFs, audio, video, documents, no savings) and filename search
- **Preview** — inline image/audio/video/PDF/text viewer
- **Download** original or optimized version separately
- **Delete** removes both copies and the metadata record

---

## Install Steps

### Prerequisites

| Tool | Required | Purpose |
|------|----------|---------|
| Node.js >= 18 | Yes | Runtime |
| npm | Yes | Package manager |
| FFmpeg | Optional | Audio & video optimization |
| Ghostscript | Optional | PDF optimization |
| qpdf | Optional | PDF linearization |

Install optional system tools on Ubuntu/Debian:
```bash
apt install ffmpeg ghostscript qpdf
```

### 1. Clone and install

```bash
git clone <repo-url>
cd file-shrinker
npm install
```

### 2. Environment variables

No environment variables are required for local development. The app uses sensible defaults:

- SQLite database: `data/file-shrinker.db`
- Uploads: `uploads/originals/` and `uploads/optimized/`

Create a `.env.local` file only if you need to override defaults in the future.

### 3. Run locally

```bash
npm run dev
```

Open http://localhost:3000.

The app auto-creates all required directories on first run.

### 4. Run tests

```bash
npm test
```

### 5. Production build

```bash
npm run build
npm start
```

---

## How File Processing Works

### Images
Uses [Sharp](https://sharp.pixelplumbing.com/):
- Converts to WebP at quality 82
- Resizes to max 1920 px width (preserves aspect ratio)
- If WebP output is larger than original, reports "No savings" and discards it

### Audio
Uses FFmpeg (`ffmpeg -codec:a libmp3lame -b:a 128k`):
- Transcodes to 128 kbps MP3
- Falls back to `status: unsupported` if FFmpeg is not installed

### Video
Uses FFmpeg (`libx264 CRF 28, AAC 128 kbps, faststart`):
- Produces a compressed H.264 MP4
- Falls back to `status: unsupported` if FFmpeg is not installed

### PDFs
Tries Ghostscript (`-dPDFSETTINGS=/ebook`) first, then qpdf (`--linearize`):
- Falls back to `status: unsupported` if neither tool is installed

### Text / CSV / JSON
Uses Node.js built-in `zlib.createGzip` at level 9:
- No external tools required; always available

### Already-compressed / unsupported files
- ZIP, GZIP, 7z, MP3, MP4, WebP: stored without re-compression, marked `no_savings` or `unsupported`
- Generic binary files: stored as-is, marked `unsupported`

### Safety guarantees
- The original file is **never modified or deleted** by the optimizer
- If optimization fails for any reason, status is set to `failed` and the original remains intact
- File names in storage use UUIDs — no user-supplied names reach the filesystem

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload` | Upload a file (multipart/form-data, field: `file`) |
| GET | `/api/files` | List files (`?category=images&search=foo`) |
| GET | `/api/files/[id]` | Get single file metadata |
| DELETE | `/api/files/[id]` | Delete file and both copies |
| GET | `/api/files/[id]/download?type=original` | Download original |
| GET | `/api/files/[id]/download?type=optimized` | Download optimized |
| GET | `/api/files/[id]/preview` | Serve file inline for preview |

---

## Required System Dependencies

| Dependency | Install command | Used for |
|-----------|----------------|---------|
| Node.js >= 18 | https://nodejs.org | Runtime |
| FFmpeg | `apt install ffmpeg` | Audio/video optimization |
| Ghostscript | `apt install ghostscript` | PDF optimization |
| qpdf | `apt install qpdf` | PDF linearization |

Sharp (image processing) is installed automatically via `npm install` as a native Node.js addon — no system package needed.

---

## Known Limitations

- **No authentication** — all files are visible to anyone with access to the server. Add middleware before deploying publicly.
- **Local filesystem only** — files live on disk next to the app. For multi-instance or cloud deployments, replace `src/lib/storage.ts` with an S3/GCS adapter.
- **FFmpeg / Ghostscript / qpdf not bundled** — must be installed separately. The app detects absence gracefully and marks affected files `unsupported`.
- **No background job queue** — optimization runs in `setImmediate` on the upload request. For large files or high concurrency, use a proper queue (e.g. BullMQ) in production.
- **500 MB upload cap** — configurable in `next.config.ts` via `experimental.serverActions.bodySizeLimit`.
- **Text preview capped at 50 000 characters** — large files are truncated in the preview modal; the full file is always available for download.
