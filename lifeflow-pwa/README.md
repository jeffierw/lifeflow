# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
# Agent V1

The execution screen now uses server-owned sessions rather than a browser-only
step index. Plans can be adjusted by a single tool-calling agent; changes are
stored as proposals and require explicit approval in the interface.

## Local Setup

Use Node.js 20 or later. Install dependencies in both `lifeflow-pwa` and
`lifeflow-worker` with `npm ci`.

In `lifeflow-worker`, create a local `.dev.vars` file (never commit it) containing
`JWT_SECRET` and `OPENAI_API_KEY`. The model endpoint must support Chat Completions
function tools. Override `OPENAI_BASE_URL` and `MODEL_NAME` for your own provider.
The repository's default endpoint is not required for this implementation.

Initialize the legacy tables and apply the additive execution migration locally:

```sh
npx wrangler d1 execute lifeflow --local --file=schema.sql
npm run db:migrate
npm run dev
```

In `lifeflow-pwa`:

```sh
VITE_API_BASE=http://localhost:8787 npm run dev
```

Use an existing local account or seed a local invitation through the existing
invitation flow. No authentication bypass or demo data fallback is shipped.

## Execution Contract

- Opening a saved SOP restores its active session, or starts one if none exists.
- Starting a step requires all dependencies to be completed.
- Completion is an explicit user action, never inferred from elapsed time.
- Pause preserves progress. Timers retain real wall-clock deadlines while paused.
- A plan proposal replaces only pending steps. Running, completed, and skipped
  steps retain their IDs, timestamps, and timers.
- Every mutation checks ownership, request ID, and execution revision.
- D1 triggers atomically write the operation record and update the snapshot.
- A duplicate operation ID replays its outcome; stale proposals are rejected.
- Editing the SOP library does not change an already active execution snapshot.
- Finishing stops timers without claiming unfinished steps are complete.

The agent can read execution state, propose a plan change, and create a timer
with explicit authorization. It cannot approve its own proposal or mark work
complete. The timer tool currently requires an exact request such as
`给第1步计时5分钟`; arbitrary conversational timer requests may require using
the timer controls instead.

Each turn is limited to four model calls, eight tool calls, and 60 seconds.
An interrupted turn may have already saved a draft or an authorized timer:
refresh and inspect state before trying again. Chat text is session-local;
execution facts, timers, and proposals are durable. The current snapshot retains
five recent proposal previews; the operation log retains the full change history.

## Deployment And Limits

Apply `migrations/001_execution.sql` before deploying the Worker. The command
`npm run db:migrate:remote` changes production data and must only be run with
explicit deployment approval. Existing SOP tables are not replaced.

This version targets cooking tasks. It does not include device control,
background notifications, autonomous scheduling, shopping, or multi-agent
coordination. Critical-path estimates do not account for resource contention
or guarantee completion before a deadline.

Speech uses browser APIs. Recognition pauses during playback to avoid self-triggered
commands; uninterrupted full-duplex audio is not promised. Real microphone behavior,
mobile browser permissions, and live-provider tool compatibility require testing
on the intended devices and provider.

Production credentials and remote migrations are not needed for deterministic
local fixture verification. Fixture replies validate application wiring, not
real model reasoning quality.
