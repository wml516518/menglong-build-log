import { ArrowUpRight } from 'lucide-react';
import type { FeaturedProject } from '../content';

type HistoryGalaxyFeatureProps = {
  project: FeaturedProject;
};

export function HistoryGalaxyFeature({ project }: HistoryGalaxyFeatureProps) {
  return (
    <article className="history-feature">
      <div className="history-feature-copy">
        <p className="history-feature-status">{project.status}</p>
        <h3>{project.title}</h3>
        <p className="history-feature-summary">{project.summary}</p>
        <div className="technical-challenge">
          <p className="technical-challenge-label">{project.technicalChallenge.title}</p>
          <p>{project.technicalChallenge.situation}</p>
          <ul>
            {project.technicalChallenge.response.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <ul aria-label={project.stack.join(', ')}>
          {project.stack.map((item) => <li key={item}>{item}</li>)}
        </ul>
        <a className="history-feature-link" href="/apps/history-galaxy/">
          {project.action}
          <ArrowUpRight aria-hidden="true" size={18} />
        </a>
      </div>
      <figure className="history-feature-visual">
        <img src="/history-galaxy-preview.png" alt={project.imageAlt} width="1440" height="900" />
      </figure>
    </article>
  );
}
