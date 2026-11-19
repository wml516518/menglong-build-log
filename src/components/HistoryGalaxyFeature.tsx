import { ArrowUpRight } from 'lucide-react';
import type { FeaturedProject } from '../content';
import { TechnicalChallengeDetails } from './TechnicalChallengeDetails';

type HistoryGalaxyFeatureProps = {
  project: FeaturedProject;
  panelLabel: string;
  showDetailsLabel: string;
  hideDetailsLabel: string;
};

export function HistoryGalaxyFeature({
  project,
  panelLabel,
  showDetailsLabel,
  hideDetailsLabel
}: HistoryGalaxyFeatureProps) {
  return (
    <article className="history-feature">
      <div className="history-feature-copy">
        <p className="history-feature-status">{project.status}</p>
        <h3>{project.title}</h3>
        <p className="history-feature-summary">{project.summary}</p>
        <TechnicalChallengeDetails
          challenge={project.technicalChallenge}
          panelLabel={panelLabel}
          showLabel={showDetailsLabel}
          hideLabel={hideDetailsLabel}
          className="history-details"
          panelClassName="history-technical-challenge"
        />
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
