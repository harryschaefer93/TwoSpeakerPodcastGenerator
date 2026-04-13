# PodcastGen — Frontend

React + Vite + TypeScript SPA for the PodcastGen API. See the [root README](../README.md) for full project docs.

## Development

```bash
npm install
npm run dev   # Vite dev server on port 5173, proxies API to Express on port 3000
```

## Components

| Component | Purpose |
|---|---|
| `ScriptGenerator` | Form for topic/title/tone/duration → `POST /scripts/generate` |
| `ScriptEditor` | Per-turn cards with inline editing, add/remove/reorder |
| `SynthesisPanel` | Intro/outro music URLs, start button, progress polling |
| `AudioPlayer` | HTML5 player + download link on completion |
| `EpisodeHistory` | List of past episodes with status badges |

## API Client

`src/api.ts` wraps all three API endpoints with typed request/response interfaces.

## Build

```bash
npm run build   # production build → dist/
```

The Express server serves `client/dist/` as static files in production.
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
