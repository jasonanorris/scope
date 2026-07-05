# Scope

Scope is a lightweight project-management web app built with Vite and React. This first version is a static frontend with local-only persistence, intended to be protected by Cloudflare Access when deployed.

## Features

- Projects with per-project task counts
- Task board with Backlog, In Progress, Review, and Done columns
- Priorities, owners, due dates, and overdue styling
- Search plus status and priority filters
- Clean empty states
- Responsive desktop and mobile layouts
- Local persistence with `localStorage`

## Local Development

```sh
npm install
npm run dev
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

Authentication is intentionally not implemented in frontend JavaScript. Put Cloudflare Access in front of the deployed Pages project before sharing the app publicly.
