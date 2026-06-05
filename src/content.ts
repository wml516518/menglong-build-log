export const languages = ['en', 'zh'] as const;

export type Language = (typeof languages)[number];

type Project = {
  title: string;
  status: string;
  summary: string;
  stack: string[];
  githubUrl: string;
  liveUrl: string;
};

type BuildLogEntry = {
  date: string;
  title: string;
  summary: string;
  tags: string[];
  relatedProject: string;
};

type SiteContent = {
  nav: {
    projects: string;
    buildLog: string;
    resume: string;
    about: string;
    contact: string;
  };
  profile: {
    name: string;
    role: string;
    eyebrow: string;
    headline: string;
    intro: string;
    primaryAction: string;
    secondaryAction: string;
  };
  sections: {
    projects: string;
    buildLog: string;
    about: string;
    contact: string;
    latestBuildLog: string;
    allPosts: string;
  };
  about: string;
  resume: {
    basics: {
      name: ResumeField;
      gender: ResumeField;
      birthDate: ResumeField;
      location: ResumeField;
      email: ResumeField;
      github: ResumeField;
      role: ResumeField;
    };
    summary: string;
    education: {
      school: string;
      detail: string;
    }[];
    skills: {
      group: string;
      items: string[];
    }[];
  };
  projects: Project[];
  buildLogs: BuildLogEntry[];
  contact: {
    label: string;
    value: string;
    href: string;
  }[];
};

const storageKey = 'portfolio-language';

type ResumeField = {
  label: string;
  value: string;
};

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

