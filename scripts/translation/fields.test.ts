// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { validResumeFixture, validSiteFixture } from '../../src/content/test-fixtures';
import { parseResumeDocument, parseSiteDocument } from '../../src/content/schema';
import { collectResumeSegments, collectSiteSegments, applyResumeTranslations, applySiteTranslations } from './fields';

const site = () => parseSiteDocument(validSiteFixture, 'fixture');
const resume = () => parseResumeDocument(validResumeFixture, 'fixture');
const identity = (segments: { id: string; text: string }[]) => new Map(segments.map(s => [s.id, s.text]));

describe('structured translation policy', () => {
  it('collects only approved prose paths in deterministic order', () => {
    const ids = collectSiteSegments(site()).map(s => s.id);
    expect(ids).toEqual(collectSiteSegments(site()).map(s => s.id));
    expect(ids).toEqual(expect.arrayContaining(['profile.headline', 'projects.0.summary', 'contact.0.label']));
    for (const path of ['projects.0.githubUrl', 'projects.0.stack.0', 'homeSectionOrder.0', 'contact.0.value', 'profile.avatar']) expect(ids).not.toContain(path);
    const resumeIds = collectResumeSegments(resume()).map(s => s.id);
    expect(resumeIds).toEqual(expect.arrayContaining(['basics.name.value', 'basics.birthDate.label', 'education.0.detail', 'skills.0.group', 'certifications.0', 'languages.0']));
    for (const path of ['basics.birthDate.value', 'basics.email.value', 'basics.github.value', 'projects.0.stack.0', 'skills.0.items.0']) expect(resumeIds).not.toContain(path);
    expect(collectResumeSegments(resume()).every(s => s.context.length > 0)).toBe(true);
  });

  it('restores copy while preserving protected values, source and array shapes', () => {
    const source = resume();
    const translations = identity(collectResumeSegments(source));
    translations.set('summary', 'A full-stack engineer focused on practical AI products.');
    translations.set('experience.0.company', 'SAIC Mobility Technology Co., Ltd.');
    const translated = applyResumeTranslations(source, translations);
    expect(translated.experience[0].company).toBe('SAIC Mobility Technology Co., Ltd.');
    expect(translated.summary).toBe(translations.get('summary'));
    expect(translated.experience[0].period).toBe('2025.07 - 至今');
    expect(translated.projects[0].stack).toEqual(['Google AAA']);
    expect(translated.skills).toEqual(source.skills);
    expect(source).toEqual(resume());
    const siteSource = site();
    const siteTranslations = identity(collectSiteSegments(siteSource));
    siteTranslations.set('profile.headline', 'Building products');
    const siteResult = applySiteTranslations(siteSource, siteTranslations);
    expect(siteResult.profile.headline).toBe('Building products');
    expect(siteResult.projects).toEqual(siteSource.projects);
    expect(siteResult.homeSectionOrder).toEqual(siteSource.homeSectionOrder);
    expect(siteResult.contact).toEqual(siteSource.contact);
  });

  it('rejects missing, extra, protected and blank translations', () => {
    const source = resume();
    const translations = identity(collectResumeSegments(source));
    translations.delete('summary');
    expect(() => applyResumeTranslations(source, translations)).toThrow(/missing/i);
    translations.set('summary', 'Summary');
    for (const [key, value] of [['projects.1.name', 'extra'], ['projects.0.stack.0', 'changed']]) {
      translations.set(key, value);
      expect(() => applyResumeTranslations(source, translations)).toThrow(/extra|protected/i);
      translations.delete(key);
    }
    translations.set('summary', '  ');
    expect(() => applyResumeTranslations(source, translations)).toThrow(/blank/i);
  });
});

it('localizes user-facing period, stack and skill labels except exact protected glossary tokens', () => {
  const source = resume();
  source.projects[0].stack = ['Google AAA', 'Google AAA (CCA)', 'NLU 评测'];
  source.skills[0].items = ['React', '大模型调用'];
  const ids = collectResumeSegments(source).map(segment => segment.id);
  expect(ids).toEqual(expect.arrayContaining(['experience.0.period', 'projects.0.period', 'projects.0.stack.1', 'projects.0.stack.2', 'skills.0.items.1']));
  expect(ids).not.toContain('projects.0.stack.0');
  expect(ids).not.toContain('skills.0.items.0');
  const siteSource = site();
  siteSource.historyGalaxy.stack = ['React', '30 个历史事件'];
  expect(collectSiteSegments(siteSource).map(segment => segment.id)).toContain('historyGalaxy.stack.1');
  expect(collectSiteSegments(siteSource).map(segment => segment.id)).not.toContain('historyGalaxy.stack.0');
});

it('allows localized periods while preserving every numeric date token', () => {
  const source = resume();
  const translations = identity(collectResumeSegments(source));
  translations.set('experience.0.period', '2025.07 - Present');
  expect(applyResumeTranslations(source, translations).experience[0].period).toBe('2025.07 - Present');
  translations.set('experience.0.period', '2026.07 - Present');
  expect(() => applyResumeTranslations(source, translations)).toThrow(/date/i);
  translations.set('experience.0.period', 'Present');
  expect(() => applyResumeTranslations(source, translations)).toThrow(/date/i);
});
