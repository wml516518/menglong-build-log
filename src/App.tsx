import { useState } from 'react';
import { content, getInitialLanguage, saveLanguage, type Language } from './content';

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
              <p>
                {String(index + 1).padStart(2, '0')} / {entry.date}
              </p>
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

      <section id="resume" className="section-block resume-section">
        <div className="section-heading">
          <h2>{copy.nav.resume}</h2>
        </div>
        <div className="resume-grid">
          <div className="resume-summary">
            <p>{copy.resume.summary}</p>
          </div>
          <div className="resume-details">
            <div className="resume-facts">
              {Object.values(copy.resume.basics).map((field) => (
                <div className="resume-fact" key={field.label}>
                  <span>{field.label}</span>
                  <strong>{field.value}</strong>
                </div>
              ))}
            </div>
            <div className="resume-subsection">
              <h3>{language === 'en' ? 'Education' : '教育经历'}</h3>
              {copy.resume.education.map((item) => (
                <article className="resume-line" key={item.school}>
                  <strong>{item.school}</strong>
                  <span>{item.detail}</span>
                </article>
              ))}
            </div>
            <div className="resume-subsection">
              <h3>{language === 'en' ? 'Skills' : '技术栈'}</h3>
              <div className="skill-groups">
                {copy.resume.skills.map((group) => (
                  <div className="skill-group" key={group.group}>
                    <span>{group.group}</span>
                    <ul>
                      {group.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
            <div className="resume-subsection compact-list">
              <h3>{language === 'en' ? 'Certifications' : '资格证书'}</h3>
              <ul>
                {copy.resume.certifications.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="resume-subsection compact-list">
              <h3>{language === 'en' ? 'Languages' : '语言能力'}</h3>
              <ul>
                {copy.resume.languages.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block resume-timeline">
        <div className="section-heading">
          <h2>{language === 'en' ? 'Experience' : '工作经历'}</h2>
        </div>
        <div className="timeline-list">
          {copy.resume.experience.map((item) => (
            <article className="timeline-item" key={`${item.company}-${item.period}`}>
              <div>
                <p>{item.period}</p>
                <h3>{item.company}</h3>
                <span>{item.role}</span>
              </div>
              <ul>
                {item.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block resume-projects">
        <div className="section-heading">
          <h2>{language === 'en' ? 'Selected Projects' : '项目经验'}</h2>
        </div>
        <div className="resume-project-list">
          {copy.resume.projects.map((project) => (
            <article className="resume-project" key={`${project.name}-${project.period}`}>
              <div className="resume-project-head">
                <div>
                  <p>{project.period}</p>
                  <h3>{project.name}</h3>
                </div>
                <ul>
                  {project.stack.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <p>{project.description}</p>
              <ul className="project-highlights">
                {project.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
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
