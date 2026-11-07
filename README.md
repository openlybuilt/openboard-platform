# OpenBoard platform

A browser-based whiteboard for creating diagrams and exploring ideas. Boards are saved locally in the browser.

## Run locally

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Run `pnpm build` to type-check and build the app.

Clerk is disabled by default. To enable sign-in, set `VITE_CLERK_ENABLED=true` and `VITE_CLERK_PUBLISHABLE_KEY` in a local environment file, then restart the development server. Without the flag, boards remain local to the browser.

The code in `src/vendor` includes components from [Arc Library](https://github.com/kuratlielia/arc-library) and [Bencho](https://bencho.dev/).
