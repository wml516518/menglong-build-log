import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('App', () => {
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
    scrollIntoView.mockClear();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
  });

  it('renders the English portfolio homepage by default', () => {
    render(<App />);

    expect(screen.getAllByText('MengLong Wang').length).toBeGreaterThan(0);
    expect(screen.getByText('Building practical AI tools and full-stack products.')).toBeInTheDocument();
    expect(screen.getByText('Shanghai, China')).toBeInTheDocument();
    expect(screen.getByText('Henan Finance University')).toBeInTheDocument();
    expect(screen.getByText('SAIC Mobility Technology Co., Ltd.')).toBeInTheDocument();
    expect(screen.getByText('In-vehicle Intelligent Voice Interaction System')).toBeInTheDocument();
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
    expect(screen.getByText('车机智能语音交互系统（语音 2.0 / 3.0）')).toBeInTheDocument();
    expect(localStorage.getItem('portfolio-language')).toBe('zh');
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
});
