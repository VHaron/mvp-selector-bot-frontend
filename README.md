# MVP Tournament Selector — Frontend

## Development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

Deploy this folder as the Vercel project root. The existing backend URL is configured in `src/constants.ts`.

## Source structure

- `src/App.tsx` — application orchestration, state, data loading and search workflow.
- `src/components/LoginPanel.tsx` — login, two-factor verification and GlobusGo/GlobusMVP account selection.
- `src/components/GridPanel.tsx` — tournament grid view and room grouping.
- `src/components/DiaryPanel.tsx` — bankroll, calendar and session history.
- `src/components/TournamentGridCard.tsx` — reusable tournament card in the grid. Clicking the card toggles it in/out of the grid; the note button is independent.
- `src/components/RoomBadge.tsx`, `SmartTimer.tsx` — shared UI elements.
- `src/services/api.ts` — backend request helper and timeout handling.
- `src/store/filterStore.ts` — Zustand state for numeric filters.
- `src/types.ts`, `src/constants.ts`, `src/utils.ts` — shared types, room metadata and pure helpers.

The refactor keeps the existing API contract and local-storage keys.
