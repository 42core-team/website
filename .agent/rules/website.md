---
trigger: always_on
---

# Agent Guide - Website Relaunch

This repository is a monorepo containing multiple services. Please follow these guidelines when working on this codebase.

## Project Structure

- `api/` - NestJS API service (TypeScript)
- `frontend/` - Next.js frontend application (TypeScript)
- `github-service/` - NestJS service for GitHub integration (TypeScript)
- `k8s-service/` - Kubernetes management service (Go)

## 1. Build, Lint, and Test Commands

### General

- Package Manager: `pnpm` is used for JavaScript/TypeScript projects.
- Go: Standard Go toolchain (1.23+) and `make`.

### `api/` & `github-service/` (NestJS)

- **Build:** `pnpm build` (Runs `nest build`)
- **Format:** `pnpm format` (Runs `prettier`)
- **Run Dev:** `pnpm start:dev`

### `frontend/` (Next.js)

- **Build:** `pnpm build` (Runs `next build`)
- **Dev:** `pnpm dev`

### `k8s-service/` (Go)

- **Build:** `make build` (compiles to `bin/server`)
- **Run:** `make run`

## 2. Code Style & Conventions

### TypeScript (NestJS & Next.js)

- **Formatting:** Use Prettier. 2 spaces indentation. Double quotes for strings and imports. Semicolons required.
- **Naming:**
  - Variables/Functions: `camelCase`
  - Classes/Interfaces/Components: `PascalCase`
  - Files: `kebab-case.ts` (NestJS conventions), `PascalCase.tsx` (React components) or `page.tsx`/`layout.tsx` (Next.js App Router).
- **Imports:** Clean and organized. Remove unused imports.
- **Typing:** Strict TypeScript. Avoid `any` where possible. Use interfaces/types for DTOs and props.
- **NestJS Specifics:**
  - Use Dependency Injection via constructors.
  - Use Decorators (`@Injectable()`, `@Controller()`, `@Get()`) appropriately.
  - Follow `module` -> `controller` -> `service` architecture.
- **Next.js Specifics:**
  - Use App Router structure (`app/`).
  - Mark Client Components with `"use client"` at the top.
  - Use Tailwind CSS for styling.
  - **UI Components:** ONLY use `shadcn/ui` components for building UIs. Do not introduce other UI libraries or create custom components if a `shadcn` equivalent exists. Check `components/ui` or `components.json` for available components.

### Go (`k8s-service`)

- **Formatting:** Standard `gofmt`.
- **Project Layout:** Follows Standard Go Project Layout (`cmd/`, `internal/`, `pkg/`).
- **Error Handling:**
  - Return errors as the last return value.
  - Check errors immediately: `if err != nil { return err }`.
  - Don't panic unless during startup.
- **Logging:** Use `zap.SugaredLogger`.
- **Web Framework:** Uses `echo`.
- **Configuration:** Uses `internal/config` and environment variables.

## 3. General Rules for Agents

1.  **Context is King:** Always analyze the surrounding code before making changes to match the existing style.
2.  **Verify Changes:** Run the lint and test commands for the specific service you are modifying before declaring the task complete.
3.  **Monorepo Awareness:** Be aware of which directory you are in. Do not run `npm` commands in the root if you intend to affect a specific service; `cd` into the service directory or use `pnpm --filter`.
4.  **No Blind Edits:** Use `read` to check file contents before `edit` or `write`.
5.  **Paths:** Always use absolute paths for file operations.
