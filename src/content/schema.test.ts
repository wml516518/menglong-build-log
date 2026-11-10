import { describe, expect, it } from 'vitest';
import {
  homeSectionIds,
  parseResumeDocument,
  parseSiteDocument,
  stripTranslationMetadata
} from './schema';

const validSite = {
  nav: { projects: '项目', buildLog: '构建日志', resume: '简历', about: '关于', contact: '联系' },
  profile: {
    name: 'MengLong Wang', role: '全栈工程师', eyebrow: '作品集', headline: '构建产品',
    intro: '记录产品与工程实践。', primaryAction: '查看项目', secondaryAction: '阅读日志',
    avatar: '', resumeDownload: ''
  },
  sections: {
    projects: '项目', buildLog: '构建日志', resume: '简历', about: '关于', contact: '联系',
    latestBuildLog: '最新日志', allPosts: '全部文章', backToPosts: '返回文章',
    postNotFound: '未找到文章', readArticle: '阅读文章', tags: '标签', education: '教育经历',
    skills: '技术栈', certifications: '资格证书', languages: '语言能力',
    experience: '工作经历', selectedProjects: '项目经验'
  },
  about: '专注全栈与 AI 产品。',
  homeSectionOrder: ['buildLog', 'projects', 'resume', 'experience', 'resumeProjects', 'about', 'contact'],
  historyGalaxy: {
    title: '历史星河', status: '交互式 3D 作品', summary: '探索中国历史。',
    stack: ['Three.js'], action: '进入星河', imageAlt: '历史时间轴'
  },
  projects: [{
    title: '个人主页', status: '已上线', summary: '双语作品集。', stack: ['React'],
    githubUrl: 'https://github.com/wml516518/menglong-build-log',
    liveUrl: 'https://menglong-build-log.netlify.app'
  }],
  contact: [{ label: '邮箱', value: 'wml565868@gmail.com', href: 'mailto:wml565868@gmail.com' }],
  seo: {
    homeTitle: 'MengLong Wang | 作品集', buildLogTitle: '构建日志 | MengLong Wang',
    description: '个人主页、项目作品和构建日志。', socialImage: ''
  }
};

const validResume = {
  basics: {
    name: { label: '姓名', value: '王梦龙' }, gender: { label: '性别', value: '男' },
    birthDate: { label: '出生日期', value: '1993.12.28' },
    location: { label: '所在地', value: '中国上海' },
    email: { label: '邮箱', value: 'wml565868@gmail.com' },
    github: { label: 'GitHub', value: 'github.com/wml516518' },
    role: { label: '方向', value: '全栈开发工程师' }
  },
  summary: '专注可落地的全栈与 AI 产品。',
  education: [{ school: '河南财政金融学院', detail: '计算机软件，2013.09 - 2016.06' }],
  experience: [{ company: '上汽海外出行科技有限公司', role: '全栈工程师', period: '2025.07 - 至今', highlights: ['负责车载 AI Agent。'] }],
  projects: [{ name: '谷歌 AAA', period: '2025.07 - 至今', description: '车载 AI Agent。', highlights: ['覆盖车控能力。'], stack: ['Google AAA'] }],
  skills: [{ group: '前端', items: ['React'] }],
  certifications: ['软件设计师'],
  languages: ['英语：读写良好']
};

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
