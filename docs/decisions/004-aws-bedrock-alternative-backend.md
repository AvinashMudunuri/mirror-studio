# ADR 004: AWS Bedrock as an alternative backend for Claude calls

**Status:** Accepted (2026-07-08) — implemented same session.

## Context

Every agent calls Claude through `LLMGateway.callClaude()`
(`packages/agents/src/llm-gateway.ts`), which until now always went
straight to the Anthropic API via the `@anthropic-ai/sdk` `Anthropic`
client, authenticated with `ANTHROPIC_API_KEY`. The user asked for an
alternative: AWS Bedrock, which hosts the same Claude models behind AWS's
own API and IAM-based authentication instead of an Anthropic API key —
useful for teams standardizing on AWS billing/IAM/VPC controls, or who
already have Bedrock access provisioned.

Researched the official `@anthropic-ai/bedrock-sdk` (the same team that
publishes `@anthropic-ai/sdk`) before implementing, to avoid assuming
parity that doesn't exist:

- Its `AnthropicBedrock` client is a thin wire-format adapter over the
  same `BaseAnthropic` class `Anthropic` extends — `.messages.create()`
  takes the same request shape and returns the same response shape for
  non-streaming calls (all this gateway ever makes). It only rewrites the
  URL/auth (SigV4-signs with AWS credentials instead of a bearer token)
  and reframes the wire format for **streaming**, which is irrelevant here.
- **Adaptive thinking (`thinking: { type: 'adaptive' }`, `output_config:
  { effort }`) works as top-level request fields on Bedrock too**, not
  behind an `extra_body` escape hatch — that requirement only applied to
  older SDK versions before these fields were promoted out of beta.
- **Prompt caching (`cache_control`) is fully supported end-to-end on
  Bedrock.** The published SDK deletes a legacy `beta.promptCaching`
  helper resource with a stale doc comment claiming caching isn't
  supported — an Anthropic maintainer confirmed
  (`anthropics/anthropic-sdk-typescript` #628) this is dead code left over
  from before caching was GA; the standard `.messages.create()` path (what
  this gateway uses) supports it identically to the direct API, confirmed
  independently by AWS's own Bedrock prompt-caching docs. This matters a
  lot here specifically: PR #23 built prompt caching into the review board
  (`review-context.ts` + `LLMSystemBlock`) as a real cost optimization —
  switching to Bedrock does not have to give that up.
- **Model ID strings differ and are account/region-specific.** The direct
  API's `claude-sonnet-5` becomes something like
  `us.anthropic.claude-sonnet-5` (or another cross-region inference-profile
  prefix) on Bedrock, and many current models require an inference-profile
  ID rather than a bare on-demand model ID. These are not portable across
  accounts/regions, so hardcoding a mapping table would go stale or be
  outright wrong for a given account. `isClaudeFiveOrNewer()`'s substring
  matching (`model.includes('claude-sonnet-5')`) still works against
  Bedrock-style IDs since the recognizable substring is embedded in them.
- **AWS credentials default to the standard provider chain** (env vars,
  `~/.aws/credentials`, IAM role) when no explicit keys are passed to
  `AnthropicBedrock`, the same pattern every AWS SDK uses — no custom
  credential-plumbing code was needed.

## Decision

1. **Add `@anthropic-ai/bedrock-sdk` as a new dependency of
   `@mirror/agents`**, alongside (not replacing) `@anthropic-ai/sdk`.
2. **`LLMGateway` gains a `claudeBackend: 'anthropic' | 'bedrock'` config
   field** (default `'anthropic'`, overridable via `CLAUDE_BACKEND` env
   var through `LLM_CONFIG.claude.backend` in `config.ts`) and an optional
   `bedrock: { region, accessKeyId, secretAccessKey, sessionToken }` block
   for explicit AWS credential overrides — all optional, since the default
   provider chain is the recommended path.
3. **`callClaude()` picks whichever client is configured** (`this.anthropic`
   or `this.bedrockClient`, via a `claudeClient` getter) and otherwise runs
   the exact same request-building, retry/truncation, and usage-accounting
   logic for both — no backend-specific branching beyond client selection
   and construction, since the request/response shapes are identical.
4. **No model ID mapping table.** Model selection already goes through
   per-agent env var overrides (`getAgentModel()` in `config.ts`); using
   Bedrock just means setting those env vars to Bedrock-flavored IDs
   instead of direct-API names. Documented prominently (README, `.env.example`,
   `mirror-pipeline` skill) rather than guessed at in code, since the
   correct ID is genuinely account/region-dependent.
5. **`scripts/create-real-episode.js`'s Step 0 prerequisite check** is
   conditional on `CLAUDE_BACKEND`: it only hard-requires
   `ANTHROPIC_API_KEY` for the `anthropic` backend; for `bedrock` it logs
   which AWS credential source will be used and lets the SDK's own
   provider chain resolve auth (failing at call time with a clear AWS
   error if credentials are genuinely missing, same UX as a bad API key
   today).

## What we deliberately did NOT build

- **A hardcoded Claude-name → Bedrock-model-ID mapping.** Bedrock IDs vary
  by account, region, and inference-profile availability, and change as
  new models ship — a mapping baked into this repo would inevitably go
  stale or be wrong for someone else's account. Existing per-agent model
  env vars already solve this generically.
- **Bumping the direct `@anthropic-ai/sdk` dependency.** It stays at
  `^0.32.1`; `@anthropic-ai/bedrock-sdk` brings its own compatible nested
  copy for the Bedrock client. The existing direct-API path is untouched.
- **Streaming support for either backend** — this gateway has never used
  streaming; Bedrock's wire-format adaptation for streaming is therefore
  irrelevant here and wasn't evaluated.
- **A runtime capability probe/fallback between backends** — the backend
  is a static config choice per gateway instance (one pipeline run uses
  one backend), not a per-call failover. Automatic failover would hide
  cost/latency differences that matter for the token-budget accounting
  this pipeline already leans on heavily.

## Verification

No AWS credentials are available in this environment (cloud agent sandbox
has no AWS secrets configured), so this could only be verified against a
**mocked** `AnthropicBedrock` client, not a real Bedrock call — see
`tests/unit/llm-gateway-bedrock.test.ts`, which mirrors the existing
Anthropic-backend test suite (adaptive thinking headroom, retry/truncation,
usage accounting, prompt caching) against the Bedrock code path, and a type
-check/build pass confirming `AnthropicBedrock`'s actual TypeScript types
accept the request shape this gateway sends. Live end-to-end verification
against real AWS Bedrock needs a real AWS account with Bedrock model access
enabled and requires a human to add `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`
(or equivalent) as secrets before a cloud agent could run it for real.

## Revisit

If/when this is exercised against a real AWS account, confirm empirically
(via `cache_creation_input_tokens`/`cache_read_input_tokens` in the
manifest) that prompt caching is actually paying off for the specific
models/regions in use — the SDK-level support is confirmed, but real
savings depend on AWS's model-specific minimum-token-per-checkpoint
thresholds and cache TTL availability, which were flagged as evolving
quickly alongside new model releases during research for this ADR.
