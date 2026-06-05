import { content, getInitialLanguage, languages } from './content';

describe('content', () => {
  it('contains English and Chinese site copy', () => {
    expect(languages).toEqual(['en', 'zh']);
    expect(content.en.profile.name).toBe('MengLong Wang');
    expect(content.zh.profile.name).toBe('MengLong Wang');
    expect(content.en.nav.projects).toBe('Projects');
    expect(content.zh.nav.projects).toBe('项目');
    expect(content.en.nav.resume).toBe('Resume');
    expect(content.zh.nav.resume).toBe('简历');
    expect(content.en.resume.basics.location.value).toBe('Shanghai, China');
    expect(content.zh.resume.basics.location.value).toBe('中国上海');
    expect(content.en.resume.education[0].school).toBe('Henan Finance University');
  });

  it('defaults to English when no stored language exists', () => {
    localStorage.clear();

    expect(getInitialLanguage()).toBe('en');
  });

  it('uses a stored Chinese language preference', () => {
    localStorage.setItem('portfolio-language', 'zh');

    expect(getInitialLanguage()).toBe('zh');
  });

  it('falls back to English for invalid stored values', () => {
    localStorage.setItem('portfolio-language', 'fr');

    expect(getInitialLanguage()).toBe('en');
  });
});
