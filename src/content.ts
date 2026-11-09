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

type ResumeExperience = {
  company: string;
  role: string;
  period: string;
  highlights: string[];
};

type ResumeProject = {
  name: string;
  period: string;
  description: string;
  highlights: string[];
  stack: string[];
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
    backToPosts: string;
    postNotFound: string;
    readArticle: string;
    tags: string;
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
    experience: ResumeExperience[];
    projects: ResumeProject[];
    skills: {
      group: string;
      items: string[];
    }[];
    certifications: string[];
    languages: string[];
  };
  projects: Project[];
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
      allPosts: 'All posts',
      backToPosts: 'Back to all posts',
      postNotFound: 'Article not found',
      readArticle: 'Read article',
      tags: 'Tags'
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
          detail: 'Computer Software, Associate Degree, 2013.09 - 2016.06.'
        }
      ],
      experience: [
        {
          company: 'SAIC Mobility Technology Co., Ltd.',
          role: 'Full-stack Engineer · AI Agent',
          period: '2025.07 - Present',
          highlights: [
            'Builds cloud capabilities for SAIC overseas intelligent-cockpit voice and in-vehicle AI Agent products as an on-site supplier engineer, supporting Google AAA and Microsoft InCarVA in parallel.',
            'Owns the vehicle-control intent taxonomy and English training data, Calendar & Mail Agent, proactive recommendations, and the NLU evaluation pipeline from intent definition and orchestration to in-vehicle validation.',
            'Designs Intent, Slot, ActionID, structured payload, and fallback TTS contracts for cloud LLM and local NLU execution paths.',
            'Coordinates protocol and release alignment across Google owners, Android vehicle-side teams, and TSP cloud teams, delivering through branch and pull-request workflows with reusable specifications and development guides.'
          ]
        },
        {
          company: 'FUJIFILM (China) Investment Co., Ltd.',
          role: '.NET Development Engineer',
          period: '2019.04 - 2025.04',
          highlights: [
            'Owned major development for Fabric 4.x imaging information system with .NET MVC, .NET Core, Redis, WebService, WCF, NHibernate, Spring.NET, React, Angular, jQuery, HTML, CSS, and JavaScript.',
            'Handled Fabric 3.0 customer-specific development, system upgrades, issue resolution, and performance tuning.',
            'Independently designed and delivered the PIS pulmonary nodule follow-up system from requirements, architecture, database design, development, testing, deployment, to acceptance.',
            'Developed and maintained Fantasy 2.x interfaces and supported integrations for hospital systems.'
          ]
        },
        {
          company: 'Zhejiang Xuanwei Medical Technology Co., Ltd.',
          role: '.NET Software Engineer',
          period: '2017.11 - 2019.04',
          highlights: [
            'Designed, developed, and delivered modules for the NIS nurse monitoring information system.',
            'Implemented business modules, unit tests, bug fixes, and technical design documentation.'
          ]
        },
        {
          company: 'Zhejiang Wanliyang Co., Ltd.',
          role: 'Software Development Engineer',
          period: '2016.06 - 2017.10',
          highlights: [
            'Started with software operations, OA workflow design, permissions, K3 permissions, and daily IT support.',
            'Built internal systems with VS2010 and SQL Server, including computer asset management, item borrowing platform, quality management modules, and Kingdee ERP secondary development.'
          ]
        }
      ],
      projects: [
        {
          name: 'Google AAA In-vehicle AI Agent (Voice 3.0)',
          period: '2025.07 - Present',
          description:
            'A next-generation in-vehicle Agent built with Google, using intents, tools, and orchestration across 16 business domains including vehicle control, navigation, media, weather, calendar, mail, and proactive recommendations.',
          highlights: [
            'Designed Intent and Slot models for 13 vehicle-control domains and 400+ functions, delivering CustomAction, structured payloads, English training phrases, and consistent actionId, result-code, and TTS contracts.',
            'Owned the Calendar & Mail component, implementing six event and mail workflows through Google Calendar and Outlook M365 providers; tokens stay in HTTPS headers and mail operations create drafts instead of sending directly.',
            'Implemented cross-domain proactive services for low-battery charging, destination parking, and upcoming-calendar reminders through reusable named actions.',
            'Contributed to account- and audio-zone-isolated short-, medium-, and long-term memory, with a 20-turn/16K-token window, 30-day summaries, and long-term profiles.',
            'Built an NLU batch evaluation pipeline for intent, action_id, payload, and fallback TTS validation, producing failure analysis that drives intent-boundary and training-data improvements.'
          ],
          stack: ['Google AAA (CCA)', 'Intent / Slot', 'CustomAction', 'ServerWrapper', 'NLU Evaluation']
        },
        {
          name: 'Microsoft InCarVA Voice Assistant (Voice 2.0 / 3.0)',
          period: '2025.07 - Present',
          description:
            'SAIC overseas in-vehicle voice assistant built on Microsoft Azure voice and the M365 ecosystem for multilingual markets.',
          highlights: [
            'Develops and maintains the Voice 2.0 backend conversation service, using large models to convert natural-language requests into structured vehicle instructions.',
            'Designs prompt and intent-classification strategies for multiple audio zones, multi-turn context, and ambiguous references, with safe fallback responses for unsupported vehicle functions.',
            'Integrates Outlook and M365 calendar and mail, TSP weather aggregation, navigation, location search, and vehicle control behind unified actionId and payload contracts.',
            'Maintains multilingual TTS copy for consistent meaning, controlled length, and natural phrasing across supported languages.',
            'Investigates production logs, fixes defects, optimizes interfaces, and coordinates Microsoft and vehicle-side integration to protect release quality and response time.'
          ],
          stack: ['Microsoft Azure Voice', 'M365 / Outlook', '.NET', 'Prompt Engineering', 'multilingual TTS']
        },
        {
          name: 'Fabric 4.x Imaging Information System',
          period: '2019.04 - 2025.04',
          description: 'Medical radiology, ultrasound, and endoscopy information system with BS admin modules and CS workflows.',
          highlights: [
            'Owned full-stack admin site development, including frontend architecture, API design, and database management.',
            'Developed more than 10 background scheduled services and maintained production modules.',
            'Supported domestic OS testing and maintenance with Linux, Docker, and DevOps workflows.'
          ],
          stack: ['.NET Core 6', 'Vue', 'SqlSugar', 'SQLite', 'SQL Server', 'Docker']
        },
        {
          name: 'Fantasy 2.x Ultrasound Endoscopy System',
          period: '2024.01 - 2025.04',
          description: 'Medical ultrasound endoscopy system with customization and third-party integrations.',
          highlights: [
            'Resolved customer-specific requirements and production issues.',
            'Built call-screen display features with Vue and SignalR message pushing.',
            'Designed and documented HIS, CA, and third-party system interfaces.'
          ],
          stack: ['WinForms', 'SQL Server', 'Vue', 'SignalR']
        },
        {
          name: 'CITA Medical Information Reference Application',
          period: '2022.03 - 2025.04',
          description: 'Integrated hospital information, images, and documents for medical progress review and decision support.',
          highlights: [
            'Participated in research, evaluation, implementation, deployment, and maintenance for Jilin, Zhuhai, Guangzhou, and other hospital projects.'
          ],
          stack: ['Healthcare IT', 'Implementation', 'System Integration']
        },
        {
          name: 'Pulmonary Nodule Follow-up System (PIS)',
          period: '2019.10 - 2020.01',
          description: 'Follow-up system covering patient, examination, and pulmonary nodule information management.',
          highlights: [
            'Independently led system design, database design, development, testing, deployment, and acceptance.',
            'Implemented CRUD workflows, FastReport reports, Excel export, and medical report printing.'
          ],
          stack: ['WinForms', 'SQL Server', 'FastReport', 'Excel Export']
        },
        {
          name: 'Fabric 3.0 Radiology System',
          period: '2019.04 - 2025.04',
          description: 'BS radiology system for hospital customization, issue resolution, and system integration.',
          highlights: [
            'Handled daily customer-specific requirements and solved performance issues from code and database layers.',
            'Designed and implemented third-party interfaces such as mutual recognition platform, CA, infectious disease upload, and ID card scanning.'
          ],
          stack: ['.NET MVC', 'NHibernate', 'Spring.NET', 'Angular', 'jQuery']
        },
        {
          name: 'Nurse Management System (NIS)',
          period: '2017.11 - 2019.03',
          description: 'Mobile-oriented BS nurse management system.',
          highlights: [
            'Developed transfer order, nursing record, and maintenance modules.'
          ],
          stack: ['.NET MVC', 'Bootstrap', 'jQuery', 'HTML', 'CSS']
        },
        {
          name: 'Quality Management Platform',
          period: '2017.07 - 2017.10',
          description: 'Internal system for managing transmission quality issues, after-sales issues, and typical case data.',
          highlights: [
            'Implemented Excel import/export, data maintenance, and reporting features.'
          ],
          stack: ['WPF', 'SQL Server 2008 R2']
        }
      ],
      skills: [
        { group: 'Frontend', items: ['Vue', 'React', 'Angular', 'Element UI', 'Bootstrap', 'jQuery', 'HTML', 'CSS', 'JavaScript'] },
        { group: 'Backend', items: ['C#', '.NET Core', '.NET MVC', 'Web API', 'SignalR', 'WCF', 'WebService', 'Redis', 'RabbitMQ', 'SqlSugar', 'EF', 'NHibernate'] },
        { group: 'Database', items: ['SQL Server', 'Oracle', 'MySQL', 'SQLite'] },
        { group: 'DevOps', items: ['Linux', 'Docker', 'Kubernetes', 'DevOps workflows', 'Netlify', 'Render'] },
        { group: 'AI', items: ['LLM API', 'Prompt Engineering', 'Function Calling', 'RAG', 'Dify', 'n8n', 'Coze', 'Ollama'] }
      ],
      certifications: ['Software Designer Certificate', 'Driving License'],
      languages: ['English: good listening, speaking, reading, and writing']
    },
    projects: [
      {
        title: 'Personal Homepage + Build Log',
        status: 'Live',
        summary: 'A bilingual portfolio front door and public project journal.',
        stack: ['React', 'Vite', 'TypeScript', 'Netlify'],
        githubUrl: 'https://github.com/wml516518/menglong-build-log',
        liveUrl: 'https://menglong-build-log.netlify.app'
      },
      {
        title: 'AI Chat Playground',
        status: 'Live frontend',
        summary: 'A streaming chat interface with prompt presets and a FastAPI backend layer.',
        stack: ['React', 'FastAPI', 'Python', 'Render', 'Netlify'],
        githubUrl: 'https://github.com/wml516518/ai-chat-playground',
        liveUrl: 'https://ai-chat-playground-menglong.netlify.app'
      },
      {
        title: 'KnowledgeOps RAG',
        status: 'Live frontend',
        summary: 'A public document Q&A demo with FastAPI retrieval flow, Supabase pgvector storage, and deploy-ready AI service wiring.',
        stack: ['React', 'FastAPI', 'Supabase', 'pgvector', 'DashScope', 'Render', 'Netlify'],
        githubUrl: 'https://github.com/wml516518/knowledgeops-rag',
        liveUrl: 'https://knowledgeops-rag-menglong.netlify.app'
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
      allPosts: '全部文章',
      backToPosts: '返回全部文章',
      postNotFound: '未找到文章',
      readArticle: '阅读文章',
      tags: '标签'
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
          detail: '计算机软件（大专），2013.09 - 2016.06。'
        }
      ],
      experience: [
        {
          company: '上汽海外出行科技有限公司',
          role: '全栈工程师 · AI Agent 方向',
          period: '2025.07 - 至今',
          highlights: [
            '以供应商驻场身份负责上汽海外智能座舱语音与车载 AI Agent 的云端能力建设，并行支撑谷歌 AAA 与微软 InCarVA 两条技术路线。',
            '负责车控域意图体系与英语训练语料、日程邮件 Agent、主动推荐和 NLU 评测链路，覆盖意图定义、编排实现到上车验证的完整闭环。',
            '设计 Intent、Slot、ActionID、结构化 payload 与失败 TTS 契约，兼容云端大模型与本地 NLU 执行链路。',
            '与 Google Owner、Android 地端和 TSP 云端团队对齐协议与发布节奏，按分支与 Pull Request 流程交付，并沉淀意图命名规范、开发讲义和流程文档。'
          ]
        },
        {
          company: '富士胶片（中国）投资有限公司',
          role: '.NET 开发工程师',
          period: '2019.04 - 2025.04',
          highlights: [
            '单独负责 Fabric 4.x 影像信息系统主版本开发，覆盖 .NET MVC、.NET Core、Redis、WebService、WCF、NHibernate、Spring.NET、React、Angular、jQuery、HTML、CSS、JavaScript 等技术。',
            '负责 Fabric 3.0 客户化支持、需求开发、系统升级、问题定位与性能优化。',
            '独立完成 PIS 肺结节随访系统从概要设计、详细设计、数据库设计、代码开发、测试、实施到验收的全流程。',
            '负责 Fantasy 2.x 系统接口开发与维护，并支持多个医院项目的调研、实施和维护。'
          ]
        },
        {
          company: '浙江轩威医疗科技有限公司',
          role: '.NET 软件工程师',
          period: '2017.11 - 2019.04',
          highlights: [
            '负责 NIS 护士监护信息系统的模块设计、开发与交付。',
            '负责编码、单元测试、Bug 修复和技术设计文档编写。'
          ]
        },
        {
          company: '浙江万里扬股份有限公司',
          role: '软件开发工程师',
          period: '2016.06 - 2017.10',
          highlights: [
            '前期负责软件运维、OA 流程设计、OA/K3 权限开通和计算机日常维护。',
            '后期使用 VS2010 与 SQL Server 开发公司内部系统，包括计算机台账管理、物品借用平台、质量管理平台模块以及金蝶 ERP 二次开发。'
          ]
        }
      ],
      projects: [
        {
          name: '谷歌 AAA 车载 AI Agent（Voice 3.0）',
          period: '2025.07 - 至今',
          description:
            '与 Google 联合打造的下一代车载智能体，用“意图 + 工具 + 编排”覆盖车控、导航、媒体、天气、日程邮件和主动推荐等 16 个业务领域。',
          highlights: [
            '负责 13 个车控领域、400+ 功能点的 Intent / Slot 设计，落地 CustomAction、结构化 payload 与英语训练语料，统一 actionId、结果码与 TTS 契约。',
            '作为 Owner 独立设计并实现 Calendar & Mail 组件，通过 Google Calendar 与 Outlook M365 双 Provider 覆盖日程查询、创建、修改、删除以及邮件查询、草稿创建六类接口。',
            '落地低电量推荐充电桩、到达目的地前推荐停车场、日程临期提醒等跨域主动服务。',
            '参与按账号与音区隔离的短、中、长期记忆设计，包含 20 轮 / 16K token 窗口、30 天中期摘要与长期画像。',
            '搭建 NLU 批量评测链路，校验 intent、action_id、payload 与不支持功能 TTS，输出失败归因并驱动意图边界和训练语料收敛。'
          ],
          stack: ['Google AAA (CCA)', 'Intent / Slot', 'CustomAction', 'ServerWrapper', 'NLU 评测']
        },
        {
          name: '微软车载语音助手 InCarVA（Voice 2.0 / 3.0）',
          period: '2025.07 - 至今',
          description:
            '上汽海外面向多语言市场的车载语音助手，基于微软 Azure 语音与 M365 生态支撑 Voice 2.0 / 3.0 渠道。',
          highlights: [
            '负责 Voice 2.0 后端会话服务的开发与维护，接入大模型完成语义理解与意图识别，将自然语言解析为结构化车机指令。',
            '设计多场景 Prompt 与意图分类策略，处理多音区、多轮上下文与模糊指代，对车型不支持功能返回安全兜底播报。',
            '对接 Outlook / M365 日程邮件、TSP 天气聚合、导航、地点查询与车控能力，统一 actionId 与 payload 协议。',
            '维护多语种 TTS 文案，保证同一意图在不同语言下语义一致、长度可控与断句自然。',
            '负责线上日志排查、Bug 修复与接口性能优化，协同微软与车机端联调，保障发布质量和响应耗时。'
          ],
          stack: ['Microsoft Azure 语音', 'M365 / Outlook', '.NET', 'Prompt Engineering', '多语种 TTS']
        },
        {
          name: 'Fabric4.x 影像信息系统',
          period: '2019.04 - 2025.04',
          description: '医疗行业放射、超声、内镜信息系统，包含 CS 业务端与 BS 后台管理网站。',
          highlights: [
            '独立负责后台管理网站全栈开发，包括前端架构、API 接口设计和数据库管理。',
            '独立开发 10 个以上后台任务调度服务，并维护相关生产模块。',
            '支持国产系统测试与维护，涉及 Linux、Docker、DevOps 等技术。'
          ],
          stack: ['.NET Core 6', 'Vue', 'SqlSugar', 'SQLite', 'SQL Server', 'Docker']
        },
        {
          name: 'Fantasy2.x 超声内镜系统',
          period: '2024.01 - 2025.04',
          description: '医疗行业超声内镜系统，负责客户化需求、问题解决和第三方系统集成。',
          highlights: [
            '处理客户化需求和生产问题。',
            '使用 Vue + SignalR 实现叫号屏自动消息推送。',
            '负责 HIS、CA 等系统接口设计、实现和接口文档编写。'
          ],
          stack: ['WinForms', 'SQL Server', 'Vue', 'SignalR']
        },
        {
          name: 'CITA 医疗信息参考应用',
          period: '2022.03 - 2025.04',
          description: '汇集医院医疗信息、检查图像和文档，辅助患者进度查看与医疗政策考虑。',
          highlights: [
            '参与吉林、珠海、广州等医院项目的调研、评估、实施、部署与维护。'
          ],
          stack: ['医疗信息化', '实施部署', '系统集成']
        },
        {
          name: '肺结节随访系统（PIS）',
          period: '2019.10 - 2020.01',
          description: '肺结节随访系统，覆盖病人信息、检查信息、肺结节信息管理和报表输出。',
          highlights: [
            '独立负责系统整体设计、数据库设计、开发、测试、实施和验收。',
            '实现病人、检查、肺结节信息 CRUD，FastReport 报表、Excel 导出和打印报告功能。'
          ],
          stack: ['WinForms', 'SQL Server', 'FastReport', 'Excel 导出']
        },
        {
          name: 'Fabric3.0 放射系统',
          period: '2019.04 - 2025.04',
          description: '医疗行业 BS 架构放射系统，负责客户化需求、性能优化和第三方接口。',
          highlights: [
            '处理日常客户化问题与需求，从代码和数据库层面解决系统卡慢问题。',
            '负责互认平台、CA、感染病上传、身份证刷卡等第三方接口设计与实现。'
          ],
          stack: ['.NET MVC', 'NHibernate', 'Spring.NET', 'Angular', 'jQuery']
        },
        {
          name: '护士管理系统（NIS）',
          period: '2017.11 - 2019.03',
          description: '移动端护士管理系统，BS 架构。',
          highlights: [
            '负责转运单、护理记录单开发和其他模块维护。'
          ],
          stack: ['.NET MVC', 'Bootstrap', 'jQuery', 'HTML', 'CSS']
        },
        {
          name: '质量管理平台',
          period: '2017.07 - 2017.10',
          description: '面向质量管理部的变速器质量管理软件，覆盖零公里问题、售后问题和典型案例问题。',
          highlights: [
            '实现 Excel 导入导出、数据维护和报表呈现等功能。'
          ],
          stack: ['WPF', 'SQL Server 2008 R2']
        },
        {
          name: '物品借用平台 / 计算机台账管理系统',
          period: '2016.10 - 2017.06',
          description: '公司内部资产与借用管理工具。',
          highlights: [
            '实现物品借用、归还、库存、借用人等信息管理。',
            '实现计算机台账 Excel 导入、数据增删查改、部门维护、人员维护和权限设置。'
          ],
          stack: ['WinForms', 'SQL Server 2008 R2']
        }
      ],
      skills: [
        { group: '前端', items: ['Vue', 'React', 'Angular', 'ElementUI', 'Bootstrap', 'jQuery', 'HTML', 'CSS', 'JavaScript'] },
        { group: '后端', items: ['C#', '.NET Core', '.NET MVC', 'Web API', 'SignalR', 'WCF', 'WebService', 'Redis', 'RabbitMQ', 'SqlSugar', 'EF', 'NHibernate'] },
        { group: '数据库', items: ['SQL Server', 'Oracle', 'MySQL', 'SQLite'] },
        { group: 'DevOps', items: ['Linux', 'Docker', 'Kubernetes', 'DevOps 流程', 'Netlify', 'Render'] },
        { group: 'AI', items: ['大模型调用', 'Prompt Engineering', 'Function Calling', 'RAG', 'Dify', 'n8n', 'Coze', 'Ollama'] }
      ],
      certifications: ['软件设计师', '驾驶执照'],
      languages: ['英语：听说能力良好，读写能力良好']
    },
    projects: [
      {
        title: '个人主页 + 构建日志',
        status: '已上线',
        summary: '一个中英双语的作品入口和公开项目记录。',
        stack: ['React', 'Vite', 'TypeScript', 'Netlify'],
        githubUrl: 'https://github.com/wml516518/menglong-build-log',
        liveUrl: 'https://menglong-build-log.netlify.app'
      },
      {
        title: 'AI Chat Playground',
        status: '前端已上线',
        summary: '带 Prompt 预设和 FastAPI 后端层的流式 AI 聊天界面。',
        stack: ['React', 'FastAPI', 'Python', 'Render', 'Netlify'],
        githubUrl: 'https://github.com/wml516518/ai-chat-playground',
        liveUrl: 'https://ai-chat-playground-menglong.netlify.app'
      },
      {
        title: 'KnowledgeOps RAG',
        status: '前端已上线',
        summary: '公开文档问答 Demo，包含 FastAPI 检索流程、Supabase pgvector 存储和可部署的 AI 服务接线。',
        stack: ['React', 'FastAPI', 'Supabase', 'pgvector', 'DashScope', 'Render', 'Netlify'],
        githubUrl: 'https://github.com/wml516518/knowledgeops-rag',
        liveUrl: 'https://knowledgeops-rag-menglong.netlify.app'
      }
    ],
    contact: [
      { label: 'GitHub', value: 'github.com/wml516518', href: 'https://github.com/wml516518' },
      { label: '邮箱', value: 'wml565868@gmail.com', href: 'mailto:wml565868@gmail.com' }
    ]
  }
};
