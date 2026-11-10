import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import HistoryGalaxyApp from '../HistoryGalaxyApp';
import { createHistoryContentLoader } from '../history/content/loader';
import type { CompactHistoryEventIndex } from '../history/content/schema';
import { createSearchWorkerHandler } from '../history/search/search.worker';
import type { SearchRequest, SearchResponse, SearchWorker } from '../history/search/protocol';

const fixture = (path: string) => JSON.parse(readFileSync(`public/history-content/generated/${path}`, 'utf8'));
const place = { id: 'changan', name: '长安', modernName: '西安', aliases: [], historicalNames: [], coordinates: [108.9, 34.3], eventIds: ['zhenguan'] };
const theme = { id: 'institutions', title: '制度的沿革与社会变迁专题', summary: '沿着制度理解历史。', eventIds: ['zhenguan'] };
function testLoader(events?: CompactHistoryEventIndex[]) {
  return createHistoryContentLoader({ baseUrl: '/content/', fetchImpl: async input => {
    const path = String(input).replace('/content/', '');
    const value = path.endsWith('places.compact.json') ? [place] : path.endsWith('themes.compact.json') ? [theme]
      : path.endsWith('events.compact.json') ? (events ?? fixture(path).map((event: CompactHistoryEventIndex) => event.id === 'zhenguan' ? { ...event, placeIds: ['changan'], themeIds: ['institutions'] } : event)) : fixture(path);
    return new Response(JSON.stringify(value));
  } });
}

// The only search double is Worker transport. Index construction and ranking run unchanged.
class LocalWorker implements SearchWorker {
  static instances: LocalWorker[] = [];
  onmessage: SearchWorker['onmessage'] = null;
  onerror: SearchWorker['onerror'] = null;
  terminated = false;
  hold = false;
  requests: SearchRequest[] = [];
  queued: SearchResponse[] = [];
  private handler = createSearchWorkerHandler((response: SearchResponse) => {
    if (this.hold) this.queued.push(response);
    else this.onmessage?.(new MessageEvent('message', { data: response }));
  });
  constructor() { LocalWorker.instances.push(this); }
  postMessage(request: SearchRequest) { this.requests.push(request); this.handler(request); }
  terminate() { this.terminated = true; }
}
function mobile(matches: boolean) {
  vi.stubGlobal('matchMedia', () => ({ matches, media: '(max-width: 820px)', addEventListener() {}, removeEventListener() {} }));
}
async function openApp(events?: CompactHistoryEventIndex[]) {
  await act(async () => { render(<HistoryGalaxyApp loader={testLoader(events)} />); });
}
function eventButton(title: string) { return screen.getByRole('button', { name: new RegExp(`查看历史事件：.*${title}`) }); }
function resultButtons() { return within(screen.getByRole('list', { name: '搜索结果' })).getAllByRole('button'); }

