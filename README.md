# Bot tester

Small Next.js app for the API in `src/`. It signs in with the Firebase client SDK and sends the ID token to the API.

## Setup

1. In Firebase console, open the same project as the API. Enable Authentication → Email/Password. Add a web app and copy the config.
2. Copy `.env.example` to `.env.local` and fill it in. `NEXT_PUBLIC_API_URL` should be the API, usually `http://localhost:3000`.
3. On the API, set `WEB_ORIGIN=http://localhost:3001` if the tester is not on that origin.
4. Install and run:

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3001. Create an account, create a bot, link a phone, then use the buttons to grant chat, add a command, save a quiz, or seed packs.

The API must already be running (`src/index.ts`) with Firebase admin credentials.
