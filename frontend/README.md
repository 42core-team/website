# Frontend

Next.js frontend application.

## Getting Started

### Prerequisites

Install pnpm:

```bash
corepack enable && corepack prepare pnpm@latest --activate
```

or

```bash
brew install pnpm
```

### Installation & Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Set up environment variables:

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` with your configuration (see [Environment Variables](#environment-variables) below).

3. Run development server:
   ```bash
   pnpm dev
   ```
   > **Note:** Run `pnpm prebuild` first to fetch current wiki and changelog content.

### Production

- **Build:** `pnpm build` (auto-updates wiki and changelog)
- **Start:** `pnpm start`
