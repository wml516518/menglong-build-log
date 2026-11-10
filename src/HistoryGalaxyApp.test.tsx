import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HistoryGalaxyApp from './HistoryGalaxyApp';
import { readFileSync } from 'node:fs';
import { createHistoryContentLoader } from './history/content/loader';
import { generateScaleFixture } from './history/fixtures/generateScaleFixture';

const fixture = (path: string) => JSON.parse(readFileSync(`public/history-content/generated/${path}`, 'utf8'));
const testLoader = () => createHistoryContentLoader({ baseUrl: '/content/', fetchImpl: async input => new Response(JSON.stringify(fixture(String(input).replace('/content/', '')))) });

describe('History Galaxy app', () => {
  it('provides a route back to the portfolio homepage', async () => {
    await act(async () => { render(<HistoryGalaxyApp loader={testLoader()} />); });

    expect(screen.getByRole('link', { name: '返回主页' })).toHaveAttribute('href', '#home');
  });

  beforeEach(() => {
    window.location.hash = '';
  });

  it('opens directly as the Chinese history galaxy with seven era controls', async () => {
    await act(async () => { render(<HistoryGalaxyApp loader={testLoader()} />); });

    expect(screen.getByRole('heading', { level: 1, name: '历史星河' })).toBeInTheDocument();
    expect(screen.getByText('公元 618 - 1949')).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: '时代导航' })).getAllByRole('button')).toHaveLength(7);
  });

  it('provides all thirty historical events as accessible controls', async () => {
    await act(async () => { render(<HistoryGalaxyApp loader={testLoader()} />); });

    expect(screen.getAllByRole('button', { name: /查看历史事件/ })).toHaveLength(30);
    expect(screen.getByRole('button', { name: '查看历史事件：627年 贞观之治' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看历史事件：1949年 中华人民共和国成立' })).toBeInTheDocument();
  });

  it('opens a story with people and closes it', async () => {
    const user = userEvent.setup();
    await act(async () => { render(<HistoryGalaxyApp loader={testLoader()} />); });

    await user.click(screen.getByRole('button', { name: '查看历史事件：1840年 鸦片战争' }));

    const dialog = screen.getByRole('dialog', { name: '鸦片战争' });
    expect(within(dialog).getByText('林则徐')).toBeInTheDocument();
    expect(await within(dialog).findByText(/鸦片贸易、禁烟与英国扩张政策/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: '关闭故事' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('moves through events with keyboard controls and closes on Escape', async () => {
    const user = userEvent.setup();
    await act(async () => { render(<HistoryGalaxyApp loader={testLoader()} />); });

    await user.click(screen.getByRole('button', { name: '查看历史事件：1840年 鸦片战争' }));
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('dialog', { name: '太平天国' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('selects an era lead event from the dynasty navigation', async () => {
    const user = userEvent.setup();
    await act(async () => { render(<HistoryGalaxyApp loader={testLoader()} />); });

    await user.click(within(screen.getByRole('navigation', { name: '时代导航' })).getByRole('button', { name: '宋' }));

    const dialog = screen.getByRole('dialog', { name: '陈桥兵变' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByLabelText('960年')).toBeInTheDocument();
  });

  it('keeps every era navigation button operational', async () => {
    const user = userEvent.setup();
    await act(async () => { render(<HistoryGalaxyApp loader={testLoader()} />); });
    const navigation = screen.getByRole('navigation', { name: '时代导航' });

    for (const era of ['唐', '五代', '宋', '元', '明', '清', '近代']) {
      const eraButton = within(navigation).getByRole('button', { name: era });
      await user.click(eraButton);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(eraButton).toHaveAttribute('aria-pressed', 'true');
    }
  });

  it('opens a focused event with Enter and exposes the 2D fallback list', async () => {
    const user = userEvent.setup();
    await act(async () => { render(<HistoryGalaxyApp loader={testLoader()} />); });
    const eventButton = screen.getByRole('button', { name: '查看历史事件：1919年 五四运动' });

    eventButton.focus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('dialog', { name: '五四运动' })).toHaveFocus();
    expect(screen.getByRole('region', { name: '二维历史时间轴' })).toHaveClass('is-fallback');
  });
});


describe('compact content integration', () => {
  it('opens a real archive among 1200 loaded events', async () => {
    const events = generateScaleFixture(fixture('manifest.json').eras, 1199);
    const real = fixture('indexes/events.compact.json').find((event: { id: string }) => event.id === 'zhenguan');
    const loader = createHistoryContentLoader({ baseUrl: '/content/', fetchImpl: async input => {
      const path = String(input).replace('/content/', '');
      return new Response(JSON.stringify(path === 'indexes/events.compact.json' ? [...events, real] : fixture(path)));
    } });
    const user = userEvent.setup();
    render(<HistoryGalaxyApp loader={loader} />);
    await screen.findByRole('button', { name: '查看历史事件：627年 贞观之治' });
    expect(screen.getAllByRole('button', { name: /查看历史事件/ })).toHaveLength(1200);
    await user.click(screen.getByRole('button', { name: '查看历史事件：627年 贞观之治' }));
    expect(await screen.findByText(/隋末战乱之后，统治者需要恢复生产与政治秩序/)).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByRole('link', { name: /完整/ })).toHaveAttribute('href', expect.stringContaining('/event/zhenguan'));
  });
  it('navigates only fetched compact events and loads only the selected era archive', async () => {
    const paths: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const compact = fixture('indexes/events.compact.json').filter((event: { id: string }) => ['zhenguan', 'chenqiao'].includes(event.id));
    compact[0].title = '索引中的唐代事件';
    compact[1].title = '索引中的宋代事件';
    const loader = createHistoryContentLoader({ baseUrl: '/content/', fetchImpl: async input => {
      const path = String(input).replace('/content/', '');
      paths.push(path);
      if (path.startsWith('eras/')) await gate;
      return new Response(JSON.stringify(path === 'indexes/events.compact.json' ? compact : fixture(path)));
    } });
    const user = userEvent.setup();
    render(<HistoryGalaxyApp loader={loader} />);
    await screen.findByRole('button', { name: '查看历史事件：627年 索引中的唐代事件' });
    expect(screen.getAllByRole('button', { name: /查看历史事件/ })).toHaveLength(2);
    expect(paths.filter(path => path.startsWith('eras/'))).toEqual([]);
    await user.click(screen.getByRole('button', { name: '查看历史事件：627年 索引中的唐代事件' }));
    expect(screen.getByRole('dialog', { name: '索引中的唐代事件' })).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByRole('status')).toHaveTextContent('正在加载档案');
    await act(async () => { release(); });
    expect(await screen.findByText(/隋末战乱之后，统治者需要恢复生产与政治秩序/)).toBeInTheDocument();
    expect(paths.filter(path => path.startsWith('eras/'))).toEqual(['eras/tang.json']);
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('dialog', { name: '索引中的宋代事件' })).toBeInTheDocument();
    expect(await screen.findByText(/五代后期军队与政权更替紧密相连/)).toBeInTheDocument();
    expect(paths.filter(path => path.startsWith('eras/'))).toEqual(['eras/tang.json', 'eras/song.json']);
  });
  it('shows archive failure while keeping compact summary and allows scoped retry', async () => {
    let broken = true;
    const loader = createHistoryContentLoader({ baseUrl: '/content/', fetchImpl: async input => {
      const path = String(input).replace('/content/', '');
      if (broken && path === 'eras/tang.json') throw new Error('offline');
      return new Response(JSON.stringify(fixture(path)));
    } });
    const user = userEvent.setup();
    render(<HistoryGalaxyApp loader={loader} />);
    await user.click(await screen.findByRole('button', { name: '查看历史事件：627年 贞观之治' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('档案加载失败');
    expect(screen.getByText('纳谏、任贤与制度修整，塑造唐初政治气象。')).toBeInTheDocument();
    broken = false;
    await user.click(screen.getByRole('button', { name: '重试档案' }));
    expect(await screen.findByText(/隋末战乱之后，统治者需要恢复生产与政治秩序/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
