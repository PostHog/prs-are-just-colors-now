# PRs are just colors now

PostHog pull request numbers are six digits long, so they're hex colors now.
Scroll to drizzle a ribbon of every six-digit PR into a flat color plane.

One HTML source, a public PR snapshot, and three tiny Node scripts. No dependencies.
The build produces a single self-contained `dist/index.html` that also works offline.

## Run

Node 22 or newer; no install step needed.

```sh
npm run dev
```

Open http://127.0.0.1:4173. `npm run build` rebuilds the standalone HTML.

Hue places colors by hue and lightness, packing overlapping colors into nearby cells.
Hex assigns every RGB color a unique cell by interleaving its bits into two axes.
Hover or tap the little map to reveal the projection's colors.
The author selector outlines matching PRs without hiding any colors. Pick — to reset.
Light mode switches to a white background and black outlines.

## Refresh

GitHub Actions refreshes the committed snapshot daily at 06:00 UTC, and can also
be run manually from the Actions tab. It fetches new and updated PRs, including
older PRs that merge or close, then validates the build before committing.
The contents API produces GitHub-signed commits. Only changed data is committed.
The workflow uses the built-in `GITHUB_TOKEN`; no personal token is needed.

Locally, authenticate with `gh auth login` or set `GITHUB_TOKEN`, then:

```sh
npm run refresh
```

To rebuild the complete archive from GitHub:

```sh
npm run fetch -- --full
npm run build
```

PR numbers are interpreted literally: #100000 becomes the CSS color `#100000`.
The snapshot includes all public PostHog/posthog PRs numbered 100000–999999,
with title, author, human/bot account type, and open/draft/closed/merged state.

## Deploy

This follows [Cool Numbers Club](https://github.com/PostHog/cool-numbers-club):
Cloudflare Workers static assets, built from a committed snapshot.

Connect this repo to Cloudflare Workers Builds, use `main`, and set:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: `/`

`wrangler.jsonc` points at `dist`. Connect a custom domain in Cloudflare if wanted.
Nightly data commits trigger a new Cloudflare build once that connection is set up.
Deploys don't fetch GitHub data, and the page makes no runtime API calls.
