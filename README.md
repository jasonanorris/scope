# Scope

Scope is a lightweight project-management web app built with Vite and React. This first version is a static frontend with local-only persistence, intended to be protected by Cloudflare Access when deployed.

## Features

- Projects with per-project task counts
- Task board with Backlog, In Progress, Review, and Done columns
- Priorities, owners, due dates, and overdue styling
- Search plus status and priority filters
- Clean empty states
- Responsive desktop and mobile layouts
- Cloudflare Worker API with D1 persistence

## Local Development

```sh
npm install
npm run dev
```

The React-only Vite dev server expects the deployed Worker API to exist. For local API and D1 work, use Wrangler after building:

```sh
npm run build
npm run db:migrate:local
npm run deploy -- --dry-run
```

## Checks

```sh
npm run lint
npm run build
```

## Deployment

Cloudflare Pages build settings:

- Build command: `npm run build`
- Build output directory: `dist`
- Deploy command: `npm run deploy`

Before deploying, create the D1 database and replace `REPLACE_WITH_D1_DATABASE_ID` in `wrangler.jsonc`:

```sh
npm run db:create
npm run db:migrate:remote
```

The Worker also creates missing tables on first API request as a safety net, but running migrations explicitly is still the cleaner operational path.

Authentication is intentionally not implemented in frontend JavaScript. Put Cloudflare Access in front of the deployed Pages project before sharing the app publicly.
