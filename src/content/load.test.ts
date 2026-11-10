import { dump } from 'js-yaml';
import { loadSiteContent } from './load';
import { validSiteFixture, validResumeFixture } from './test-fixtures';

describe('YAML content loader', () => {
  it('assembles site and resume documents and removes generated metadata', () => {
    const site = loadSiteContent(
      'content/en/site.yml', dump({ ...validSiteFixture, _translation: { sourceHash: 'abc', policyVersion: 1 } }),
      'content/en/resume.yml', dump({ ...validResumeFixture, _translation: { sourceHash: 'def', policyVersion: 1 } })
    );
    expect(site.profile.name).toBe('MengLong Wang');
    expect(site.resume.summary).toBe(validResumeFixture.summary);
    expect(site).not.toHaveProperty('_translation');
    expect(site.resume).not.toHaveProperty('_translation');
  });

  it('includes the source path in invalid YAML errors', () => {
    expect(() => loadSiteContent('content/zh/site.yml', 'profile: [', 'content/zh/resume.yml', '{}'))
      .toThrow('content/zh/site.yml');
  });

  it('includes the resume source path in invalid YAML errors', () => {
    expect(() => loadSiteContent('site.yml', dump(validSiteFixture), 'resume.yml', 'summary: ['))
      .toThrow('resume.yml');
  });

  it('validates both documents with field paths', () => {
    expect(() => loadSiteContent('site.yml', dump({ ...validSiteFixture, nav: {} }), 'resume.yml', dump(validResumeFixture)))
      .toThrow('site.yml: nav.projects');
    expect(() => loadSiteContent('site.yml', dump(validSiteFixture), 'resume.yml', dump({ ...validResumeFixture, summary: '' })))
      .toThrow('resume.yml: summary');
  });

  it('rejects executable YAML tags', () => {
    expect(() => loadSiteContent('site.yml', '!!js/function >\n  function () { return 1; }', 'resume.yml', '{}'))
      .toThrow('site.yml');
  });
});