beforeEach(() => {
  window.history.replaceState(null, '', '#/history-galaxy');
  LocalWorker.instances = [];
  vi.stubGlobal('Worker', LocalWorker);
  mobile(false);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('restores combined category, year and influence filters from the URL and dims every unmatched event', async () => {
  window.history.replaceState(null, '', '#/history-galaxy?cat=war&from=700&to=800&min=5&keep=a&keep=b');
  await openApp();
  expect(screen.getByRole('checkbox', { name: '战争' })).toBeChecked();
  expect(screen.getByRole('spinbutton', { name: '起始年份' })).toHaveValue(700);
  expect(screen.getByRole('slider', { name: '最低影响力' })).toHaveValue('5');
  expect(eventButton('安史之乱')).toHaveAttribute('data-match', 'true');
  expect(eventButton('贞观之治')).toHaveAttribute('data-match', 'false');
  expect(eventButton('两税法')).toHaveAttribute('data-opacity', '0.15');
  expect(screen.getAllByRole('button', { name: /查看历史事件/ })).toHaveLength(30);
  fireEvent.change(screen.getByRole('spinbutton', { name: '结束年份' }), { target: { value: '900' } });
  const params = new URLSearchParams(window.location.hash.split('?')[1]);
  expect(params.get('to')).toBe('900');
  expect(params.getAll('keep')).toEqual(['a', 'b']);
});

it('keeps typing responsive and replaces the URL and ranked Chinese search only after 150 ms', async () => {
  const events: CompactHistoryEventIndex[] = fixture('indexes/events.compact.json').slice(0, 4);
  events[1] = { ...events[1], title: '唐太宗', influence: 1 };
  events[2] = { ...events[2], title: '宫廷旧事', aliases: ['唐太宗'], influence: 2 };
  events[3] = { ...events[3], summary: '唐太宗的后世研究' };
  await openApp(events);
  vi.useFakeTimers();
  const push = vi.spyOn(window.history, 'pushState');
  const replace = vi.spyOn(window.history, 'replaceState');
  const input = screen.getByRole('searchbox', { name: '搜索历史' });
  fireEvent.change(input, { target: { value: '唐' } });
  await act(async () => { await vi.advanceTimersByTimeAsync(100); });
  fireEvent.change(input, { target: { value: '唐太宗' } });
  expect(input).toHaveValue('唐太宗');
  await act(async () => { await vi.advanceTimersByTimeAsync(149); });
  expect(replace).not.toHaveBeenCalled();
  expect(LocalWorker.instances[0]?.requests.filter(request => request.type === 'query')).toHaveLength(0);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(replace).toHaveBeenCalledTimes(1);
  expect(push).not.toHaveBeenCalled();
  expect(new URLSearchParams(window.location.hash.split('?')[1]).get('q')).toBe('唐太宗');
  expect(resultButtons().map(button => button.textContent)).toEqual([
    expect.stringContaining('唐太宗'), expect.stringContaining('宫廷旧事'), expect.stringContaining('贞观之治'), expect.stringContaining('两税法')
  ]);
  expect(eventButton('贞观之治')).toHaveAttribute('data-match', 'true');
  push.mockRestore(); replace.mockRestore();
});

it('focuses the exact searched event and retains the query while opening its archive', async () => {
  const user = userEvent.setup();
  await openApp();
  await user.type(screen.getByRole('searchbox', { name: '搜索历史' }), '贞观');
  await user.click(await screen.findByRole('button', { name: '聚焦历史事件：627年 贞观之治' }));
  expect(screen.getByRole('dialog', { name: '贞观之治' })).toHaveFocus();
  expect(eventButton('贞观之治')).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('searchbox', { name: '搜索历史' })).toHaveValue('贞观');
});

it('applies explicit filters immediately, preserves archive paths and clears controls with one action', async () => {
  window.history.replaceState({ keep: 1 }, '', '#/history-galaxy/event/zhenguan?keep=a');
  const user = userEvent.setup();
  await openApp();
  await user.click(screen.getByRole('checkbox', { name: '仅重大事件' }));
  expect(window.location.hash).toBe('#/history-galaxy/event/zhenguan?keep=a&major=1');
  expect(eventButton('两税法')).toHaveAttribute('data-match', 'false');
  expect(window.history.state).toEqual({ keep: 1 });
  await user.click(screen.getByRole('checkbox', { name: '制度' }));
  expect(eventButton('安史之乱')).toHaveAttribute('data-match', 'false');
  expect(eventButton('贞观之治')).toHaveAttribute('data-match', 'true');
  await user.click(screen.getByRole('button', { name: '清除全部筛选' }));
  expect(screen.getByRole('checkbox', { name: '仅重大事件' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: '制度' })).not.toBeChecked();
  expect(eventButton('两税法')).toHaveAttribute('data-match', 'true');
  expect(window.location.hash).toBe('#/history-galaxy/event/zhenguan?keep=a');
});

it('restores controls and results on Back and cancels a pending typing URL write', async () => {
  const user = userEvent.setup();
  await openApp();
  await user.click(screen.getByRole('checkbox', { name: '战争' }));
  await user.click(screen.getByRole('checkbox', { name: '仅重大事件' }));
  window.history.back();
  await waitFor(() => expect(screen.getByRole('checkbox', { name: '仅重大事件' })).not.toBeChecked());
  expect(screen.getByRole('checkbox', { name: '战争' })).toBeChecked();
  vi.useFakeTimers();
  fireEvent.change(screen.getByRole('searchbox', { name: '搜索历史' }), { target: { value: '安史' } });
  act(() => {
    window.history.replaceState(null, '', '#/history-galaxy?q=贞观&cat=institution');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(screen.getByRole('searchbox', { name: '搜索历史' })).toHaveValue('贞观');
  expect(screen.getByRole('checkbox', { name: '制度' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: '战争' })).not.toBeChecked();
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
  expect(new URLSearchParams(window.location.hash.split('?')[1]).get('q')).toBe('贞观');
  expect(resultButtons()).toHaveLength(1);
  act(() => {
    window.history.replaceState(null, '', '#/history-galaxy?era=song');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  expect(screen.getByRole('searchbox', { name: '搜索历史' })).toHaveValue('');
  expect(eventButton('贞观之治')).toHaveAttribute('data-match', 'false');
});

it('combines era, person, place and theme menus using the fetched compact indexes', async () => {
  const user = userEvent.setup();
  await openApp();
  for (const [menu, label] of [['时代', '唐'], ['人物', '唐太宗'], ['地点', '长安'], ['专题', theme.title]]) {
    await user.click(screen.getByText(menu, { selector: 'summary span' }));
    await user.click(screen.getByRole('checkbox', { name: label, exact: true }));
  }
  expect(eventButton('贞观之治')).toHaveAttribute('data-match', 'true');
  expect(eventButton('开元盛世')).toHaveAttribute('data-match', 'false');
  const params = new URLSearchParams(window.location.hash.split('?')[1]);
  expect(params.get('era')).toBe('tang');
  expect(params.get('person')).toBe('person-li-shimin');
  expect(params.get('place')).toBe('changan');
  expect(params.get('theme')).toBe('institutions');
});

it('collapses the desktop work panel and restores it without resetting active filters', async () => {
  const user = userEvent.setup();
  await openApp();
  await user.click(screen.getByRole('checkbox', { name: '仅重大事件' }));
  await user.click(screen.getByRole('button', { name: '收起历史探索器' }));
  expect(screen.queryByRole('searchbox', { name: '搜索历史' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '展开历史探索器' }));
  expect(screen.getByRole('checkbox', { name: '仅重大事件' })).toBeChecked();
});

it('lets users edit a year across intermediate digits without clamping away their intended value', async () => {
  window.history.replaceState(null, '', '#/history-galaxy?from=700');
  const user = userEvent.setup();
  await openApp();
  const end = screen.getByRole('spinbutton', { name: '结束年份' });
  await user.clear(end);
  await user.type(end, '900');
  expect(end).toHaveValue(900);
  await user.tab();
  expect(new URLSearchParams(window.location.hash.split('?')[1]).get('to')).toBe('900');
});

it('leaves mobile arrow navigation focus on its tab and enters the panel only after activation', async () => {
  mobile(true);
  const user = userEvent.setup();
  await openApp();
  const events = screen.getByRole('tab', { name: '事件' });
  events.focus();
  await user.keyboard('{ArrowRight}');
  const search = screen.getByRole('tab', { name: '搜索' });
  expect(search).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(screen.getByRole('searchbox', { name: '搜索历史' })).toHaveFocus();
});

it('provides the four mobile views and restores keyboard focus after closing the drawer', async () => {
  mobile(true);
  const user = userEvent.setup();
  await openApp();
  const tabs = screen.getByRole('tablist', { name: '历史探索视图' });
  expect(within(tabs).getAllByRole('tab').map(tab => tab.textContent)).toEqual(['事件', '搜索', '筛选', '专题']);
  const searchTab = within(tabs).getByRole('tab', { name: '搜索' });
  await user.click(searchTab);
  expect(screen.getByRole('searchbox', { name: '搜索历史' })).toHaveFocus();
  await user.type(screen.getByRole('searchbox', { name: '搜索历史' }), '贞观');
  await user.keyboard('{Escape}');
  expect(searchTab).toHaveFocus();
  expect(screen.queryByRole('dialog', { name: '历史探索' })).not.toBeInTheDocument();
  await user.click(searchTab);
  expect(screen.getByRole('searchbox', { name: '搜索历史' })).toHaveValue('贞观');
  await user.click(await screen.findByRole('button', { name: '聚焦历史事件：627年 贞观之治' }));
  expect(screen.queryByRole('dialog', { name: '历史探索' })).not.toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: '贞观之治' })).toHaveFocus();
  await user.click(screen.getByRole('button', { name: '关闭故事' }));
  await user.click(within(tabs).getByRole('tab', { name: '筛选' }));
  expect(screen.getByRole('checkbox', { name: '仅重大事件' })).toBeInTheDocument();
  await user.click(within(tabs).getByRole('tab', { name: '专题' }));
  expect(screen.getByRole('checkbox', { name: theme.title })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '关闭探索抽屉' }));
  expect(within(tabs).getByRole('tab', { name: '专题' })).toHaveFocus();
  await user.click(within(tabs).getByRole('tab', { name: '事件' }));
  expect(screen.getByRole('list', { name: '匹配事件' })).toBeInTheDocument();
});

