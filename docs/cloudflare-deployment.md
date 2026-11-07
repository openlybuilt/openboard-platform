# Cloudflare deployment

Deployment is manual and requires a Cloudflare account, a production Clerk instance, and domains chosen by the owner. Do not deploy using the development Clerk keys or the placeholder D1 ID.

1. Create a D1 database for OpenBoard. Replace the local-only database ID in the backend's Wrangler configuration with the real ID in a production-specific configuration.
2. Configure the backend's exact frontend origin as `FRONTEND_ORIGIN`. Set `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` as Worker secrets, using keys from the production Clerk instance. Never put the secret key in frontend variables or Git.
3. Apply the backend's D1 migrations to the intended production database, then deploy the backend Worker. Verify its health endpoint and that board routes reject unauthenticated requests.
4. Create a Cloudflare Pages project for this repository using `pnpm install --frozen-lockfile` as the install command, `pnpm build` as the build command, and `dist` as the build directory. Set `VITE_CLERK_PUBLISHABLE_KEY` to the production publishable key and `VITE_WHITEBOARD_API_URL` to the backend's public origin.
5. Attach the chosen domains, configure Clerk's production domain, and set the backend's `FRONTEND_ORIGIN` to the final frontend origin. Verify sign-in, user isolation, board creation, editing, deletion, and sign-out before inviting users.

Local and account boards are separate. Production setup does not migrate locally stored boards.
