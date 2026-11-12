# Frontend architecture refactor

## Main entry
- `src/App.tsx` is now a small composition root: it creates the controller and renders the application layout.

## Application controller
- `src/hooks/useAppController.tsx` owns application state and workflows: authentication (including automatic site selection and MFA), tournament loading/filter state, grid actions, notes, session history, bankroll, persistence, and derived models.
- Existing focused hooks remain separate: `useCalendar`, `useTournamentGridModel`, and `useTournamentSearchModel`.

## Application layout
- `src/components/AppLayout.tsx` owns the authenticated/login layout and composes the existing focused UI components (`LoginPanel`, `GridPanel`, `DiaryPanel`, tournament cards, and filter modal).
- Existing leaf components and API service are preserved.

## Compatibility intent
- No backend routes or request payloads were intentionally changed.
- Existing dual-site login flow, site selection, MFA flow, local session keys, and user data persistence remain in the controller.
- Room IDs and room definitions remain in `src/constants.ts`.

## Validation
- The TypeScript compiler was invoked, but a full build could not complete because dependencies are missing from `node_modules` (`vite/client`, `node`, React and other packages). Attempts to restore dependencies with `npm ci` timed out while accessing the npm registry.
- A successful production build and live authentication test have therefore **not** been claimed. Run `npm ci` and `npm run build` in an environment with npm registry access before deployment.
