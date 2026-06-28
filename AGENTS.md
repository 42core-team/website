# Agent Guide - Website Relaunch

This repository is a monorepo containing multiple services. Please follow these guidelines when working on this codebase.

## Project Structure

- `api/` - NestJS API service (TypeScript)
- `frontend/` - Next.js frontend application (TypeScript)
- `github-service/` - Effect + Bun service for GitHub integration (TypeScript)
- `k8s-service/` - Kubernetes management service (Go)

## 1. Build, Lint, and Test Commands

### General
- Package Manager: `pnpm` is used for `api/` and `frontend/`; `github-service/` uses Bun (`bun.lock`).
- Go: Standard Go toolchain (1.26+) and `make`.

### `api/` (NestJS)
*   **Build:** `pnpm build` (Runs `nest build`)
*   **Lint:** `pnpm lint` (Runs `eslint`)
*   **Format:** `pnpm format` (Runs `prettier`)
*   **Run Dev:** `pnpm start:dev`
*   **Test:** `pnpm test` (Runs `jest`)
*   **Run Single Test:**
    ```bash
    # Run a specific test file
    npx jest src/path/to/file.spec.ts
    
    # Run a specific test case by name
    pnpm test -- -t "should do something"
    ```

### `github-service/` (Effect + Bun)
*   **Build:** `bun run build`
*   **Lint:** `bun run lint`
*   **Format:** `bun run format`
*   **Run Dev:** `bun run start:dev`
*   **Test:** `bun run test`
*   **Run Single Test:**
    ```bash
    # Run a specific test file
    bun test src/path/to/file.test.ts

    # Run a specific test case by name
    bun test -t "should do something"
    ```

### `frontend/` (Next.js)
*   **Build:** `pnpm build` (Runs `next build`)
*   **Dev:** `pnpm dev`
*   **Lint:** `pnpm lint`
*   **Test:** No dedicated test script is currently defined in `frontend/package.json`; rely on lint/build validation.
*   **Run Single Test:** Only if a test runner is added to the service.
    ```bash
    pnpm test -- path/to/file
    ```

### `k8s-service/` (Go)
*   **Build:** `make build` (compiles to `bin/server`)
*   **Run:** `make run`
*   **Test:** `make test` (Runs `go test -v ./...`)
*   **Run Single Test:**
    ```bash
    # Run tests in a specific package
    go test -v ./internal/package_name
    
    # Run a specific test function
    go test -v ./internal/package_name -run TestName
    ```

## 2. Code Style & Conventions

### TypeScript (NestJS & Next.js)
*   **Formatting:** Use Prettier. 2 spaces indentation. Double quotes for strings and imports. Semicolons required.
*   **Naming:**
    *   Variables/Functions: `camelCase`
    *   Classes/Interfaces/Components: `PascalCase`
    *   Files: `kebab-case.ts` (NestJS conventions), `PascalCase.tsx` (React components) or `page.tsx`/`layout.tsx` (Next.js App Router).
*   **Imports:** Clean and organized. Remove unused imports.
*   **Typing:** Prefer explicit types and avoid `any` where possible. (`strictNullChecks` is enabled, but `noImplicitAny` is currently false in `api/tsconfig.json` and `github-service/tsconfig.json`.)
*   **NestJS Specifics:**
    *   Applies to `api/`.
    *   Use Dependency Injection via constructors.
    *   Use Decorators (`@Injectable()`, `@Controller()`, `@Get()`) appropriately.
    *   Follow `module` -> `controller` -> `service` architecture.
*   **github-service Specifics (Effect):**
    *   Use Effect Layers and services (see `github-service/src/effect/main.ts`).
    *   Keep message schemas in `github-service/src/effect/schemas/messages.ts` and handle queue patterns in `github-service/src/effect/program.ts`.
    *   Use Bun runtime APIs via `@effect/platform-bun` where needed.
*   **Next.js Specifics:**
    *   Use App Router structure (`app/`).
    *   Mark Client Components with `"use client"` at the top.
    *   Use Tailwind CSS for styling.
    *   **UI Components:** ONLY use `shadcn/ui` components for building UIs. Do not introduce other UI libraries or create custom components if a `shadcn` equivalent exists. Check `components/ui` or `components.json` for available components.

### Go (`k8s-service`)
*   **Formatting:** Standard `gofmt`.
*   **Project Layout:** Follows Standard Go Project Layout (`cmd/`, `internal/`, `pkg/`).
*   **Error Handling:**
    *   Return errors as the last return value.
    *   Check errors immediately: `if err != nil { return err }`.
    *   Don't panic unless during startup.
*   **Logging:** Use `zap.SugaredLogger`.
*   **Web Framework:** Uses `echo`.
*   **Configuration:** Uses `internal/config` and environment variables.

## 3. General Rules for Agents
1.  **Context is King:** Always analyze the surrounding code before making changes to match the existing style.
2.  **Verify Changes:** Run the lint and test commands for the specific service you are modifying before declaring the task complete.
3.  **Monorepo Awareness:** Be aware of which directory you are in. Do not run `npm` commands in the root if you intend to affect a specific service; `cd` into the service directory (for `github-service/`, run Bun commands from that directory).
4.  **No Blind Edits:** Use `read` to check file contents before `edit` or `write`.
5.  **Paths:** Always use absolute paths for file operations.
