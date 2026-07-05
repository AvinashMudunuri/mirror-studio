# AGENTS.md

## Cursor Cloud specific instructions

### Repository state (read this first)
`mirror-studio` is an early **foundation-stage** npm-workspaces monorepo (`turbo`). The `README.md` describes an aspirational full stack (`apps/web`, `apps/api`, many `packages/*`), but **only two packages actually exist**:

- `packages/schemas` (`@mirror/schemas`) — **complete and working**. Zod schemas + TS types. Deps: `zod`, `typescript`.
- `packages/agents` (`@mirror/agents`) — **incomplete/pre-alpha**. Do not expect it to build or install.

There are **no** `apps/`, no runnable server/frontend, no test suites, and no lint config.

### Known blocker: root `npm install` and root `turbo` fail
`packages/agents/package.json` declares a dependency on `@mirror/memory@*`, but **no such package exists** (neither in the workspace nor on npm), so a root `npm install` fails with `E404 @mirror/memory`. `packages/agents` also imports `uuid` without declaring it and its `tsconfig.json` references a non-existent `../memory`. This is expected for the current foundation phase (README roadmap lists "Memory systems" as not done). Do **not** try to "fix" this as part of environment setup — it is real feature work, not a setup issue.

Consequence: `npm run dev|build|lint|test` at the repo root (all delegate to `turbo`) do not work, because `turbo` itself can't be installed via the blocked root install.

### How to work with the one complete package (`@mirror/schemas`)
Install it in isolation, bypassing the broken workspace graph (this is what the startup update script does):

```bash
npm install --no-workspaces --prefix packages/schemas
```

Then run its scripts from inside the package dir:

```bash
cd packages/schemas
npm run build          # tsc -> dist/ (CommonJS + .d.ts)
npm run dev            # tsc --watch
./node_modules/.bin/tsc --noEmit   # typecheck only
```

Gotchas:
- Do **not** use `npx tsc` here — with no local resolution it pulls a bogus `tsc@2.0.4` shim from the registry. Use the npm script (`npm run build`) or `./node_modules/.bin/tsc` directly.
- The build output is CommonJS, so it can be exercised from Node with `require('.../packages/schemas/dist/index.js')`.

### Lint / test
No package defines a `lint` or `test` script and there is no ESLint/Jest/Vitest config anywhere. `turbo run lint|test` would be no-ops even if `turbo` installed. The meaningful correctness check for `@mirror/schemas` is `tsc` (build / `--noEmit`) plus running its Zod schemas against sample data.

### Node toolchain
Node 22 / npm 10 are preinstalled and satisfy `package.json` `engines` (`node >=20`, `npm >=10`). No `.nvmrc`/Volta pin is committed.