it('recovers a failed worker with usable prefix results and a deterministic Chinese fallback state', async () => {
  await openApp();
  const worker = LocalWorker.instances[0];
  expect(worker).toBeDefined();
  worker.hold = true;
  vi.useFakeTimers();
  fireEvent.change(screen.getByRole('searchbox', { name: '搜索历史' }), { target: { value: '贞观' } });
  await act(async () => { await vi.advanceTimersByTimeAsync(150); });
  await act(async () => { worker.onerror?.(new ErrorEvent('error', { message: 'private worker error' })); });
  expect(screen.getByText('已切换为简易搜索，可按事件或人物名称前缀查找。')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '聚焦历史事件：627年 贞观之治' })).toBeInTheDocument();
  expect(screen.queryByText(/private worker error/)).not.toBeInTheDocument();
  expect(worker.terminated).toBe(true);
});

it('retains a single search index across control changes and disposes it on unmount', async () => {
  const user = userEvent.setup();
  const view = render(<HistoryGalaxyApp loader={testLoader()} />);
  await screen.findByRole('searchbox', { name: '搜索历史' });
  await waitFor(() => expect(screen.queryByText('正在加载历史索引…')).not.toBeInTheDocument());
  const count = LocalWorker.instances.length;
  await user.click(screen.getByRole('checkbox', { name: '战争' }));
  await user.click(screen.getByRole('checkbox', { name: '仅重大事件' }));
  expect(LocalWorker.instances).toHaveLength(count);
  view.unmount();
  expect(LocalWorker.instances.every(worker => worker.terminated)).toBe(true);
});

