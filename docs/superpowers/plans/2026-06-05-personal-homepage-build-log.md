# Personal Homepage + Build Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bilingual React + Vite personal homepage and Build Log for MengLong Wang, ready for Netlify Free deployment.

**Architecture:** The app is a static frontend with local TypeScript content modules. Language state lives in React state, persists to `localStorage`, and drives all visible copy through a small typed content API.

**Tech Stack:** React, Vite, TypeScript, Vitest, React Testing Library, CSS modules or plain CSS, Netlify static deploy.

---

## File Structure

- Create: `package.json` — project scripts and dependencies.
- Create: `index.html` — Vite HTML entry.
- Create: `tsconfig.json` — TypeScript app settings.
- Create: `tsconfig.node.json` — TypeScript config for Vite config.
- Create: `vite.config.ts` — Vite and Vitest config.
- Create: `src/main.tsx` — React entry point.
- Create: `src/App.tsx` — page composition and language state.
- Create: `src/App.test.tsx` — integration tests for rendering and language switching.
- Create: `src/content.ts` — bilingual profile, navigation, project, and build log data.
- Create: `src/content.test.ts` — content shape and language fallback tests.
- Create: `src/styles.css` — global visual system and responsive layout.
- Create: `src/vite-env.d.ts` — Vite type declarations.
- Create: `netlify.toml` — Netlify build config.
- Modify: `.gitignore` — keep generated and local files out of Git.

## Task 1: Initialize React + Vite Project Files

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `src/vite-env.d.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "menglong-build-log",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.6.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create app configuration files**

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      name="description"
      content="MengLong Wang's personal homepage, project portfolio, and public build log."
    />
    <title>MengLong Wang | Portfolio + Build Log</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

`vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts']
  }
});
```

`src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 3: Update `.gitignore`**

```gitignore
.superpowers/
node_modules/
dist/
.env
.env.local
coverage/
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`

Expected: dependencies install and `package-lock.json` is created.

## Task 2: Add Typed Bilingual Content

**Files:**
- Create: `src/content.ts`
- Create: `src/content.test.ts`
- Create: `src/test-setup.ts`

- [ ] **Step 1: Create the failing content tests**

`src/test-setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

`src/content.test.ts`:

```ts
import { content, getInitialLanguage, languages } from './content';

