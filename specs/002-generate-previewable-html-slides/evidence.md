# Evidence: Generate Previewable HTML Slides

## Scope

This file records implementation and verification evidence for feature 002.

## T001-T021 Scaffold Evidence

- Monorepo scaffold created for `apps/web`, `apps/api`, `packages/domain`, `packages/contracts`, and `tests/fixtures`.
- Shared contracts, domain model types, planner boundaries, API controller/module skeletons, and React feature shell are present.
- No US1 behavior, tests, renderer implementation, persistence, publishing, upload, PPTX export, full editor, or revision loop has been introduced.

## Verification Log

### 2026-05-31 - T001-T021

- `check-prerequisites.sh --json --require-tasks --include-tasks` did not complete because the repository has no initial commit yet, so Git reports `HEAD` as an ambiguous revision and the script cannot validate the feature branch.
- Requirements checklist has no unchecked items.
- `python3 -m json.tool` passed for root/workspace package manifests, TypeScript configs, fixture JSON files, and `packages/contracts/schemas/slide-generation.schema.json`.
- Verified T001-T021 are marked complete in `tasks.md`.
- Verified T022-T027 remain unstarted, so US1 work has not begun.
- Automated behavior tests were not run because this slice only creates scaffold and dependencies have not been installed.

### 2026-05-31 - Package Manager Decision

- Package manager set to pnpm `10.30.3`.
- Workspace membership is defined in `pnpm-workspace.yaml` for `apps/*` and `packages/*`.
- Root test scripts use `pnpm --filter` so package-level tests can run independently.
- `pnpm install` completed and generated `pnpm-lock.yaml`.
- pnpm reported ignored build scripts for `@nestjs/core` and `esbuild`; no interactive approval was applied during this scaffold step.
- `pnpm --filter @slides-agent/contracts build`, `pnpm --filter @slides-agent/domain build`, `pnpm --filter @slides-agent/api build`, and `pnpm --filter @slides-agent/web build` passed.
- `pnpm run lint` passed.
- `pnpm run format` passed after excluding generated Spec Kit/skill artifacts from Prettier scope.

### 2026-05-31 - Import Alias Decision

- Local workspace imports use `@/*` to point to that workspace package's own `src/*`.
- Cross-package imports remain explicit as `@slides-agent/contracts` and `@slides-agent/domain`.
- Vite is configured with the same `@` alias for the web app.