export const content: Record<Language, SiteContent> = {
  en: {
    nav: {
      projects: 'Projects',
      buildLog: 'Build Log',
      resume: 'Resume',
      about: 'About',
      contact: 'Contact'
    },
    profile: {
      name: 'MengLong Wang',
      role: 'Full-stack Developer',
      eyebrow: 'Portfolio / Build Log',
      headline: 'Building practical AI tools and full-stack products.',
      intro:
        'I document the products I build, the engineering decisions behind them, and the lessons learned along the way.',
      primaryAction: 'View Projects',
      secondaryAction: 'Read Log'
    },
    sections: {
      projects: 'Projects',
      buildLog: 'Build Log',
      about: 'About',
      contact: 'Contact',
      latestBuildLog: 'Latest Build Log',
      allPosts: 'All posts'
    },
    about:
      'I focus on full-stack development, AI products, and productivity tools. This site tracks my portfolio roadmap from a personal homepage to deployable AI applications.',
    resume: {
      basics: {
        name: { label: 'Name', value: 'MengLong Wang' },
        gender: { label: 'Gender', value: 'Male' },
        birthDate: { label: 'Date of Birth', value: '1993.12.28' },
        location: { label: 'Location', value: 'Shanghai, China' },
        email: { label: 'Email', value: 'wml565868@gmail.com' },
        github: { label: 'GitHub', value: 'github.com/wml516518' },
        role: { label: 'Role', value: 'Full-stack Developer' }
      },
      summary:
        'A full-stack developer based in Shanghai, focused on building practical web products, AI-enabled tools, and deployable engineering projects across frontend, backend, and DevOps workflows.',
      education: [
        {
          school: 'Henan Finance University',
          detail: 'Higher education background in finance and applied professional studies.'
        }
      ],
      skills: [
        { group: 'Frontend', items: ['Vue', 'React', 'TypeScript', 'Vite'] },
        { group: 'Backend', items: ['C#', 'Python', 'Node.js'] },
        { group: 'DevOps', items: ['Netlify', 'Render', 'Deployment workflows'] },
        { group: 'Direction', items: ['Full-stack products', 'AI tools', 'Build logs'] }
      ]
    },
    projects: [
      {
        title: 'Personal Homepage + Build Log',
        status: 'Live soon',
        summary: 'A bilingual portfolio front door and public project journal.',
        stack: ['React', 'Vite', 'TypeScript', 'Netlify'],
        githubUrl: '',
        liveUrl: ''
      },
      {
        title: 'AI Chat Playground',
        status: 'Next',
        summary: 'A model-switching chat interface with a Render-hosted API layer.',
        stack: ['React', 'Node or Python', 'Render'],
        githubUrl: '',
        liveUrl: ''
      },
      {
        title: 'Knowledge Base Demo',
        status: 'Planned',
        summary: 'A document Q&A demo for exploring practical RAG workflows.',
        stack: ['React', 'Python', 'Vector Search'],
        githubUrl: '',
        liveUrl: ''
      }
    ],
    buildLogs: [
      {
        date: '2026-06-05',
        title: 'Portfolio homepage and public build log',
        summary:
          'Designing the first portfolio project around clarity, bilingual content, and Netlify deployment.',
        tags: ['Portfolio', 'React', 'Netlify'],
        relatedProject: 'Personal Homepage + Build Log'
      },
      {
        date: 'Next',
        title: 'AI Chat Playground with model switching',
        summary: 'Planning a deployable chat interface with a lightweight backend API.',
        tags: ['AI', 'Chat', 'Render'],
        relatedProject: 'AI Chat Playground'
      },
      {
        date: 'Planned',
        title: 'Knowledge base demo and document Q&A',
        summary: 'Preparing a later project for document parsing, retrieval, and answer generation.',
        tags: ['RAG', 'Python', 'Documents'],
        relatedProject: 'Knowledge Base Demo'
      }
    ],
    contact: [
      { label: 'GitHub', value: 'github.com/wml516518', href: 'https://github.com/wml516518' },
      { label: 'Email', value: 'wml565868@gmail.com', href: 'mailto:wml565868@gmail.com' }
    ]
  },
  zh: {
    nav: {
      projects: '项目',
      buildLog: '构建日志',
      resume: '简历',
      about: '关于',
      contact: '联系'
    },
    profile: {
      name: 'MengLong Wang',
      role: '全栈开发者',
      eyebrow: '作品集 / 构建日志',
      headline: '构建实用的 AI 工具和全栈产品。',
      intro: '我会记录自己构建的产品、背后的工程决策，以及每个项目带来的经验。',
      primaryAction: '查看项目',
      secondaryAction: '阅读日志'
    },
    sections: {
      projects: '项目',
      buildLog: '构建日志',
      about: '关于',
      contact: '联系',
      latestBuildLog: '最新构建日志',
      allPosts: '全部文章'
    },
    about:
      '我专注于全栈开发、AI 产品和效率工具。这个网站会记录我的作品路线，从个人主页开始，逐步扩展到可部署的 AI 应用。',
    resume: {
      basics: {
        name: { label: '姓名', value: 'MengLong Wang' },
        gender: { label: '性别', value: '男' },
        birthDate: { label: '出生日期', value: '1993.12.28' },
        location: { label: '所在地', value: '中国上海' },
        email: { label: '邮箱', value: 'wml565868@gmail.com' },
        github: { label: 'GitHub', value: 'github.com/wml516518' },
        role: { label: '定位', value: '全栈开发者' }
      },
      summary:
        '我是一名位于上海的全栈开发者，关注实用 Web 产品、AI 工具和可部署工程项目，能力覆盖前端、后端与 DevOps 工作流。',
      education: [
        {
          school: '河南财政金融学院',
          detail: '具备财经与应用型专业教育背景。'
        }
      ],
      skills: [
        { group: '前端', items: ['Vue', 'React', 'TypeScript', 'Vite'] },
        { group: '后端', items: ['C#', 'Python', 'Node.js'] },
        { group: 'DevOps', items: ['Netlify', 'Render', '部署流程'] },
        { group: '方向', items: ['全栈产品', 'AI 工具', '构建日志'] }
      ]
    },
    projects: [
      {
        title: '个人主页 + 构建日志',
        status: '即将上线',
        summary: '一个中英双语的作品入口和公开项目记录。',
        stack: ['React', 'Vite', 'TypeScript', 'Netlify'],
        githubUrl: '',
        liveUrl: ''
      },
      {
        title: 'AI Chat Playground',
        status: '下一个',
        summary: '支持模型切换的聊天界面，并使用 Render 部署后端 API。',
        stack: ['React', 'Node 或 Python', 'Render'],
        githubUrl: '',
        liveUrl: ''
      },
      {
        title: '知识库问答 Demo',
        status: '计划中',
        summary: '用于展示文档解析、检索和回答生成的 RAG 工作流。',
        stack: ['React', 'Python', 'Vector Search'],
        githubUrl: '',
        liveUrl: ''
      }
    ],
    buildLogs: [
      {
        date: '2026-06-05',
        title: '个人主页和公开构建日志',
        summary: '围绕清晰表达、中英双语和 Netlify 部署设计第一个作品项目。',
        tags: ['作品集', 'React', 'Netlify'],
        relatedProject: '个人主页 + 构建日志'
      },
      {
        date: '下一个',
        title: '支持模型切换的 AI Chat Playground',
        summary: '规划一个可部署的聊天界面和轻量后端 API。',
        tags: ['AI', '聊天', 'Render'],
        relatedProject: 'AI Chat Playground'
      },
      {
        date: '计划中',
        title: '知识库问答 Demo',
        summary: '为后续文档解析、检索和回答生成项目做准备。',
        tags: ['RAG', 'Python', '文档'],
        relatedProject: '知识库问答 Demo'
      }
    ],
    contact: [
      { label: 'GitHub', value: 'github.com/wml516518', href: 'https://github.com/wml516518' },
      { label: '邮箱', value: 'wml565868@gmail.com', href: 'mailto:wml565868@gmail.com' }
    ]
  }
};
