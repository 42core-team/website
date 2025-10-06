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

## Environment Variables

### GitHub OAuth (Required)

1. Go to GitHub → Settings → Developer settings → OAuth Apps
2. Register a new OAuth app
3. Set Authorization callback URL: `http://localhost:3000/api/auth/callback`
4. Add Client ID and Secret to `.env.local`

### 42 School OAuth (Optional)

For testing account linking functionality:

1. Go to 42 School → Settings → API → Applications
2. Create a new application
3. Set Redirect URI: `http://localhost:3000/auth/callback/42`
4. Add Client ID and Client Secret to `.env.local`
