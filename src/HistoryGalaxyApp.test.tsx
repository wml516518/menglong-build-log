import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HistoryGalaxyApp from './HistoryGalaxyApp';
import { readFileSync } from 'node:fs';
import { createHistoryContentLoader } from './history/content/loader';

const fixture = (path: string) => JSON.parse(readFileSync(`public/history-content/generated/${path}`, 'utf8'));
const productionCount = fixture('manifest.json').eventCount;
const testLoader = () => createHistoryContentLoader({ baseUrl: '/content/', fetchImpl: async input => new Response(JSON.stringify(fixture(String(input).replace('/content/', '')))) });
const timeline = () => within(screen.getByRole('region', { name: '二维历史时间轴' }));

describe('History Galaxy app', () => {
  it('exposes an identifiable content status region and retries a failed index', async () => {
    let broken = true;
    const loader = createHistoryContentLoader({ baseUrl: '/content/', fetchImpl: async input => {
      const path = String(input).replace('/content/', '');
      return broken && path.endsWith('events.compact.json') ? new Response('', { status: 503 }) : new Response(JSON.stringify(fixture(path)));
    } });
    render(<HistoryGalaxyApp loader={loader} />);
    const alert = await screen.findByRole('alert');
    expect(alert.closest('[aria-label="历史内容状态"]')).not.toBeNull();
    broken = false;
    await userEvent.click(within(alert).getByRole('button', { name: '重试历史内容' }));
    expect(await timeline().findAllByRole('button')).toHaveLength(productionCount);
  });
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
    expect(screen.getByText('先秦 - 1949')).toBeInTheDocument();
    expect(timeline().getByRole('button', { name: /商鞅变法/ })).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: '时代导航' })).getAllByRole('button')).toHaveLength(7);
  });

  it('provides all production historical events as accessible controls', async () => {
    await act(async () => { render(<HistoryGalaxyApp loader={testLoader()} />); });

    expect(timeline().getAllByRole('button')).toHaveLength(productionCount);
    expect(timeline().getByRole('button', { name: '查看历史事件：627 年 — 649 年 贞观之治' })).toBeInTheDocument();
    expect(timeline().getByRole('button', { name: '查看历史事件：1949 年 中华人民共和国成立' })).toBeInTheDocument();
  });

  it('opens a story with people and closes it', async () => {
    const user = userEvent.setup();
    await act(async () => { render(<HistoryGalaxyApp loader={testLoader()} />); });

    await user.click(timeline().getByRole('button', { name: '查看历史事件：1840 年 — 1842 年 鸦片战争' }));

    const dialog = screen.getByRole('dialog', { name: '鸦片战争' });
    expect(within(dialog).getByText('林则徐')).toBeInTheDocument();
    expect(await within(dialog).findByText(/鸦片贸易、禁烟与英国扩张政策/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: '关闭故事' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('moves through events with keyboard controls and closes on Escape', async () => {
    const user = userEvent.setup();
    await act(async () => { render(<HistoryGalaxyApp loader={testLoader()} />); });

    await user.click(timeline().getByRole('button', { name: '查看历史事件：1840 年 — 1842 年 鸦片战争' }));
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('dialog', { name: '南京条约签订' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('selects an era lead event from the dynasty navigation', async () => {
    const user = userEvent.setup();
    await act(async () => { render(<HistoryGalaxyApp loader={testLoader()} />); });

    await user.click(within(screen.getByRole('navigation', { name: '时代导航' })).getByRole('button', { name: '宋' }));

    const dialog = screen.getByRole('dialog', { name: '陈桥兵变' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByLabelText('960 年')).toBeInTheDocument();
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
    const eventButton = timeline().getByRole('button', { name: '查看历史事件：1919 年 五四运动' });

    eventButton.focus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('dialog', { name: '五四运动' })).toHaveFocus();
    expect(screen.getByRole('region', { name: '二维历史时间轴' })).toHaveClass('is-fallback');
  });
});


describe('compact content integration', () => {
  it('opens basic and core archives among all 1200 production events', async () => {
    const user = userEvent.setup();
    await act(async () => { render(<HistoryGalaxyApp loader={testLoader()} />); });
    const events = timeline();
    expect(events.getAllByRole('button')).toHaveLength(1200);
    expect(screen.getByText('全部事件 1200')).toBeInTheDocument();
    await user.click(events.getByRole('button', { name: /二里头都邑形成/ }));
    const basic = within(screen.getByRole('dialog', { name: '二里头都邑形成' }));
    expect(await basic.findByText('基础档案')).toBeInTheDocument();
    expect(basic.getByRole('link', { name: /完整/ })).toHaveAttribute('href', expect.stringContaining('/event/erlitou-urban-center'));
    await user.click(basic.getByRole('button', { name: '关闭故事' }));
    await user.click(events.getByRole('button', { name: /贞观之治/ }));
    const core = within(screen.getByRole('dialog', { name: '贞观之治' }));
    expect(await core.findByText(/隋末战乱之后，统治者需要恢复生产与政治秩序/)).toBeInTheDocument();
    expect(core.getByRole('link', { name: /完整/ })).toHaveAttribute('href', expect.stringContaining('/event/zhenguan'));
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
      const value = fixture(path);
      if (path === 'manifest.json') { value.legacyEventIds = []; value.legacyEventCount = 0; value.structuredEventCount = compact.length; value.basicEventCount = 0; value.coreEventCount = compact.length; value.eventCount = compact.length; value.periodCounts = Object.fromEntries(Object.keys(value.periodCounts).map(id => [id, compact.filter((event: { editorialPeriodId: string }) => event.editorialPeriodId === id).length])); }
      if (path.startsWith('eras/')) value.events = value.events.filter((event: { id: string }) => compact.some((item: { id: string }) => item.id === event.id));
      return new Response(JSON.stringify(path === 'indexes/events.compact.json' ? compact : value));
    } });
    const user = userEvent.setup();
    render(<HistoryGalaxyApp loader={loader} />);
    await within(await screen.findByRole('region', { name: '二维历史时间轴' })).findByRole('button', { name: '查看历史事件：627 年 — 649 年 索引中的唐代事件' });
    expect(timeline().getAllByRole('button')).toHaveLength(2);
    expect(paths.filter(path => path.startsWith('eras/'))).toEqual([]);
    await user.click(timeline().getByRole('button', { name: '查看历史事件：627 年 — 649 年 索引中的唐代事件' }));
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
    await user.click(await within(await screen.findByRole('region', { name: '二维历史时间轴' })).findByRole('button', { name: '查看历史事件：627 年 — 649 年 贞观之治' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('档案加载失败');
    expect(screen.getByText(fixture('indexes/events.compact.json').find((event: { id: string }) => event.id === 'zhenguan').summary)).toBeInTheDocument();
    broken = false;
    await user.click(screen.getByRole('button', { name: '重试档案' }));
    expect(await screen.findByText(/隋末战乱之后，统治者需要恢复生产与政治秩序/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
