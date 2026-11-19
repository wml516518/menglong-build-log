import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { SiteContent } from '../content/schema';

type TechnicalChallenge = SiteContent['projects'][number]['technicalChallenge'];

type TechnicalChallengeDetailsProps = {
  challenge: TechnicalChallenge;
  panelLabel: string;
  showLabel: string;
  hideLabel: string;
  className?: string;
  panelClassName?: string;
};

export function TechnicalChallengeDetails({
  challenge,
  panelLabel,
  showLabel,
  hideLabel,
  className = '',
  panelClassName = ''
}: TechnicalChallengeDetailsProps) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  return (
    <div className={`technical-details ${className}`.trim()}>
      <button
        type="button"
        className="technical-details-toggle"
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={`${expanded ? hideLabel : showLabel}: ${challenge.title}`}
        onClick={() => setExpanded((current) => !current)}
      >
        <span>{expanded ? hideLabel : showLabel}</span>
        <ChevronDown className="technical-details-chevron" aria-hidden="true" size={15} />
      </button>
      {expanded ? (
        <div id={panelId} className={`technical-challenge-panel ${panelClassName}`.trim()}>
          <p className="technical-challenge-label">
            {panelLabel} · {challenge.title}
          </p>
          <div>
            <p>{challenge.situation}</p>
            <ul>
              {challenge.response.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
