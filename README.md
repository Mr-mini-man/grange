# Grange

## How to run this

1. Install <https://mise.jdx.dev/>
2. Install nodejs (at least version 22): `mise install node@24`
3. Enable your nodejs: `mise use node@24`
4. Install pnpm: `npm install -g pnpm`
5. Run the dev server: `pnpm dev`

Now the program is running locally, visit: <http://localhost:3000/> in browser.

## Authentication and email

Accounts are verified by email before they can sign in, and passwords can be
reset through an emailed link.

- **Dev/test:** with no mail provider configured, messages are printed to the
  console and captured in memory. Read the most recent message for an address
  from `GET /api/auth/mailbox?to=<email>` (this route does not exist in
  production).
- **Production:** set the Mailjet values in `.env` (see `.env.example`). The
  server refuses to start in production without them, since dropping
  verification mail would lock every account out.

Copy `.env.example` to `.env` for local development. Never commit `.env`.