it('ignores superseded and late Worker responses without showing failure or changing the current query', async () => {
  await openApp();
  const worker = LocalWorker.instances[0]; worker.hold = true;
  vi.useFakeTimers();
  const input = screen.getByRole('searchbox', { name: '搜索历史' });
  fireEvent.change(input, { target: { value: '安史' } });
  await act(async () => { await vi.advanceTimersByTimeAsync(150); });
  fireEvent.change(input, { target: { value: '贞观' } });
  await act(async () => { await vi.advanceTimersByTimeAsync(150); });
  await act(async () => {
    for (const response of worker.queued) worker.onmessage?.(new MessageEvent('message', { data: response }));
  });
  expect(resultButtons()).toHaveLength(1);
  expect(resultButtons()[0]).toHaveAccessibleName('聚焦历史事件：627年 贞观之治');
  expect(screen.queryByText(/已切换为简易搜索|搜索暂时不可用/)).not.toBeInTheDocument();
  expect(input).toHaveValue('贞观');
});

it('replaces the search index on content changes, disposes pending work and uses the new joined place index', async () => {
  window.history.replaceState(null, '', '#/history-galaxy?q=长安');
  const view = render(<HistoryGalaxyApp loader={testLoader()} />);
  expect(await screen.findByRole('button', { name: '聚焦历史事件：627年 贞观之治' })).toBeInTheDocument();
  const old = LocalWorker.instances[0]; old.hold = true;
  const events: CompactHistoryEventIndex[] = fixture('indexes/events.compact.json').slice(0, 1);
  events[0] = { ...events[0], placeIds: ['changan'], title: '更新后的长安事件' };
  await act(async () => { view.rerender(<HistoryGalaxyApp loader={testLoader(events)} />); });
  expect(old.terminated).toBe(true);
  expect(await screen.findByRole('button', { name: '聚焦历史事件：627年 更新后的长安事件' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '聚焦历史事件：627年 贞观之治' })).not.toBeInTheDocument();
});
