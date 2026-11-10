import { JSON_SCHEMA, load } from 'js-yaml';
import { parseResumeDocument, parseSiteDocument, stripTranslationMetadata, type SiteContent } from './schema';

function parseYaml(path: string, source: string): unknown {
  try {
    return load(source, { schema: JSON_SCHEMA });
  } catch (error) {
    throw new Error(`${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function loadSiteContent(sitePath: string, siteYaml: string, resumePath: string, resumeYaml: string): SiteContent {
  const site = stripTranslationMetadata(parseSiteDocument(parseYaml(sitePath, siteYaml), sitePath));
  const resume = stripTranslationMetadata(parseResumeDocument(parseYaml(resumePath, resumeYaml), resumePath));
  return { ...site, resume };
}