describe('content', () => {
  it('contains English and Chinese site copy', () => {
    expect(languages).toEqual(['en', 'zh']);
    expect(content.en.profile.name).toBe('MengLong Wang');
    expect(content.zh.profile.name).toBe('MengLong Wang');
    expect(content.en.nav.projects).toBe('Projects');
    expect(content.zh.nav.projects).toBe('项目');
  });

  it('defaults to English when no stored language exists', () => {
    localStorage.clear();

    expect(getInitialLanguage()).toBe('en');
  });

  it('uses a stored Chinese language preference', () => {
    localStorage.setItem('portfolio-language', 'zh');

    expect(getInitialLanguage()).toBe('zh');
  });

  it('falls back to English for invalid stored values', () => {
    localStorage.setItem('portfolio-language', 'fr');

    expect(getInitialLanguage()).toBe('en');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/content.test.ts`

Expected: FAIL because `src/content.ts` does not exist.

- [ ] **Step 3: Implement content module**

`src/content.ts`:

```ts
export const languages = ['en', 'zh'] as const;

export type Language = (typeof languages)[number];

type Project = {
  title: string;
  status: string;
  summary: string;
  stack: string[];
  githubUrl: string;
  liveUrl: string;
};

type BuildLogEntry = {
  date: string;
  title: string;
  summary: string;
  tags: string[];
  relatedProject: string;
};

type SiteContent = {
  nav: {
    projects: string;
    buildLog: string;
    about: string;
    contact: string;
  };
  profile: {
    name: string;
    role: string;
    eyebrow: string;
    headline: string;
    intro: string;
    primaryAction: string;
    secondaryAction: string;
  };
  sections: {
    projects: string;
    buildLog: string;
    about: string;
    contact: string;
    latestBuildLog: string;
    allPosts: string;
  };
  about: string;
  projects: Project[];
  buildLogs: BuildLogEntry[];
  contact: {
    label: string;
    value: string;
    href: string;
  }[];
};

const storageKey = 'portfolio-language';

export function isLanguage(value: string | null): value is Language {
  return value === 'en' || value === 'zh';
}

export function getInitialLanguage(): Language {
  if (typeof localStorage === 'undefined') {
    return 'en';
  }

  const stored = localStorage.getItem(storageKey);
  return isLanguage(stored) ? stored : 'en';
}

export function saveLanguage(language: Language): void {
  localStorage.setItem(storageKey, language);
}

export const content: Record<Language, SiteContent> = {
  en: {
    nav: {
      projects: 'Projects',
      buildLog: 'Build Log',
      about: 'About',
      contact: 'Contact'
    },
    profile: {
      name: 'MengLong Wang',
      role: 'Full-stack Developer',
      eyebrow: 'Portfolio / Build Log',
      headline: 'Building practical AI tools and full-stack products.',
      intro:
        'I document the products I build, the engineering decisions behind them, and the lessons learned along the way.',
      primaryAction: 'View Projects',
      secondaryAction: 'Read Log'
    },
    sections: {
      projects: 'Projects',
      buildLog: 'Build Log',
      about: 'About',
      contact: 'Contact',
      latestBuildLog: 'Latest Build Log',
      allPosts: 'All posts'
    },
    about:
      'I focus on full-stack development, AI products, and productivity tools. This site tracks my portfolio roadmap from a personal homepage to deployable AI applications.',
    projects: [
      {
        title: 'Personal Homepage + Build Log',
        status: 'Live soon',
        summary: 'A bilingual portfolio front door and public project journal.',
        stack: ['React', 'Vite', 'TypeScript', 'Netlify'],
        githubUrl: '',
        liveUrl: ''
      },
      {
        title: 'AI Chat Playground',
        status: 'Next',
        summary: 'A model-switching chat interface with a Render-hosted API layer.',
        stack: ['React', 'Node or Python', 'Render'],
        githubUrl: '',
        liveUrl: ''
      },
      {
        title: 'Knowledge Base Demo',
        status: 'Planned',
        summary: 'A document Q&A demo for exploring practical RAG workflows.',
        stack: ['React', 'Python', 'Vector Search'],
        githubUrl: '',
        liveUrl: ''
      }
    ],
    buildLogs: [
      {
        date: '2026-06-05',
        title: 'Portfolio homepage and public build log',
        summary: 'Designing the first portfolio project around clarity, bilingual content, and Netlify deployment.',
        tags: ['Portfolio', 'React', 'Netlify'],
        relatedProject: 'Personal Homepage + Build Log'
      },
      {
        date: 'Next',
        title: 'AI Chat Playground with model switching',
        summary: 'Planning a deployable chat interface with a lightweight backend API.',
        tags: ['AI', 'Chat', 'Render'],
        relatedProject: 'AI Chat Playground'
      },
      {
        date: 'Planned',
        title: 'Knowledge base demo and document Q&A',
        summary: 'Preparing a later project for document parsing, retrieval, and answer generation.',
        tags: ['RAG', 'Python', 'Documents'],
        relatedProject: 'Knowledge Base Demo'
      }
    ],
    contact: [
      { label: 'GitHub', value: 'github.com', href: 'https://github.com/' },
      { label: 'Email', value: 'Add your email', href: 'mailto:hello@example.com' }
    ]
  },
  zh: {
    nav: {
      projects: '项目',
      buildLog: '构建日志',
      about: '关于',
      contact: '联系'
    },
    profile: {
      name: 'MengLong Wang',
      role: '全栈开发者',
      eyebrow: '作品集 / 构建日志',
      headline: '构建实用的 AI 工具和全栈产品。',
      intro: '我会记录自己构建的产品、背后的工程决策，以及每个项目带来的经验。',
      primaryAction: '查看项目',
      secondaryAction: '阅读日志'
    },
    sections: {
      projects: '项目',
      buildLog: '构建日志',
      about: '关于',
      contact: '联系',
      latestBuildLog: '最新构建日志',
      allPosts: '全部文章'
    },
    about:
      '我专注于全栈开发、AI 产品和效率工具。这个网站会记录我的作品路线，从个人主页开始，逐步扩展到可部署的 AI 应用。',
    projects: [
      {
        title: '个人主页 + 构建日志',
        status: '即将上线',
        summary: '一个中英双语的作品入口和公开项目记录。',
        stack: ['React', 'Vite', 'TypeScript', 'Netlify'],
        githubUrl: '',
        liveUrl: ''
      },
      {
        title: 'AI Chat Playground',
        status: '下一个',
        summary: '支持模型切换的聊天界面，并使用 Render 部署后端 API。',
        stack: ['React', 'Node 或 Python', 'Render'],
        githubUrl: '',
        liveUrl: ''
      },
      {
        title: '知识库问答 Demo',
        status: '计划中',
        summary: '用于展示文档解析、检索和回答生成的 RAG 工作流。',
        stack: ['React', 'Python', 'Vector Search'],
        githubUrl: '',
        liveUrl: ''
      }
    ],
    buildLogs: [
      {
        date: '2026-06-05',
        title: '个人主页和公开构建日志',
        summary: '围绕清晰表达、中英双语和 Netlify 部署设计第一个作品项目。',
        tags: ['作品集', 'React', 'Netlify'],
        relatedProject: '个人主页 + 构建日志'
      },
      {
        date: '下一个',
        title: '支持模型切换的 AI Chat Playground',
        summary: '规划一个可部署的聊天界面和轻量后端 API。',
        tags: ['AI', '聊天', 'Render'],
        relatedProject: 'AI Chat Playground'
      },
      {
        date: '计划中',
        title: '知识库问答 Demo',
        summary: '为后续文档解析、检索和回答生成项目做准备。',
        tags: ['RAG', 'Python', '文档'],
        relatedProject: '知识库问答 Demo'
      }
    ],
    contact: [
      { label: 'GitHub', value: 'github.com', href: 'https://github.com/' },
      { label: '邮箱', value: '添加你的邮箱', href: 'mailto:hello@example.com' }
    ]
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/content.test.ts`

Expected: PASS.

## Task 3: Build App Layout and Language Switching

**Files:**
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/App.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Create failing UI tests**

`src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the English portfolio homepage by default', () => {
    render(<App />);

    expect(screen.getByText('MengLong Wang')).toBeInTheDocument();
    expect(screen.getByText('Building practical AI tools and full-stack products.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '中' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches to Chinese and persists the preference', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '中' }));

    expect(screen.getByText('构建实用的 AI 工具和全栈产品。')).toBeInTheDocument();
    expect(localStorage.getItem('portfolio-language')).toBe('zh');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL because `src/App.tsx` and `src/main.tsx` do not exist.

- [ ] **Step 3: Implement React app**

`src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

`src/App.tsx`:

```tsx
import { useState } from 'react';
import { content, getInitialLanguage, type Language, saveLanguage } from './content';

function App() {
  const [language, setLanguage] = useState<Language>(() => getInitialLanguage());
  const copy = content[language];

  function handleLanguageChange(nextLanguage: Language) {
    setLanguage(nextLanguage);
    saveLanguage(nextLanguage);
  }

  return (
    <main className="site-shell">
      <header className="site-header">
        <a className="brand" href="#home" aria-label="MengLong Wang homepage">
          <span>{copy.profile.name}</span>
          <small>{copy.profile.role}</small>
        </a>
        <nav className="nav-links" aria-label="Primary navigation">
          <a href="#projects">{copy.nav.projects}</a>
          <a href="#build-log">{copy.nav.buildLog}</a>
          <a href="#about">{copy.nav.about}</a>
          <a href="#contact">{copy.nav.contact}</a>
          <div className="language-switch" aria-label="Language switch">
            <button
              type="button"
              aria-pressed={language === 'en'}
              onClick={() => handleLanguageChange('en')}
            >
              EN
            </button>
            <button
              type="button"
              aria-pressed={language === 'zh'}
              onClick={() => handleLanguageChange('zh')}
            >
              中
            </button>
          </div>
        </nav>
      </header>

      <section id="home" className="hero-section">
        <div>
          <p className="eyebrow">{copy.profile.eyebrow}</p>
          <h1>{copy.profile.headline}</h1>
        </div>
        <div className="hero-aside">
          <p>{copy.profile.intro}</p>
          <div className="hero-actions">
            <a className="button primary" href="#projects">
              {copy.profile.primaryAction}
            </a>
            <a className="button secondary" href="#build-log">
              {copy.profile.secondaryAction}
            </a>
          </div>
        </div>
      </section>

      <section id="build-log" className="section-block">
        <div className="section-heading">
          <h2>{copy.sections.latestBuildLog}</h2>
          <a href="#build-log">{copy.sections.allPosts}</a>
        </div>
        <div className="log-grid">
          {copy.buildLogs.map((entry, index) => (
            <article className="log-item" key={entry.title}>
              <p>{String(index + 1).padStart(2, '0')} / {entry.date}</p>
              <h3>{entry.title}</h3>
              <span>{entry.relatedProject}</span>
            </article>
          ))}
        </div>
      </section>

      <section id="projects" className="section-block">
        <div className="section-heading">
          <h2>{copy.sections.projects}</h2>
        </div>
        <div className="project-list">
          {copy.projects.map((project) => (
            <article className="project-row" key={project.title}>
              <div>
                <p>{project.status}</p>
                <h3>{project.title}</h3>
              </div>
              <p>{project.summary}</p>
              <ul>
                {project.stack.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section id="about" className="section-block two-column">
        <h2>{copy.sections.about}</h2>
        <p>{copy.about}</p>
      </section>

      <section id="contact" className="section-block two-column">
        <h2>{copy.sections.contact}</h2>
        <div className="contact-list">
          {copy.contact.map((item) => (
            <a href={item.href} key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}

export default App;
```

- [ ] **Step 4: Add visual styling**

`src/styles.css`:

```css
:root {
  color: #171717;
  background: #f6f4ef;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background: #f6f4ef;
}

a {
  color: inherit;
  text-decoration: none;
}

button {
  font: inherit;
}

.site-shell {
  width: min(1180px, calc(100% - 32px));
  margin: 0 auto;
  padding: 28px 0 54px;
}

.site-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  border-bottom: 1px solid #d8d4ca;
  padding-bottom: 18px;
}

.brand {
  display: grid;
  gap: 4px;
  font-weight: 750;
}

.brand small {
  color: #6f6b62;
  font-size: 12px;
  font-weight: 500;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 28px;
  color: #4f4b44;
  font-size: 14px;
}

.language-switch {
  display: inline-flex;
  border: 1px solid #b9b3a8;
  background: #fff;
}

.language-switch button {
  min-width: 44px;
  border: 0;
  background: transparent;
  color: #171717;
  cursor: pointer;
  padding: 7px 11px;
}

.language-switch button[aria-pressed="true"] {
  background: #111;
  color: #fff;
}

.hero-section {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.65fr);
  gap: 56px;
  align-items: end;
  padding: 74px 0 54px;
}

.eyebrow {
  color: #777168;
  font-size: 13px;
  letter-spacing: 0.08em;
  margin: 0 0 18px;
  text-transform: uppercase;
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

h1 {
  max-width: 780px;
  font-size: clamp(48px, 8vw, 88px);
  font-weight: 780;
  letter-spacing: 0;
  line-height: 1.02;
  margin-bottom: 0;
}

.hero-aside {
  border-left: 1px solid #d8d4ca;
  padding-left: 28px;
}

.hero-aside p {
  color: #3f3b35;
  font-size: 18px;
  line-height: 1.55;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 24px;
}

.button {
  border: 1px solid #111;
  font-size: 13px;
  padding: 9px 12px;
}

.button.primary {
  background: #111;
  color: #fff;
}

.button.secondary {
  border-color: #b9b3a8;
}

.section-block {
  border-top: 1px solid #d8d4ca;
  padding: 28px 0 48px;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 18px;
}

.section-heading h2,
.two-column h2 {
  font-size: 18px;
  margin: 0;
}

.section-heading a {
  font-size: 13px;
}

.log-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.log-item {
  border-top: 1px solid #b9b3a8;
  padding-top: 14px;
}

.log-item:first-child {
  border-color: #171717;
}

.log-item p,
.project-row p:first-child {
  color: #777168;
  font-size: 12px;
  margin-bottom: 8px;
}

.log-item h3 {
  font-size: 19px;
  line-height: 1.3;
  margin-bottom: 14px;
}

.log-item span {
  color: #5e594f;
  font-size: 13px;
}

.project-list {
  display: grid;
  gap: 0;
}

.project-row {
  display: grid;
  grid-template-columns: 0.9fr 1.2fr 0.9fr;
  gap: 28px;
  border-top: 1px solid #d8d4ca;
  padding: 22px 0;
}

.project-row h3 {
  font-size: 22px;
  margin-bottom: 0;
}

.project-row > p {
  color: #3f3b35;
  line-height: 1.55;
}

.project-row ul {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.project-row li {
  border: 1px solid #c8c2b7;
  font-size: 12px;
  padding: 6px 8px;
}

.two-column {
  display: grid;
  grid-template-columns: 0.45fr 1fr;
  gap: 56px;
}

.two-column p {
  color: #3f3b35;
  font-size: 18px;
  line-height: 1.65;
  margin-bottom: 0;
}

.contact-list {
  display: grid;
  gap: 14px;
}

.contact-list a {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  border-top: 1px solid #d8d4ca;
  padding-top: 14px;
}

.contact-list span {
  color: #777168;
}

@media (max-width: 820px) {
  .site-header,
  .nav-links {
    align-items: flex-start;
    flex-direction: column;
  }

  .nav-links {
    gap: 14px;
    width: 100%;
  }

  .hero-section,
  .project-row,
  .two-column {
    grid-template-columns: 1fr;
  }

  .hero-aside {
    border-left: 0;
    border-top: 1px solid #d8d4ca;
    padding-left: 0;
    padding-top: 24px;
  }

  .log-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 5: Run UI tests**

Run: `npm test -- src/App.test.tsx`

Expected: PASS.

## Task 4: Add Netlify Configuration and Build Verification

**Files:**
- Create: `netlify.toml`

- [ ] **Step 1: Create Netlify config**

`netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

- [ ] **Step 2: Run all tests**

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: TypeScript build and Vite production build complete with exit code 0.

- [ ] **Step 4: Start local dev server for visual verification**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite prints a local URL such as `http://127.0.0.1:5173/`.

- [ ] **Step 5: Verify in browser**

Open the local URL and verify:

- The name displays as `MengLong Wang`.
- The first screen follows the approved technical magazine layout.
- The `EN / 中` segmented switch works.
- Build Log preview shows three entries.
- Project list and contact sections are visible.
- Layout remains readable on desktop and mobile widths.

## Task 5: Initialize Git and Prepare GitHub-Ready Project

**Files:**
- Modify: Git metadata only

- [ ] **Step 1: Initialize Git if needed**

Run: `git rev-parse --is-inside-work-tree`

Expected if not initialized: command exits non-zero.

Run: `git init`

Expected: repository initialized.

- [ ] **Step 2: Review working tree**

Run: `git status --short`

Expected: source files, docs, config, and lockfile are listed as untracked or modified.

- [ ] **Step 3: Commit the first version**

Run:

```bash
git add .gitignore docs package.json package-lock.json index.html tsconfig.json tsconfig.node.json vite.config.ts netlify.toml src
git commit -m "feat: add bilingual portfolio build log"
```

Expected: initial project commit is created.

## Self-Review

- Spec coverage: homepage, projects, build log, about, contact, bilingual switching, local content, Netlify static deployment, and visual direction are covered.
- Placeholder scan: no task uses unresolved placeholders for implementation behavior.
- Type consistency: `Language`, `SiteContent`, `Project`, and `BuildLogEntry` are defined before use. The storage key is centralized in `src/content.ts`.
