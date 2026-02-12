# Find a Spark - MVP Implementation Plan

## Summary
Build a ChatGPT app named **find a spark** that:
1. Uses a local synthetic profile dataset to find top 3 matches.
2. Shows interactive compatibility visuals in an iframe widget.
3. Lets the user accept one match, which triggers one write action.
4. Stops after acceptance (handoff point). For MVP, no in-app date planning beyond that.

This plan is for a hackathon MVP and uses the current Apps SDK + MCP template in this repo.

## Product Flow
1. User asks ChatGPT to find a match.
2. ChatGPT calls `spark-find-matches` (read-only).
3. Match results widget renders:
- Top 3 candidates
- Compatibility score bars
- Skill/trait graph
- Short natural-language match reasons
4. User chooses one candidate and clicks `Accept`.
5. Widget calls `spark-accept-match` (write action).
6. ChatGPT confirms acceptance; flow is complete.

## Scope Decisions (Locked)
- App name: `find a spark`.
- No post-acceptance planner workflow in MVP.
- Accept action is a write operation and marks the terminal point of the MVP experience.
- Matching model policy: `gpt-5.2` with **low reasoning**, **no temperature parameter**.
- Data source: local synthetic profiles only (5 profiles to start).

## Architecture in This Repo

### Backend (MCP tools)
Add:
- `tools/spark-find-matches.ts`
- `tools/spark-accept-match.ts`

Update:
- `tools/index.ts` to register both tools.

### Data layer
Add:
- `data/profiles.json` (5 synthetic profiles)
- `data/user-map.json` (maps current viewer identity to a profile id for demo use)
- `utils/data-store.ts` (load and validate local JSON data)

### Widget UI
Add:
- `ui/spark-match-results/index.tsx`
- `ui/spark-match-results/types.ts`
- `ui/spark-acceptance/index.tsx`
- `ui/spark-acceptance/types.ts`

Use existing build pipeline (`build-all.mts`) by following the existing `ui/**/index.tsx` entry pattern.

### Metadata compatibility
Keep existing template behavior and add MCP Apps standard compatibility where needed:
- Use `_meta.ui.resourceUri` on tool descriptor metadata.
- Keep `_meta["openai/outputTemplate"]` for ChatGPT compatibility.

## Tool Contracts

### 1) `spark-find-matches` (read-only)
Purpose: rank and return top 3 matches for the active viewer.

Input:
- `viewerProfileId?: string` (optional override)
- `maxResults?: number` default `3`, max `3` for MVP

Output `structuredContent`:
- `matchSessionId: string`
- `viewerProfile: { id, displayName }`
- `matches: Array<{ profileId, displayName, overallScore, breakdown, reasons }>`

Notes:
- The model computes compatibility ranking and explanations.
- Return concise, idempotent structured content for retries.

### 2) `spark-accept-match` (write action)
Purpose: persist acceptance event and finish flow.

Input:
- `matchSessionId: string`
- `viewerProfileId: string`
- `selectedProfileId: string`

Output `structuredContent`:
- `status: "accepted"`
- `acceptedAt: string` (ISO timestamp)
- `viewerProfileId: string`
- `selectedProfileId: string`
- `nextStep: "handoff_to_dating_app"`

Write side effect:
- Append acceptance record to local store (for MVP) such as `data/accepted-matches.json`.

## Model and Prompting Plan
- Model: `gpt-5.2`
- Reasoning: `low`
- Temperature: **not set** (must not be sent)
- Use strict structured output schema for ranking payload to keep UI deterministic.
- Keep prompts focused on:
  - compatibility rationale
  - constructive explanations
  - concise output fields for UI rendering

## 5 Synthetic Profiles (Initial Dataset)
Create exactly 5 synthetic profiles in `data/profiles.json` with fields:
- `id`
- `displayName`
- `ageRange`
- `city`
- `interests` (array)
- `values` (array)
- `communicationStyle`
- `lifestyle`
- `relationshipIntent`
- `dealBreakers` (array)

Example starter set:
1. `alex-chen` - design, climbing, live music, direct communicator.
2. `maya-rivera` - art fairs, brunch, travel, warm/expressive communicator.
3. `noah-patel` - cooking, board games, hiking, thoughtful communicator.
4. `zoe-kim` - startup events, pilates, indie films, playful communicator.
5. `liam-brooks` - photography, jazz, museums, calm communicator.

## UX Plan (Widget Screens)

### Hero Treatment (UI + Frontend Style)
- Emotional goal: evoke hope, excitement, calm trust, and sunset beauty.
- Visual composition:
  - Full-width hero header on the match results screen.
  - Headline: `"A new spark is waiting."`
  - Supporting line: short reassuring copy about discovering meaningful matches.
- Background:
  - Animated sunrise-sunset gradient: `#FFC46B -> #FF8A8A -> #FF6B9D` on warm base `#FFF6EC`.
  - Soft ambient light particles moving slowly to create anticipation without visual noise.
- Foreground container:
  - Glass-style hero panel with soft blur and high readability.
  - Trust-focused text color `#23395B` and optimism accent `#5FD3BC`.
  - Large rounded corners (`20-24px`) and gentle shadow.
- Motion behavior:
  - Hero fades and rises in on load (`~320ms`).
  - Match cards reveal with stagger (`~90ms` gap) and spring pop (`0.96 -> 1` scale).
  - Keep motion smooth and restrained to preserve calm feeling.
- Frontend implementation notes:
  - Use `framer-motion` for hero entrance and staggered children.
  - Define hero colors/timings as CSS variables for easy theme tuning.
  - Implement ambient particles with lightweight CSS/SVG animation (no heavy canvas dependency).
  - Maintain strong contrast and responsive layout for mobile and desktop.

### Screen A: Match Results
- Hero title: "Find a spark"
- Top 3 cards with:
  - overall score ring
  - compatibility bars (values, lifestyle, communication, humor, curiosity)
  - short natural-language explanation
- CTA per card: `Accept`

### Screen B: Acceptance Confirmation
- Friendly confirmation view:
  - selected match
  - acceptance status
  - timestamp
  - "Next step handled by dating app" message
- No additional planning controls in MVP.

## Validation Checklist
1. Types:
- `pnpm exec tsc -p tsconfig.app.json --noEmit`
- `pnpm exec tsc -p tsconfig.node.json --noEmit`
- `pnpm exec tsc -p tsconfig.mcp.json --noEmit`
2. Assets:
- `pnpm run build`
3. Tool behavior:
- `spark-find-matches` returns exactly 3 entries.
- `spark-accept-match` writes acceptance record and returns `status: accepted`.
4. Widget behavior:
- Results screen renders structured content correctly.
- Accept action fires write tool call and transitions to confirmation screen.

## Delivery Sequence
1. Add data files and validation utilities.
2. Implement `spark-find-matches`.
3. Implement match results widget with interactive visuals.
4. Implement `spark-accept-match` write action.
5. Implement acceptance confirmation widget.
6. Run type checks and production build.
7. Demo in ChatGPT connector flow.

## Assumptions
- Internal hackathon demo only.
- Small dataset (5 profiles) is sufficient for full-LLM matching pass.
- No external dating app API integration in MVP; handoff is represented by write confirmation.
