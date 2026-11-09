import { content, getInitialLanguage, languages } from './content';

describe('content', () => {
  it('contains English and Chinese site copy', () => {
    expect(languages).toEqual(['en', 'zh']);
    expect(content.en.historyGalaxy).toMatchObject({
      title: 'History Galaxy',
      status: 'Interactive 3D experience',
      action: 'Enter the galaxy'
    });
    expect(content.zh.historyGalaxy).toMatchObject({
      title: '历史星河',
      status: '交互式 3D 作品',
      action: '进入星河'
    });
    expect(content.en.profile.name).toBe('MengLong Wang');
    expect(content.zh.profile.name).toBe('MengLong Wang');
    expect(content.en.nav.projects).toBe('Projects');
    expect(content.zh.nav.projects).toBe('项目');
    expect(content.en.nav.resume).toBe('Resume');
    expect(content.zh.nav.resume).toBe('简历');
    expect(content.en.sections.backToPosts).toBe('Back to all posts');
    expect(content.zh.sections.backToPosts).toBe('返回全部文章');
    expect(content.en.sections.postNotFound).toBe('Article not found');
    expect(content.en.sections.tags).toBe('Tags');
    expect(content.zh.sections.postNotFound).toBe('未找到文章');
    expect(content.zh.sections.tags).toBe('标签');
    expect(content.en.resume.basics.location.value).toBe('Shanghai, China');
    expect(content.zh.resume.basics.location.value).toBe('中国上海');
    expect(content.en.resume.education[0].school).toBe('Henan Finance University');
    expect(content.zh.resume.experience[0].company).toBe('上汽海外出行科技有限公司');
    expect(content.zh.resume.projects[0].name).toContain('谷歌 AAA');
    expect(content.zh.resume.certifications).toContain('软件设计师');
  });

  it('presents the SAIC role as two bilingual AI Agent project tracks', () => {
    expect(content.zh.resume.experience[0].role).toBe('全栈工程师 · AI Agent 方向');
    expect(content.en.resume.experience[0].role).toBe('Full-stack Engineer · AI Agent');

    expect(content.zh.resume.projects.slice(0, 2).map((project) => project.name)).toEqual([
      '谷歌 AAA 车载 AI Agent（Voice 3.0）',
      '微软车载语音助手 InCarVA（Voice 2.0 / 3.0）'
    ]);
    expect(content.en.resume.projects.slice(0, 2).map((project) => project.name)).toEqual([
      'Google AAA In-vehicle AI Agent (Voice 3.0)',
      'Microsoft InCarVA Voice Assistant (Voice 2.0 / 3.0)'
    ]);

    expect(content.zh.resume.projects[0].highlights.join(' ')).toContain('400+');
    expect(content.zh.resume.projects[0].highlights.join(' ')).toContain('Calendar & Mail');
    expect(content.zh.resume.projects[1].highlights.join(' ')).toContain('多语种 TTS');
    expect(content.en.resume.projects[0].highlights.join(' ')).toContain('400+');
    expect(content.en.resume.projects[1].highlights.join(' ')).toContain('multilingual TTS');
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
