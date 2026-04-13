# Copilot Instructions — PodcastGen

## Build & Run

### API server (root)

```bash
npm run dev          # start with tsx watch (hot reload) on port 3000
npm run build        # tsc → dist/
npm start            # run compiled dist/index.js
```

### React frontend (`client/`)

```bash
cd client
npm run dev          # Vite dev server with HMR, proxies /scripts and /episodes to Express on port 3000
npm run build        # production build → client/dist/
```

During development, run both the API server and the Vite dev server. The Vite proxy forwards API routes to Express so there are no CORS issues in dev.

No test runner or linter is configured yet.

## Architecture

PodcastGen has two layers: an **Express 5 API** (root) and a **React + Vite + TypeScript frontend** (`client/`).

### Frontend (`client/`)

A Vite + React + TypeScript SPA. Vite's dev server proxies `/scripts` and `/episodes` to the Express API. The UI is a step-based workflow:

1. **Script generation** — form with topic/title/tone/duration, calls `POST /scripts/generate`
2. **Visual script editor** — per-turn cards with speaker labels and inline text editing; supports add, remove, and reorder
3. **Synthesis panel** — optional intro/outro music URLs, start button, polls `GET /episodes/:id` for live progress (Queued → Synthesizing → Stitching → Completed/Failed)
4. **Audio player** — HTML5 player + download link on completion
5. **Episode history** — list of past episodes with status badges, click to view/replay

Key frontend conventions:
- Typed API client in `client/src/api.ts` wrapping all three API endpoints
- Components in `client/src/components/`
- No CSS framework assumed — style with CSS modules or plain CSS

### API (Express backend)

Produces podcast episodes through a multi-step async pipeline:

1. **Script generation** (`POST /scripts/generate`) — calls Azure OpenAI chat completions to produce `Speaker A` / `Speaker B` dialogue. Falls back to a deterministic template when AI credentials are missing.
2. **Episode creation** (`POST /episodes`) — accepts an approved script, returns `202` immediately, and kicks off the pipeline in the background (fire-and-forget `void` promise).
3. **Pipeline** (`podcastPipeline.ts`) — chunks the script → builds SSML per chunk → submits each chunk as a Speech Batch synthesis job → polls until done → downloads result ZIPs → extracts audio → normalises and concatenates with ffmpeg → uploads final MP3 to Blob Storage.
4. **Status polling** (`GET /episodes/:id`) — reads from a local JSON file store (`data/episodes.json`). Status progresses: `Queued → Synthesizing → Stitching → Completed | Failed`.

### Key service boundaries

| Module | Responsibility |
|---|---|
| `speechBatchClient.ts` | REST calls to Azure Speech Batch API with exponential-backoff retry (handles 408/429/5xx) |
| `ssml.ts` | Builds SSML; multi-talker `<mstts:dialog>` mode or two-voice fallback |
| `chunker.ts` | Splits turns into chunks ≤ 3 600 chars (text + 40-char overhead per turn) |
| `stitcher.ts` | ffmpeg normalisation (mono, 24 kHz, PCM) → concat → MP3 encode at 96 kbps |
| `storage.ts` | Blob download/upload via `@azure/storage-blob`; uses DefaultAzureCredential (no SAS tokens) |
| `identity.ts` | Singleton `DefaultAzureCredential` and bearer-token acquisition for Cognitive Services |
| `episodeStore.ts` | Read/write `data/episodes.json`; no database |
| `auth.ts` | Express middleware; supports `none`, `api-key`, `jwt`, `api-key-or-jwt` modes |

## Conventions

- **TypeScript strict mode**, ES2022 target, NodeNext module resolution. All imports use `.js` extensions (required by NodeNext).
- **No classes** — the codebase uses plain functions and object literals (`episodeStore` is an object with async methods, not a class).
- **Config is centralised** in `config.ts` via `dotenv`. Every env var has a sensible default except the two checked by `assertSpeechConfig()`: `SPEECH_ENDPOINT`, `OUTPUT_CONTAINER_URL`.
- **Zod** validates all request bodies at the route level in `index.ts`.
- **Error pattern**: pipeline errors are caught and written to the episode record's `error` field; they don't crash the server.
- **SSRF protection** in `stitcher.ts`: remote intro/outro URLs must be `https://`, cannot target private/loopback IPs, and are checked against `MEDIA_ALLOWED_HOSTS` when set.
- **No test infrastructure exists** — `manifest.json` lists "Add automated tests and CI pipeline" as a todo item.

## Work Tracking

When completing a feature or significant change:

- **`manifest.json`** — move the item from `todo` to `done` (or add a new `done` entry). Update `updatedAt` to today's date.
- **`README.md`** — keep the Architecture section, Environment section, and Run locally instructions in sync with any new modules, env vars, or commands.

These two files are the project's source of truth for what's been built and what's left.

## Prerequisites

- Node.js 22+
- `ffmpeg` in PATH (the devcontainer installs it automatically)
- Azure Speech resource + Blob Storage container with a SAS URL
