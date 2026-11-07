# Cloudflare deployment

The frontend will use `https://openboard.openlybuilt.com`. Deployment is manual and requires a Cloudflare account, a production Clerk instance, and a backend URL. Do not deploy using the development Clerk keys or the placeholder D1 ID.

1. The `openboard` D1 database has been created in the Openly Cloudflare account (ID `cab2cd67-509c-427f-8880-cd022a5cefb8`). The initial `0001_boards.sql` migration has been applied and recorded. Use the production backend Wrangler configuration; leave the local-only configuration intact.
2. Configure the backend's exact frontend origin as `FRONTEND_ORIGIN`. Set `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` as Worker secrets, using keys from the production Clerk instance. Never put the secret key in frontend variables or Git.
3. Apply the backend's D1 migrations to the intended production database, then deploy the backend Worker. Verify its health endpoint and that board routes reject unauthenticated requests.
4. The Cloudflare Pages project `openboard` has been created with direct uploads in the Openly account. In the GitHub repository's `production` environment, set the variables `VITE_CLERK_PUBLISHABLE_KEY` to the production publishable key and `VITE_WHITEBOARD_API_URL` to the backend's public origin. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as secrets for the Openly account. Run the **Deploy OpenBoard** workflow manually from `main` when ready; it builds the app and uploads `dist`.
5. `openboard.openlybuilt.com` has been attached to the Openly Pages project; check that its DNS and certificate are active. Configure Clerk's production domain and set the backend's `FRONTEND_ORIGIN` to `https://openboard.openlybuilt.com`. Verify sign-in, user isolation, board creation, editing, deletion, and sign-out before inviting users. Configure preview environments separately rather than allowing their origins on the production API.

Local and account boards are separate. Production setup does not migrate locally stored boards.
