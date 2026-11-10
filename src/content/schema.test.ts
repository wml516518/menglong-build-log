import { describe, expect, it } from 'vitest';
import {
  homeSectionIds,
  parseResumeDocument,
  parseSiteDocument,
  stripTranslationMetadata
} from './schema';

import { validSiteFixture as validSite, validResumeFixture as validResume } from './test-fixtures';

describe('content schema', () => {
  it('accepts the complete site and resume documents', () => {
    expect(parseSiteDocument(validSite, 'site.yml').homeSectionOrder).toEqual(homeSectionIds);
    expect(parseResumeDocument(validResume, 'resume.yml').experience[0].company).toBe('上汽海外出行科技有限公司');
  });

  it.each([
    ['duplicate', ['buildLog', 'projects', 'resume', 'experience', 'resumeProjects', 'about', 'about']],
    ['missing', ['buildLog', 'projects', 'resume', 'experience', 'resumeProjects', 'about']],
    ['unknown', ['buildLog', 'projects', 'resume', 'experience', 'resumeProjects', 'about', 'other']]
  ])('rejects a %s homepage section order', (_, homeSectionOrder) => {
    expect(() => parseSiteDocument({ ...validSite, homeSectionOrder }, 'site.yml')).toThrow('site.yml');
  });

  it('reports a precise required-field path', () => {
    expect(() => parseResumeDocument({ ...validResume, summary: '' }, 'resume.yml')).toThrow('resume.yml: summary');
  });

  it('strips generated translation metadata', () => {
    expect(stripTranslationMetadata({ ...validSite, _translation: { sourceHash: 'abc', policyVersion: 1 } }))
      .not.toHaveProperty('_translation');
  });

  it('accepts a reordered complete homepage section set', () => {
    const homeSectionOrder = [...validSite.homeSectionOrder].reverse();
    expect(parseSiteDocument({ ...validSite, homeSectionOrder }, 'site.yml').homeSectionOrder)
      .toEqual(homeSectionOrder);
  });

  it.each([
    { ...validSite, unexpected: true },
    { ...validSite, profile: { ...validSite.profile, unexpected: true } },
    { ...validSite, projects: [{ ...validSite.projects[0], unexpected: true }] },
    { ...validSite, _translation: { sourceHash: 'abc', policyVersion: 1, unexpected: true } }
  ])('rejects unknown fields at object boundaries', (document) => {
    expect(() => parseSiteDocument(document, 'site.yml')).toThrow('site.yml:');
  });

  it('reports nested required copy paths and trims valid copy', () => {
    expect(() => parseResumeDocument({
      ...validResume, experience: [{ ...validResume.experience[0], company: '  ' }]
    }, 'resume.yml')).toThrow('resume.yml: experience.0.company');
    expect(parseResumeDocument({ ...validResume, summary: ' 摘要 ' }, 'resume.yml').summary).toBe('摘要');
  });

  it.each(['ftp://example.com/project', 'javascript:alert(1)', '/project', 'not a url'])
  ('rejects non-HTTP project links: %s', (githubUrl) => {
    expect(() => parseSiteDocument({
      ...validSite, projects: [{ ...validSite.projects[0], githubUrl }]
    }, 'site.yml')).toThrow('site.yml: projects.0.githubUrl');
  });

  it.each(['https://example.com', 'http://example.com', 'mailto:hello@example.com'])
  ('accepts contact protocol: %s', (href) => {
    expect(parseSiteDocument({
      ...validSite, contact: [{ ...validSite.contact[0], href }]
    }, 'site.yml').contact[0].href).toBe(href);
  });

  it.each(['javascript:alert(1)', 'ftp://example.com', 'mailto:', 'not a url'])
  ('rejects unsupported or malformed contact links: %s', (href) => {
    expect(() => parseSiteDocument({
      ...validSite, contact: [{ ...validSite.contact[0], href }]
    }, 'site.yml')).toThrow('site.yml: contact.0.href');
  });

  it('accepts omitted media and validated translation metadata', () => {
    const { avatar, resumeDownload, ...profile } = validSite.profile;
    const { socialImage, ...seo } = validSite.seo;
    const document = parseSiteDocument({
      ...validSite, profile, seo, _translation: { sourceHash: 'abc', policyVersion: 1 }
    }, 'site.yml');
    expect(document._translation).toEqual({ sourceHash: 'abc', policyVersion: 1 });
    expect(stripTranslationMetadata(document).profile).toEqual(profile);
    expect(document).toHaveProperty('_translation');
    expect(stripTranslationMetadata(parseSiteDocument(validSite, 'site.yml'))).toEqual(validSite);
  });
});
