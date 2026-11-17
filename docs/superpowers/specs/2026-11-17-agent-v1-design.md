# LifeFlow Agent V1 Design

## Intent

Turn the existing SOP generator and execution chat into a single task agent
that reads authoritative execution state, proposes changes to unfinished work,
and applies only the exact change the user has approved.

The architecture was approved in chat. The V1 scope below is proposed for
implementation-plan review; no production implementation is included yet.

## Approaches

- Keep prompt-only chat: inexpensive, but cannot reliably change execution state.
- Single agent with controlled tools and a deterministic execution engine:
  recommended and accepted as the architectural direction in chat.
- Multiple specialist agents: deferred because coordination does not resolve
  the existing state, validation, and recovery problems.

## Scope

Retain React, Zustand, Cloudflare Workers, D1, and the configured OpenAI-compatible
provider. Start with cooking as the supported domain and label that scope honestly.
Do not rebuild the application or introduce a new agent hosting platform.

V1 includes:

- Explicit generation failures instead of mock SOP substitution.
- Validated plans and conservative voice commands.
- Persisted execution sessions, progress, timestamps, and timers.
- Bounded model tool calls against server-owned state.
- Versioned change proposals with a preview and explicit accept/reject actions.
- Atomic application, duplicate-request protection, and operation history.
- Browser-visible overdue timers; no automatic step completion.

Deferred: background notifications while the app is closed, reliable scheduled
agent runs, device integration, shopping, long-term preference inference,
multi-agent orchestration, and resource-aware schedule optimization.
Estimated times are estimates, not guarantees or food-safety decisions.

## State And Trust

D1 is authoritative. Zustand is a UI cache. Each execution has a revision,
an immutable source SOP reference, a plan snapshot, step states, timers, and
an execution status. Editing a library SOP does not mutate an active execution.

Steps have stable IDs, dependencies, duration, description, and status.
Only pending steps may be replaced by a proposal. Completed, skipped, and
running steps are preserved, including timestamps and timers.
Dependencies must exist and form an acyclic graph. Only completed dependencies
permit a step to start; skipping a prerequisite does not silently satisfy it.

Every authenticated request checks ownership. Mutations include a request ID
and expected revision. The state update and event append occur atomically.
Repeated successful request IDs return their recorded outcome without a second
mutation. Stale revisions return a conflict and the UI reloads authoritative state.

## Agent Boundary

The agent has read_execution, propose_plan_change, and create_timer tools.
Timer creation requires an explicit user request and a validated step ID and
duration. Applying a proposal and completing a step are authenticated UI
commands, not tools exposed to the model.

The model receives server-generated system instructions and server-owned task
state. Client history is restricted to bounded user/assistant text.
Each turn allows at most four model calls, eight tool invocations, and a
60-second overall deadline. Tool errors become tool results; limit exhaustion
returns an explicit non-success outcome.

Proposals contain the execution revision, rationale, candidate pending steps,
and a deterministic before/after summary. Validation runs before storage and
again before application. Approval references the proposal ID, never a fresh
model-generated plan. Application consumes the pending proposal atomically.

## Interface

Keep the current execution route. Restore or create an execution session,
show pending/running/completed work, and display timers from persisted timestamps.
Pause/resume does not reset progress. Synchronize on refresh and tab focus.

Execution chat shows replies and pending proposal previews. A preview identifies
added/removed/changed steps and estimated-time changes, with confirm and reject
controls. Disable mutation controls while submitting; retain server-side
idempotency because UI disabling alone is insufficient.

## Acceptance

A user can start a saved SOP, complete a step, request a change in conditions,
review and approve a proposal, and refresh without losing progress.
The revised plan preserves completed/running work. Cross-user access fails,
stale proposals cannot overwrite newer state, duplicate approval does not apply
twice, and model/network errors leave the original plan unchanged.

## Deployment

Use additive D1 migrations. Test against a local database before any deployment.
Do not run remote migrations, push commits, or deploy without a separate request.
Keep provider credentials outside source control.
