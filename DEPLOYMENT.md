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
| Deploy command | Leave blank |

No environment variables are required for the current local-only version.

Do not set the deploy command to `npx wrangler deploy` for this Pages deployment. Cloudflare Pages should build the app and publish the `dist` directory directly.

## SPA Fallback

The file `public/_redirects` is copied into `dist` during the Vite build. It sends deep links back to `index.html`, which is useful if client-side routing is added later.

## Troubleshooting

If the Cloudflare log shows `Executing user deploy command: npx wrangler deploy`, the project is using the wrong deploy flow for this app. Remove the deploy command from the Cloudflare Pages build settings and redeploy.

The Pages SPA fallback in `public/_redirects` is valid for Cloudflare Pages. The same rule can fail under `wrangler deploy` with an "Infinite loop detected" error because Wrangler is deploying a Workers static assets project instead of letting Pages publish the `dist` directory.

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
