import { useEffect, useState } from 'react';
import { BuildLogArticle } from './components/BuildLogArticle';
import { BuildLogIndex } from './components/BuildLogIndex';
import { PortfolioHome } from './components/PortfolioHome';
import { content, getInitialLanguage, saveLanguage, type Language } from './content';
import { getPost, getPosts } from './posts';
import type { Route, HistoryRoute } from './routes';
import { applyRouteMetadata } from './metadata';

type PortfolioRoute = Exclude<Route, HistoryRoute>;

export function PortfolioApp({ route }: { route: PortfolioRoute }) {
  const [language, setLanguage] = useState<Language>(() => getInitialLanguage());
  const copy = content[language];
  const localizedPosts = getPosts(language);

  useEffect(() => {
    applyRouteMetadata(route, language);
  }, [route, language]);

  useEffect(() => {
    const previousLanguage = document.documentElement.lang;
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    return () => { document.documentElement.lang = previousLanguage; };
  }, [language]);

  useEffect(() => {
    if (route.view !== 'home') {
      return;
    }

    const sectionId = window.location.hash.slice(1);
    if (sectionId === 'home') {
      // Auto follows the document CSS, including its reduced-motion override.
      window.scrollTo({ top: 0, behavior: 'auto' });
    } else if (sectionId && !sectionId.startsWith('/')) {
      document.getElementById(sectionId)?.scrollIntoView();
    }
  }, [route]);

  function handleLanguageChange(nextLanguage: Language) {
    setLanguage(nextLanguage);
    saveLanguage(nextLanguage);

    if (route.view === 'post' && !getPost(nextLanguage, route.slug)) {
      window.location.hash = '#/build-log';
    }
  }

  return (
    <main className="portfolio-site site-shell">
      <header className="site-header">
        <a className="brand" href="#home" aria-label="MengLong Wang homepage">
          <span>{copy.profile.name}</span>
          <small>{copy.profile.role}</small>
        </a>
        <nav className="nav-links" aria-label="Primary navigation">
          <a href="#projects">{copy.nav.projects}</a>
          <a href="#/build-log">{copy.nav.buildLog}</a>
          <a href="#resume">{copy.nav.resume}</a>
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

      {route.view === 'home' ? (
        <>
          <section id="home" className="hero-section">
            <div>
              {copy.profile.avatar ? (
                <img src={copy.profile.avatar} width={96} height={96} alt={copy.profile.name} />
              ) : null}
              <p className="eyebrow">{copy.profile.eyebrow}</p>
              <h1>{copy.profile.headline}</h1>
            </div>
            <div className="hero-aside">
              <p>{copy.profile.intro}</p>
              <div className="hero-actions">
                <a className="button primary" href="#projects">
                  {copy.profile.primaryAction}
                </a>
                <a className="button secondary" href="#/build-log">
                  {copy.profile.secondaryAction}
                </a>
                {copy.profile.resumeDownload ? (
                  <a className="button secondary" href={copy.profile.resumeDownload} download>
                    {copy.nav.resume}
                  </a>
                ) : null}
              </div>
            </div>
          </section>

          <PortfolioHome copy={copy} posts={localizedPosts} />
        </>
      ) : route.view === 'posts' ? (
        <BuildLogIndex
          posts={localizedPosts}
          title={copy.sections.buildLog}
          eyebrow={copy.profile.eyebrow}
          readArticleLabel={copy.sections.readArticle}
          tagsLabel={copy.sections.tags}
        />
      ) : (
        <BuildLogArticle
          post={getPost(language, route.slug)}
          backLabel={copy.sections.backToPosts}
          notFoundLabel={copy.sections.postNotFound}
          tagsLabel={copy.sections.tags}
        />
      )}
    </main>
  );
}

