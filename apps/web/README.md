# Web App (Next.js)

This folder contains the Next.js portal that Vercel deploys (root dir `apps/web`). Run it locally with:

```bash
pnpm --filter web dev
```

Shared context lives in `/packages/*`, so touching those files can require a redeploy even when `apps/web` itself is unchanged.
