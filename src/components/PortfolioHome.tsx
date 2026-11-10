import { Fragment, type ReactNode } from 'react';
import type { SiteContent, HomeSectionId } from '../content/schema';
import type { BuildLogPost } from '../posts';
import { BuildLogPreview } from './BuildLogPreview';
import { HistoryGalaxyFeature } from './HistoryGalaxyFeature';

export function PortfolioHome({ copy, posts }: { copy: SiteContent; posts: BuildLogPost[] }) {
  const sectionRenderers: Record<HomeSectionId, () => ReactNode> = {
    buildLog: () => (
      <BuildLogPreview
        posts={posts}
        title={copy.sections.latestBuildLog}
        allPostsLabel={copy.sections.allPosts}
        readArticleLabel={copy.sections.readArticle}
      />
    ),
    projects: () => (
      <section id="projects" className="section-block">
        <div className="section-heading">
          <h2>{copy.sections.projects}</h2>
        </div>
        <div className="project-list">
          <HistoryGalaxyFeature project={copy.historyGalaxy} />
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
              <div className="project-links">
                {project.liveUrl ? (
                  <a href={project.liveUrl} target="_blank" rel="noreferrer">
                    Live
                  </a>
                ) : null}
                {project.githubUrl ? (
                  <a href={project.githubUrl} target="_blank" rel="noreferrer">
                    GitHub
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    ),
    resume: () => (
      <section id="resume" className="section-block resume-section">
        <div className="section-heading">
          <h2>{copy.sections.resume}</h2>
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
              <h3>{copy.sections.education}</h3>
              {copy.resume.education.map((item) => (
                <article className="resume-line" key={item.school}>
                  <strong>{item.school}</strong>
                  <span>{item.detail}</span>
                </article>
              ))}
            </div>
            <div className="resume-subsection">
              <h3>{copy.sections.skills}</h3>
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
              <h3>{copy.sections.certifications}</h3>
              <ul>
                {copy.resume.certifications.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="resume-subsection compact-list">
              <h3>{copy.sections.languages}</h3>
              <ul>
                {copy.resume.languages.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    ),
    experience: () => (
      <section className="section-block resume-timeline">
        <div className="section-heading">
          <h2>{copy.sections.experience}</h2>
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
    ),
    resumeProjects: () => (
      <section className="section-block resume-projects">
        <div className="section-heading">
          <h2>{copy.sections.selectedProjects}</h2>
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
    ),
    about: () => (
      <section id="about" className="section-block two-column">
        <h2>{copy.sections.about}</h2>
        <p>{copy.about}</p>
      </section>
    ),
    contact: () => (
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
    ),
  };

  return <>{copy.homeSectionOrder.map((id) => <Fragment key={id}>{sectionRenderers[id]()}</Fragment>)}</>;
}
