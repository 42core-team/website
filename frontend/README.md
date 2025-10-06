# Frontend – Next.js

This directory contains the frontend codebase, built with [Next.js](https://nextjs.org/).

## Getting Started

1. Install pnpm (if not already installed):

   ```sh
   corepack enable && corepack prepare pnpm@latest --activate
   # or
   brew install pnpm
   ```

2. Install dependencies:

   ```sh
   pnpm install
   ```

3. Set up environment variables:

Copy the `.env.example` file to `.env.local` and fill in the values as needed. Have a look at the comments if the values are needed.

See the Environment Variables section for more information.

4. Run the frontend in dev mode:

   > To get the current wiki and changelog run `pnpm prebuild`

   ```sh
   pnpm dev
   ```

5. Build for production mode (autoupdates wiki and changelog):

   ```sh
   pnpm build
   ```

6. Start the frontend in production mode:
   ```sh
   pnpm start
   ```

## Environment Variables

### GitHub OAuth

GitHub is used as the default OAuth provider. For the main functionality, you will need to set up a GitHub OAuth app.

1. Go to GitHub → Settings → Developer settings → OAuth Apps
2. Register a new OAuth app.
3. Set the Authorization callback URL to:
   `http://localhost:3000/api/auth/callback`
4. Add your Client ID and Secret to your `.env` file.

### 42 School OAuth

If you want to test the 42 account linking functionality, you will need register a 42 School OAuth app.

1. Go to 42 School → Settings → API → Applications
2. Create a new application
3. Set the Redirect URI to: `http://localhost:3000/auth/callback/42`
4. Copy the Client ID and Client Secret and add them to your `.env.local` file
