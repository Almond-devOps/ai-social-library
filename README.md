# AI Social Post Generator & Library

Generate AI images from a text prompt, and automatically store them —
durably and with verifiable provenance — in a searchable library. Built for
content creators who generate a lot of AI images and constantly lose track
of prompts, versions, and files.

## What it does

1. You type a prompt describing the image you want.
2. The app generates it using **Genblaze** (Backblaze's open-source Python
   SDK), which calls **GMI Cloud**'s image models.
3. Genblaze stores the generated image, plus a SHA-256-verified provenance
   manifest, directly to your **Backblaze B2** bucket — durable,
   tamper-evident, and never lost.
4. The library view shows every image you've ever generated, along with its
   original prompt, pulled live from B2.

## How it uses Genblaze and B2

- **Genblaze** orchestrates the actual generation: it calls GMI Cloud's
  image models through a single `Pipeline` API, and — as part of the same
  call — uploads the resulting asset and a cryptographically verifiable
  provenance manifest to B2 via its built-in `ObjectStorageSink` /
  `S3StorageBackend.for_backblaze(...)` integration. This is the "prompt to
  pipeline to durable storage" flow in one step.
- **Backblaze B2** is the storage backend Genblaze writes to. We also write
  a small app-controlled metadata file (prompt, model, asset URL) alongside
  each Genblaze run, so our gallery UI has a simple, predictable structure
  to read from when building the library view.

## Architecture

- **Frontend:** Next.js (React), deployed on Vercel
- **`/api/generate`:** a Python serverless function (Genblaze is
  Python-only) that runs the Genblaze pipeline and stores the result to B2
- **`/api/library`:** a Next.js API route that lists generated images from
  B2 for the gallery view

## Providers and models used

- **Genblaze** (`genblaze`, `genblaze-gmicloud`) — pipeline orchestration
  and provenance
- **GMI Cloud** — image generation provider (e.g. `seedream-5.0-lite`)
- **Backblaze B2** — durable object storage for generated assets and
  metadata

## Setup instructions

### 1. Create accounts and get API keys

- **Backblaze B2:** create an account, create a bucket, and create an
  Application Key scoped to that bucket with read/write file permissions.
- **GMI Cloud:** sign up and get an API key from
  [console.gmicloud.ai](https://console.gmicloud.ai/).

### 2. Clone the repo

```bash
git clone https://github.com/<your-username>/ai-social-library
cd ai-social-library
```

### 3. Set up environment variables

Copy `.env.local.example` to `.env.local` and fill in your real values:

```bash
cp .env.local.example .env.local
```

```
GMI_API_KEY=your_gmi_cloud_key
B2_KEY_ID=your_b2_key_id
B2_APP_KEY=your_b2_application_key
B2_BUCKET=your_bucket_name
B2_REGION=your_bucket_region   # e.g. us-west-004
```

### 4. Install dependencies

```bash
npm install
pip install -r requirements.txt
```

### 5. Run locally

```bash
vercel dev
```

(Using `vercel dev` instead of `next dev` ensures the Python API function
runs correctly alongside the Next.js frontend, matching production.)

Open [http://localhost:3000](http://localhost:3000), enter a prompt, and
generate your first image.

### 6. Deploy to Vercel

1. Push this repo to GitHub.
2. Import it into [Vercel](https://vercel.com/new).
3. Add the same environment variables (`GMI_API_KEY`, `B2_KEY_ID`,
   `B2_APP_KEY`, `B2_BUCKET`, `B2_REGION`) in the Vercel project's
   **Settings → Environment Variables**.
4. Deploy. Vercel will automatically build both the Next.js frontend and
   the Python serverless function.

## License

MIT License — see `LICENSE` file.
