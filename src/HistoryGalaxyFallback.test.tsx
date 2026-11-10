import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import App from './App';
import HistoryGalaxyApp from './HistoryGalaxyApp';
import { createHistoryContentLoader } from './history/content/loader';
import { parseExplorerState } from './history/explorer/state';

const fixture = (path: string) => readFileSync(`public/history-content/generated/${path}`, 'utf8');
function loader(gate?: Promise<void>) { return createHistoryContentLoader({ baseUrl: '/content/', fetchImpl: async input => { if (gate) await gate; return new Response(fixture(String(input).replace('/content/', ''))); } }); }
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  window.history.replaceState(null, '', '#/history-galaxy');
  vi.stubGlobal('WebGLRenderingContext', class {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('uses the real explorer, filters, quick panel and complete archive when WebGL creation fails', async () => {
  const user = userEvent.setup();
  render(<App historyLoader={loader()} />);
  const timeline = await screen.findByRole('region', { name: '二维历史时间轴' });
  expect(within(timeline).getAllByRole('button', { name: /查看历史事件/ })).toHaveLength(30);
  expect(screen.queryByText('当前环境无法开启三维星河')).not.toBeInTheDocument();
  await user.click(screen.getByRole('checkbox', { name: '战争' }));
  expect(new URLSearchParams(window.location.hash.split('?')[1]).get('cat')).toBe('war');
  expect(within(timeline).getByRole('button', { name: /贞观之治/ })).toHaveAttribute('data-match', 'false');
  expect(within(timeline).getByRole('button', { name: /鸦片战争/ })).toHaveAttribute('data-match', 'true');
  await user.click(screen.getByRole('button', { name: '清除全部筛选' }));
  await user.type(screen.getByRole('searchbox', { name: '搜索历史' }), '贞观');
  await user.click(await screen.findByRole('button', { name: '聚焦历史事件：627年 贞观之治' }));
  expect(within(timeline).getByRole('button', { name: /贞观之治/ })).toHaveAttribute('aria-pressed', 'true');
  const panel = screen.getByRole('dialog', { name: '贞观之治' });
  expect(await within(panel).findByText(/隋末战乱之后/)).toBeInTheDocument();
  await user.click(within(panel).getByRole('link', { name: '阅读完整档案' }));
  expect(await screen.findByRole('heading', { level: 1, name: '贞观之治' })).toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: '返回历史星河' }));
  expect(await screen.findByRole('region', { name: '二维历史时间轴' })).toBeInTheDocument();
  expect(screen.getByRole('searchbox', { name: '搜索历史' })).toHaveValue('贞观');
});

it('restores selection after delayed indexes, sanitizes unknown offsets and never overwrites storage during loading', async () => {
  const saved = { version: 2, camera: { target: [-12, 2, 1], distance: 24 }, selectedId: 'zhenguan', fixedOffsets: { zhenguan: [1, -0.5], removed: [1, 1] }, explorer: { ...parseExplorerState(new URLSearchParams()), categories: ['culture'], eraIds: ['tang'] } };
  localStorage.setItem('history-galaxy-session-v2', JSON.stringify(saved));
  window.history.replaceState(null, '', '#/history-galaxy?cat=war');
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  render(<HistoryGalaxyApp loader={loader(gate)} />);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
  expect(JSON.parse(localStorage.getItem('history-galaxy-session-v2')!)).toEqual(saved);
  await act(async () => { release(); });
  expect(await screen.findByRole('dialog', { name: '贞观之治' })).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: '战争' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: '文化' })).not.toBeChecked();
  expect(new URLSearchParams(window.location.hash.split('?')[1]).get('era')).toBe('tang');
  act(() => window.dispatchEvent(new Event('pagehide')));
  expect(JSON.parse(localStorage.getItem('history-galaxy-session-v2')!)).toMatchObject({ selectedId: 'zhenguan', fixedOffsets: { zhenguan: [1, -0.5] }, explorer: { eraIds: ['tang'], categories: ['war'] } });
  expect(JSON.parse(localStorage.getItem('history-galaxy-session-v2')!).fixedOffsets.removed).toBeUndefined();
});

it('restores stored filters once with replaceState, keeps unrelated query keys and flushes selection on unmount', async () => {
  localStorage.setItem('history-galaxy-session-v2', JSON.stringify({ version: 2, explorer: { ...parseExplorerState(new URLSearchParams()), text: '贞观', majorOnly: true }, selectedId: 'missing' }));
  window.history.replaceState(null, '', '#/history-galaxy?source=shared');
  const replace = vi.spyOn(window.history, 'replaceState'), push = vi.spyOn(window.history, 'pushState');
  const user = userEvent.setup();
  const { unmount } = render(<HistoryGalaxyApp loader={loader()} />);
  await screen.findByRole('region', { name: '二维历史时间轴' });
  expect(screen.getByRole('searchbox', { name: '搜索历史' })).toHaveValue('贞观');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(replace).toHaveBeenCalledTimes(1); expect(push).not.toHaveBeenCalled();
  expect(new URLSearchParams(window.location.hash.split('?')[1]).get('source')).toBe('shared');
  await user.click(await screen.findByRole('button', { name: '聚焦历史事件：627年 贞观之治' }));
  unmount();
  expect(JSON.parse(localStorage.getItem('history-galaxy-session-v2')!).selectedId).toBe('zhenguan');
});


it('drops a restored selection absent from the current manifest even if a stale compact row remains', async () => {
  localStorage.setItem('history-galaxy-session-v2', JSON.stringify({ version: 2, selectedId: 'zhenguan', fixedOffsets: { zhenguan: [1, 1] } }));
  const stale = createHistoryContentLoader({ baseUrl: '/content/', fetchImpl: async input => {
    const path = String(input).replace('/content/', '');
    const value = JSON.parse(fixture(path));
    if (path === 'manifest.json') delete value.eventEras.zhenguan;
    return new Response(JSON.stringify(value));
  } });
  await act(async () => { render(<HistoryGalaxyApp loader={stale} />); });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  act(() => window.dispatchEvent(new Event('pagehide')));
  expect(JSON.parse(localStorage.getItem('history-galaxy-session-v2')!)).toMatchObject({ selectedId: null, fixedOffsets: {} });
});
