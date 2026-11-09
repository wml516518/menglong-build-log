# Markdown Build Log and CI/CD Design

## Goal

Turn the static Build Log preview into a maintainable bilingual Markdown article system and connect the existing Netlify site to GitHub for continuous deployment, while keeping GitHub Actions as the required quality gate.

## Scope

This phase includes:

- Markdown-backed Build Log articles with front matter metadata.
- A complete article index and article detail experience.
- Bilingual article selection using the site's existing language switch.
- Focused component extraction from `App.tsx` for the Build Log feature.
- GitHub Actions validation for pushes and pull requests targeting `main`.
- Netlify continuous deployment from `main` and Deploy Previews for pull requests.
- A GitHub `main` ruleset that requires the CI status check before merge.

This phase does not include:

- A CMS or database.
- User accounts, comments, search, pagination, or RSS.
- Moving `eat-card/` to another repository.
- Rewriting the resume, project list, or other existing structured content.
- Adding a license or hiding the currently public resume fields.

## Content Architecture

Profile, resume, navigation, project, and contact data remain in TypeScript because their structures are fixed and consumed directly by React.

Build Log articles move to `src/posts/`. Each article is a Markdown file whose front matter contains:

- `slug`: stable URL identifier shared by both language versions.
- `language`: `en` or `zh`.
- `date`: ISO date in `YYYY-MM-DD` format.
- `title`: localized article title.
- `summary`: localized index excerpt.
- `tags`: localized or technical labels.
- `relatedProject`: localized project label.

The first iteration will migrate the three existing Build Log entries into three bilingual article pairs. Article body copy will be concise and based on information already present in the repository plans and source code; it will not invent project outcomes.

Vite will discover Markdown files at build time through `import.meta.glob`. `gray-matter` parses front matter and `react-markdown` renders article bodies. Invalid or incomplete front matter fails the production build rather than silently publishing a broken article.

## Navigation and Rendering

The existing homepage remains the primary route. Build Log navigation uses hash routes so Netlify does not need additional server-side routing behavior:

- `#/build-log` displays the complete article index.
- `#/build-log/<slug>` displays an article detail page.
- Existing section anchors such as `#projects` continue to work.

The homepage displays the three newest articles. “All posts” opens the full index. Selecting an article opens its detail page. A back link returns to the Build Log index.

Changing the language keeps the current article slug when a translation exists. If a translation is missing, the UI returns to the index and shows only articles available in the selected language. Unknown slugs render a localized not-found state with a link back to the index.

## Components and Boundaries

- `src/posts.ts` owns Markdown discovery, front matter validation, sorting, language filtering, and slug lookup.
- `src/components/BuildLogPreview.tsx` renders the homepage preview.
- `src/components/BuildLogIndex.tsx` renders the complete list.
- `src/components/BuildLogArticle.tsx` renders one Markdown article or the not-found state.
- `src/App.tsx` continues to own language state and selects the view from the current hash.
- `src/content.ts` keeps non-article content and localized interface labels, but removes the duplicated Build Log article records.

The feature will not introduce a general-purpose router. The small, explicit hash parser is enough for the current three views and avoids a new routing dependency.

## Error Handling

- Missing required front matter throws an error containing the Markdown file path and field name during development, tests, and production builds.
- Duplicate `language + slug` combinations throw during module initialization.
- Unknown article slugs render a user-facing localized not-found state.
- Markdown rendering permits standard Markdown and does not enable raw HTML.
- External article links open with safe `rel` attributes through the renderer configuration.

## Testing

Implementation follows test-driven development:

- Unit tests cover metadata validation, newest-first sorting, language filtering, duplicate detection, and slug lookup.
- Component tests cover the homepage preview, complete index, article navigation, Markdown rendering, localized not-found state, and language switching while reading an article.
- Existing resume and language persistence tests remain green.
- Final verification runs `npm test` and `npm run build` locally and in GitHub Actions.

## CI/CD

GitHub Actions remains the CI system. On pushes to `main` and pull requests targeting `main`, it runs:

1. `npm ci`
2. `npm test`
3. `npm run build`

Netlify becomes the CD system by linking the existing `menglong-build-log` project to `wml516518/menglong-build-log`:

- Production branch: `main`.
- Build command: `npm run build` from `netlify.toml`.
- Publish directory: `dist` from `netlify.toml`.
- Deploy Previews: enabled for pull requests.
- Branch deploys: disabled unless explicitly needed later.

No Netlify access token is stored in GitHub because deployment is handled by Netlify's Git integration.

## Main Branch Ruleset

A repository ruleset targets the `main` branch and requires changes to arrive through a pull request with the `test-and-build` CI check passing. Force pushes and branch deletion remain blocked. The repository owner may use the ruleset bypass only for recovery, not for routine feature work.

The ruleset is created only after the workflow has produced a stable status-check name and the Netlify Git integration is connected, so the selected required checks are valid.

## Rollout

1. Implement and verify Markdown Build Log support locally.
2. Commit and push the application changes.
3. Connect the existing Netlify project to the GitHub repository and confirm a production deploy.
4. Enable Deploy Previews and verify them with a temporary pull request if Netlify does not expose an existing preview run.
5. Create the `main` ruleset requiring the GitHub Actions CI check.
6. Confirm the production site, GitHub Actions run, and branch rules from their respective dashboards.

The existing manually deployed Netlify production version remains live until the first Git-backed production deploy succeeds.
