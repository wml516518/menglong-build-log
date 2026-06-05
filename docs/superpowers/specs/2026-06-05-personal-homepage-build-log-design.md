# Personal Homepage + Build Log Design

Date: 2026-06-05

## Goal

Build a clean bilingual personal homepage for MengLong Wang. The site should act as a portfolio front door, a public build log, and a future index for deployed GitHub projects.

The first version should be simple, polished, and reliable on free hosting.

## Deployment

- Frontend: Netlify Free
- Backend: none for v1
- Reasoning: the homepage should stay fast and stable without depending on a Render Free service that may sleep after idle time.

## Technology

- React
- Vite
- TypeScript
- Local structured content for projects, build logs, profile copy, and navigation

## Visual Direction

Use a technical magazine style:

- Near-white background
- Black and gray typography
- Thin dividing lines
- Large homepage headline
- Generous spacing
- Minimal decoration
- Few cards
- Build Log presented as a clean editorial list

Avoid heavy gradients, template-like hero sections, dense card grids, and decorative backgrounds.

## Information Architecture

### Home

The homepage introduces MengLong Wang and shows the project direction at a glance.

Required sections:

- Top navigation
- EN / Chinese segmented language switch
- Large hero headline
- Short personal positioning statement
- Primary links to Projects and Build Log
- Latest Build Log preview with three entries

### Projects

The Projects section lists current and planned portfolio projects.

Initial project entries:

- Personal Homepage + Build Log
- AI Chat Playground
- Knowledge Base Demo
- Issue Tracker or Data Dashboard
- Automation Report System

Each project entry should support:

- Title
- Status
- Summary
- Tech stack
- GitHub URL
- Live demo URL

URLs can be empty for planned projects.

### Build Log

The Build Log records project progress and engineering notes.

Each entry should support:

- Date
- Title
- Summary
- Tags
- Related project

The first version can render log summaries without full article pages. The data model should allow adding article pages later.

### About

The About section contains bilingual self-introduction content.

It should cover:

- Full-stack development focus
- Interest in AI tools and productivity products
- Core technologies
- Project-building direction

### Contact

The Contact section should include concise external links:

- GitHub
- Email
- LinkedIn or another professional profile if available

## Language Switching

The site must support English and Chinese.

Behavior:

- Use a segmented control in the top-right navigation area.
- Display `EN` and `中`.
- Switching language updates visible page copy.
- Save the selected language in `localStorage`.
- Use English as the default language for the first visit.

## Content Strategy

Use local TypeScript data files in v1. This keeps deployment simple and avoids databases or CMS setup.

Likely content modules:

- profile content
- navigation labels
- project entries
- build log entries
- contact links

Markdown can be added later if the Build Log grows into full-length articles.

## Success Criteria

- The site feels clean, mature, and portfolio-ready.
- It can be deployed to Netlify Free as a static frontend.
- It clearly presents MengLong Wang, the build roadmap, and project links.
- It supports bilingual switching without page reload.
- The structure can later support AI Chat Playground and other project pages.
