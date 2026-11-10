import siteEn from '../content/en/site.yml?raw';
import resumeEn from '../content/en/resume.yml?raw';
import siteZh from '../content/zh/site.yml?raw';
import resumeZh from '../content/zh/resume.yml?raw';
import { loadSiteContent } from './content/load';
import type { Language, SiteContent } from './content/schema';

export { languages } from './content/schema';
export type { Language, SiteContent, FeaturedProject } from './content/schema';

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

export const content = {
  en: loadSiteContent('content/en/site.yml', siteEn, 'content/en/resume.yml', resumeEn),
  zh: loadSiteContent('content/zh/site.yml', siteZh, 'content/zh/resume.yml', resumeZh)
} satisfies Record<Language, SiteContent>;
