import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { PortfolioHome } from './components/PortfolioHome';
import { content } from './content';
import { parseSiteDocument, parseResumeDocument, stripTranslationMetadata } from './content/schema';
import { validSiteFixture, validResumeFixture } from './content/test-fixtures';
import { posts } from './posts';

describe('App', () => {
  it('renders a validated reordered fixture in CMS section order', () => {
    const copy = {
      ...stripTranslationMetadata(parseSiteDocument({
        ...validSiteFixture,
        homeSectionOrder: ['contact', 'about', 'resumeProjects', 'experience', 'resume', 'projects', 'buildLog']
      }, 'site.yml')),
      resume: stripTranslationMetadata(parseResumeDocument(validResumeFixture, 'resume.yml'))
    };
    render(<PortfolioHome copy={copy} posts={[]} />);
    const headings = ['联系', '关于', '项目经验', '工作经历', '简历', '项目', '最新日志']
      .map((name) => screen.getByRole('heading', { level: 2, name }));
    headings.slice(1).forEach((heading, index) => {
      expect(headings[index].compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  it('omits empty hero media and renders configured avatar and resume download', () => {
    const original = { ...content.en.profile };
    try {
      const { unmount } = render(<App />);
      expect(document.querySelector('#home img')).not.toBeInTheDocument();
      expect(document.querySelector('#home a[download]')).not.toBeInTheDocument();
      unmount();
      content.en.profile.avatar = '/avatar.png';
      content.en.profile.resumeDownload = '/resume.pdf';
      render(<App />);
      const avatar = screen.getByRole('img', { name: /MengLong Wang/ });
      expect(avatar).toHaveAttribute('src', '/avatar.png');
      expect(avatar).toHaveAttribute('width');
      expect(avatar).toHaveAttribute('height');
      expect(document.querySelector('#home a[download]')).toHaveAttribute('href', '/resume.pdf');
    } finally {
      Object.assign(content.en.profile, original);
    }
  });
  const scrollIntoView = vi.fn();
  let originalHead: string;
  let originalBodyClass: string;
  let originalLang: string;
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

  beforeEach(() => {
    originalLang = document.documentElement.lang;
    document.documentElement.lang = 'en';
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    originalHead = document.head.innerHTML;
    originalBodyClass = document.body.className;
    document.head.innerHTML = '<meta name="description" content=""><meta name="theme-color" content="">';
    document.body.classList.remove('history-route');
    localStorage.clear();
    window.location.hash = '';
    scrollIntoView.mockClear();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    document.documentElement.lang = originalLang;
    document.head.innerHTML = originalHead;
    document.body.className = originalBodyClass;
  });

  it('renders the English portfolio homepage by default', () => {
    render(<App />);

    expect(screen.getAllByText('MengLong Wang').length).toBeGreaterThan(0);
    expect(screen.getByText('Building practical AI tools and full-stack products.')).toBeInTheDocument();
    expect(screen.getByText('Shanghai, China')).toBeInTheDocument();
    expect(screen.getByText('Henan Finance University')).toBeInTheDocument();
    expect(screen.getByText('SAIC Mobility Technology Co., Ltd.')).toBeInTheDocument();
    expect(screen.getByText('Google AAA In-vehicle AI Agent (Voice 3.0)')).toBeInTheDocument();
    expect(screen.getByText('Microsoft InCarVA Voice Assistant (Voice 2.0 / 3.0)')).toBeInTheDocument();
    expect(screen.getAllByText('wml565868@gmail.com').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '中' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('AI Chat Playground with model switching')).toBeInTheDocument();
  });

  it('switches to Chinese and persists the preference', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '中' }));

    expect(screen.getByText('构建实用的 AI 工具和全栈产品。')).toBeInTheDocument();
    expect(screen.getByText('中国上海')).toBeInTheDocument();
    expect(screen.getByText('河南财政金融学院')).toBeInTheDocument();
    expect(screen.getByText('上汽海外出行科技有限公司')).toBeInTheDocument();
    expect(screen.getByText('谷歌 AAA 车载 AI Agent（Voice 3.0）')).toBeInTheDocument();
    expect(screen.getByText('微软车载语音助手 InCarVA（Voice 2.0 / 3.0）')).toBeInTheDocument();
    expect(localStorage.getItem('portfolio-language')).toBe('zh');
    expect(document.documentElement.lang).toBe('zh-CN');
    expect(document.title).toBe('王梦龙 | 作品集 + 构建日志');
    await user.click(screen.getByRole('button', { name: 'EN' }));
    expect(document.documentElement.lang).toBe('en');
  });

  it('features Weekend Merge in the bilingual project and resume sections', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getAllByText('Weekend Merge').length).toBeGreaterThanOrEqual(2);
    const projectSection = document.getElementById('projects')!;
    const englishCard = within(projectSection).getByRole('heading', { level: 3, name: 'Weekend Merge' }).closest('article')!;
    expect(within(englishCard).getByRole('link', { name: 'Live' }))
      .toHaveAttribute('href', 'https://weekend-merge-wml516518.netlify.app');
    expect(within(englishCard).getByRole('link', { name: 'GitHub' }))
      .toHaveAttribute('href', 'https://github.com/wml516518/weekend-merge');
    expect(screen.getByText(
      'An observable two-person weekend negotiation Agent that uses controlled tool calls to generate three compromise itineraries and locally replan only affected stops.'
    )).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '中' }));

    expect(screen.getAllByText('Weekend Merge / 周末共识局').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(
      '双人周末决策 Agent，通过可观察工具调用生成三套折中方案，并在否决后只重排受影响区段。'
    )).toBeInTheDocument();
    expect(screen.getByText(
      '一个面向双人周末协商的可观察 AI Agent，使用受控工具调用生成三套折中行程，并在否决地点后仅重排受影响区段。'
    )).toBeInTheDocument();
  });

  it('opens the complete build log index from the homepage', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('link', { name: 'All posts' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Build Log' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/build-log');
    expect(screen.getByRole('link', { name: 'AI Chat Playground with model switching' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'KnowledgeOps RAG document Q&A' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Portfolio homepage and public build log' })).toBeInTheDocument();
  });

  it('renders a Markdown article from a direct link', () => {
    window.location.hash = '#/build-log/ai-chat-playground';
    render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'AI Chat Playground with model switching' })
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Product direction' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to all posts' })).toBeInTheDocument();
  });

  it('hides a draft from the homepage, index, and direct article route', () => {
    const draft = { ...posts.find((post) => post.language === 'en')!, slug: 'private-draft', title: 'Private draft title', draft: true };
    posts.unshift(draft);
    try {
      for (const hash of ['', '#/build-log', '#/build-log/private-draft']) {
        window.location.hash = hash;
        const view = render(<App />);
        expect(screen.queryByText('Private draft title')).not.toBeInTheDocument();
        if (hash.endsWith('/private-draft')) expect(screen.getByRole('heading', { name: 'Article not found' })).toBeInTheDocument();
        view.unmount();
      }
    } finally {
      posts.splice(posts.indexOf(draft), 1);
    }
  });

  it('renders optional cover media on previews, the index, and articles', () => {
    const post = posts.find((entry) => entry.language === 'en')!;
    const original = post.coverImage;
    try {
      post.coverImage = '';
      let view = render(<App />);
      expect(screen.queryByRole('img', { name: post.title })).not.toBeInTheDocument();
      view.unmount();
      post.coverImage = '/uploads/cover.webp';
      for (const hash of ['', '#/build-log', `#/build-log/${post.slug}`]) {
        window.location.hash = hash;
        view = render(<App />);
        const image = screen.getByRole('img', { name: post.title });
        expect(image).toHaveAttribute('src', '/uploads/cover.webp');
        expect(image).toHaveAttribute('width', '1600');
        expect(image).toHaveAttribute('height', '900');
        if (hash !== `#/build-log/${post.slug}`) expect(image).toHaveAttribute('loading', 'lazy');
        view.unmount();
      }
    } finally {
      post.coverImage = original;
    }
  });

  it('returns to and scrolls to homepage sections from an article', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/build-log/ai-chat-playground';
    render(<App />);

    await user.click(screen.getByRole('link', { name: 'Projects' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Projects' })).toBeInTheDocument();
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    expect(window.location.hash).toBe('#projects');
  });

  it('shows a localized not-found state for an unknown article', () => {
    window.location.hash = '#/build-log/missing-article';
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'Article not found' })).toBeInTheDocument();
  });

  it('keeps the current article when switching language', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/build-log/portfolio-homepage';
    render(<App />);

    await user.click(screen.getByRole('button', { name: '中' }));

    expect(screen.getByRole('heading', { level: 1, name: '个人主页和公开构建日志' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '为什么要做这个网站' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: '标签' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/build-log/portfolio-homepage');
  });

  it('features History Galaxy first without mounting the 3D experience', () => {
    render(<App />);

    const projects = document.getElementById('projects')!;
    expect(within(projects).getAllByRole('article')[0]).toContainElement(
      screen.getByRole('heading', { level: 3, name: 'History Galaxy' })
    );
    expect(screen.getByRole('link', { name: /Enter the galaxy/ })).toHaveAttribute('href', '#/history-galaxy');
    expect(screen.queryByLabelText('三维历史时间轴')).not.toBeInTheDocument();
    expect(document.querySelector('canvas')).not.toBeInTheDocument();
  });

  it('localizes the featured History Galaxy project', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '中' }));

    expect(screen.getByRole('heading', { level: 3, name: '历史星河' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /进入星河/ })).toHaveAttribute('href', '#/history-galaxy');
  });

  it('opens History Galaxy and returns to the portfolio', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('link', { name: /Enter the galaxy/ }));
    expect(await screen.findByRole('heading', { level: 1, name: '历史星河' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/history-galaxy');
    expect(document.body).toHaveClass('history-route');
    expect(document.documentElement.lang).toBe('zh-CN');
    expect(document.title).toBe('历史星河｜中国历史3D交互时间轴');

    await user.click(screen.getByRole('link', { name: '返回主页' }));
    expect(await screen.findByText('Building practical AI tools and full-stack products.')).toBeInTheDocument();
    expect(window.location.hash).toBe('#home');
    expect(document.body).not.toHaveClass('history-route');
    expect(document.title).toBe('MengLong Wang | Portfolio + Build Log');
    expect(document.documentElement.lang).toBe('en');
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });

  it('cleans up history viewport mode on unmount', () => {
    window.location.hash = '#/history-galaxy';
    const { unmount } = render(<App />);
    expect(document.body).toHaveClass('history-route');
    expect(document.documentElement.lang).toBe('zh-CN');
    unmount();
    expect(document.body).not.toHaveClass('history-route');
    expect(document.documentElement.lang).toBe('en');
  });

  it('opens the shareable Build Log route from the hero action', async () => {
    const user = userEvent.setup();
    render(<App />);

    const hero = document.getElementById('home')!;
    await user.click(within(hero).getByRole('link', { name: 'Read Log' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Build Log' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/build-log');
  });

  it('scrolls #home to the document top instead of the hero section', () => {
    window.location.hash = '#home';
    render(<App />);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('restores a persisted Chinese document language after leaving History Galaxy', async () => {
    localStorage.setItem('portfolio-language', 'zh');
    window.location.hash = '#/history-galaxy';
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('link', { name: '返回主页' }));
    expect(await screen.findByText('构建实用的 AI 工具和全栈产品。')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('zh-CN');
  });

});
