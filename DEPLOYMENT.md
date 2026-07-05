# Deploying Scope to Cloudflare Pages

Scope builds as a static Vite frontend. It does not contain secrets, API keys, passwords, or private runtime config. Authentication should be enforced by Cloudflare Access before static files are served.

## GitHub Repository Deploy

1. Push this project to a GitHub repository.
2. In Cloudflare, open **Workers & Pages**.
3. Choose **Create application**.
4. Select **Pages** and connect the GitHub repository.
5. Choose the production branch, commonly `main`.
6. Use these build settings:

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` |
| Deploy command | `npm run deploy` |

No environment variables are required for the current local-only version.

The deploy command is backed by `wrangler.jsonc`, which publishes the static `dist` directory as Cloudflare assets. Do not put secrets or private runtime config in this frontend project.

## D1 Setup

Scope stores projects and tasks in Cloudflare D1. Before deploying the D1-backed app for the first time:

1. Create the database:

```sh
npm run db:create
```

2. Copy the `database_id` from Wrangler's output into `wrangler.jsonc`, replacing `REPLACE_WITH_D1_DATABASE_ID`.

3. Apply the schema migration:

```sh
npm run db:migrate:remote
```

The Worker also runs `CREATE TABLE IF NOT EXISTS` on API startup as a safety net. If you cannot run the remote migration from your local environment, the first authenticated API request can still initialize the schema.

4. Deploy:

```sh
npm run build
npm run deploy
```

The Worker reads Cloudflare Access identity from the `cf-access-authenticated-user-email` request header and stores a separate workspace for each signed-in email. In local development, it falls back to `local-development-user`.

## SPA Fallback

Scope does not use client-side routing yet, so it does not need a Pages `_redirects` file today.

If client-side routes are added later, configure the SPA fallback in the Cloudflare Pages project settings or add a Pages-compatible `_redirects` file at that time.

## Troubleshooting

If deploy fails with `database_id = REPLACE_WITH_D1_DATABASE_ID`, the D1 database has not been created or the Wrangler config has not been updated with the real database ID.

If the Cloudflare log shows Wrangler trying to create `wrangler.jsonc` during the deploy, make sure the latest commit is deployed. This repository includes the Wrangler config so Cloudflare should not need to auto-generate it.

## Custom Domain

After the Pages project is deployed:

1. Open the Pages project in Cloudflare.
2. Go to **Custom domains**.
3. Add a domain such as `scope.example.com`.
4. Follow Cloudflare's DNS instructions to activate the domain.

## Cloudflare Access

Before sharing the deployed app publicly:

1. Open **Zero Trust** in Cloudflare.
2. Go to **Access** -> **Applications**.
3. Add a self-hosted application for the Pages domain, for example `scope.example.com`.
4. Configure allowed identity providers and policies for the users or groups who should access Scope.
5. Test in a private browser session before sending the link to users.

## pages.dev Warning

Cloudflare Pages also generates a `*.pages.dev` URL. Protect that hostname with Cloudflare Access too, or disable public use of it through your Cloudflare setup. If only the custom domain is protected, the generated `pages.dev` URL may still expose the static frontend.
