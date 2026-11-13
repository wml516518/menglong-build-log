import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { getHistoryReturnLocation, rememberHistoryLocation, restoreHistoryReturnLocation } from '../../routes';
import { createHistoryContentLoader } from '../../history/content/loader';
import { HISTORY_SESSION_KEY, loadHistorySession } from '../../history/session';
import { productionFixture, representativeEventIds } from '../../../tests/fixtures/productionHistory';

function fixtureLoader(allEvents = false) {
  const requests: string[] = [];
  let broken = false;
  let brokenIndex = false;
  let paused: (() => void) | undefined;
  let gate: Promise<void> | undefined;
  const loader = createHistoryContentLoader({ baseUrl: '/content/', fetchImpl: async input => {
    const path = String(input).replace('/content/', '');
    requests.push(path);
    if (gate) await gate;
    if (brokenIndex && path.endsWith('events.compact.json')) throw new Error('offline');
    if (broken && path.startsWith('eras/')) throw new Error('offline');
    return new Response(JSON.stringify(productionFixture(path, allEvents ? undefined : representativeEventIds)));
  } });
  return { loader, requests, breakEra: () => { broken = true; }, repair: () => { broken = false; brokenIndex = false; }, breakIndex: () => { brokenIndex = true; },
    pause: () => { gate = new Promise<void>(resolve => { paused = resolve; }); }, resume: () => { paused?.(); gate = undefined; } };
}
async function navigate(hash: string) {
  await act(async () => { window.location.hash = hash; await new Promise(resolve => setTimeout(resolve, 10)); });
}
beforeEach(() => { sessionStorage.clear(); window.history.replaceState(null, '', '/'); document.documentElement.lang = 'en'; });
afterEach(cleanup);

it('preserves the stored query in the pending lazy route fallback', async () => {
  sessionStorage.setItem('history-galaxy-return', '#/history-galaxy?era=song&q=water');
  window.history.replaceState(null, '', '/#/history-galaxy/event/zhenguan');
  render(<App historyLoader={fixtureLoader().loader} />);
  expect(screen.getByRole('status')).toHaveTextContent('正在加载历史星河');
  const link = screen.getByRole('link', { name: '返回历史星河' });
  expect(link).toHaveAttribute('href', '#/history-galaxy?era=song&q=water');
  fireEvent.click(link);
  await waitFor(() => expect(window.location.hash).toBe('#/history-galaxy?era=song&q=water'));
});

it.each([['event/zhenguan', '贞观之治'], ['person/person-li-shimin', '唐太宗']])('opens direct %s with history layout and Chinese metadata', async (path, title) => {
  window.location.hash = `#/history-galaxy/${path}?era=tang`;
  render(<App historyLoader={fixtureLoader().loader} />);
  expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  expect(document.body).toHaveClass('history-route');
  expect(document.documentElement.lang).toBe('zh-CN');
  expect(document.title).toContain('历史星河');
  expect(screen.getByRole('link', { name: '返回历史星河' })).toHaveAttribute('href', '#/history-galaxy');
});
it.each([
  ['erlitou-urban-center', '二里头都邑形成', false],
  ['pan-geng-migration', '盘庚迁殷', true]
])('reads the production %s archive at its declared detail level', async (id, title, core) => {
  window.location.hash = `#/history-galaxy/event/${id}`;
  render(<App historyLoader={fixtureLoader(true).loader} />);
  const heading = await screen.findByRole('heading', { level: 1, name: title });
  const archive = within(heading.closest('article')!);
  expect(archive.getByRole('heading', { name: '参考资料' })).toBeInTheDocument();
  const sources = await archive.findByRole('list', { name: '参考资料' });
  expect(within(sources).getAllByRole('listitem').length).toBeGreaterThan(0);
  expect(sources).not.toHaveTextContent('史料未详');
  if (core) {
    for (const name of ['历史背景', '原因', '发展过程', '结果', '影响', '史学说明']) expect(archive.getByRole('heading', { name, exact: true })).toBeInTheDocument();
    expect(archive.queryByText('基础档案')).not.toBeInTheDocument();
  } else {
    expect(archive.getByText('基础档案')).toBeInTheDocument();
    expect(archive.queryByRole('heading', { name: '历史背景' })).not.toBeInTheDocument();
  }
});
it('exposes loading and return navigation while pending', async () => {
  window.location.hash = '#/history-galaxy/event/zhenguan';
  const fixture = fixtureLoader(); fixture.pause();
  render(<App historyLoader={fixture.loader} />);
  expect(await screen.findByRole('status')).toHaveTextContent('正在加载');
  expect(screen.getByRole('link', { name: '返回历史星河' })).toBeInTheDocument();
  await act(async () => { fixture.resume(); });
  expect(await screen.findByRole('heading', { level: 1, name: '贞观之治' })).toBeInTheDocument();
});
it('retries an era failure only on request', async () => {
  window.location.hash = '#/history-galaxy/event/zhenguan';
  const fixture = fixtureLoader(); fixture.breakEra();
  render(<App historyLoader={fixture.loader} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('加载失败');
  expect(fixture.requests.filter(path => path.startsWith('eras/'))).toHaveLength(1);
  fixture.repair();
  await userEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(await screen.findByRole('heading', { level: 1, name: '贞观之治' })).toBeInTheDocument();
});
it.each(['event/missing', 'person/missing', 'theme/missing'])('shows unknown %s without loading an era', async path => {
  window.location.hash = `#/history-galaxy/${path}`;
  const fixture = fixtureLoader();
  const { rerender } = render(<App historyLoader={fixture.loader} />);
  expect(await screen.findByRole('heading', { level: 1, name: '未找到历史档案' })).toBeInTheDocument();
  rerender(<App historyLoader={fixture.loader} />);
  expect(fixture.requests.filter(path => path.startsWith('eras/'))).toHaveLength(0);
  expect(screen.getByRole('link', { name: '返回历史星河' })).toBeInTheDocument();
});
it('uses browser Back to restore the full galaxy query with one provider', async () => {
  const camera = { target: [-12, 2, 1], distance: 24 };
  localStorage.setItem(HISTORY_SESSION_KEY, JSON.stringify({ version: 2, camera }));
  window.history.replaceState(null, '', '/#/history-galaxy?era=tang&q=唐');
  const fixture = fixtureLoader();
  render(<App historyLoader={fixture.loader} />);
  const timeline = within(await screen.findByRole('region', { name: '二维历史时间轴' }));
  await timeline.findByRole('button', { name: '查看历史事件：627 年 — 649 年 贞观之治' });
  await userEvent.click(timeline.getByRole('button', { name: '查看历史事件：627 年 — 649 年 贞观之治' }));
  await userEvent.click(within(screen.getByRole('dialog', { name: '贞观之治' })).getByRole('link', { name: '阅读完整档案' }));
  await screen.findByRole('heading', { level: 1, name: '贞观之治' });
  await userEvent.click(screen.getByRole('link', { name: '返回历史星河' }));
  await waitFor(() => expect(window.location.hash).toBe('#/history-galaxy?era=tang&q=%E5%94%90'));
  const restored = within(await screen.findByRole('region', { name: '二维历史时间轴' }));
  expect(await restored.findByRole('button', { name: '查看历史事件：627 年 — 649 年 贞观之治' })).toHaveAttribute('aria-pressed', 'true');
  expect(within(screen.getByRole('complementary', { name: '历史探索器' })).getByRole('searchbox', { name: '搜索历史' })).toHaveValue('唐');
  act(() => window.dispatchEvent(new Event('pagehide')));
  expect(loadHistorySession()?.camera).toEqual(camera);
  expect(loadHistorySession()?.explorer).toMatchObject({ text: '唐', eraIds: ['tang'] });
  expect(fixture.requests.filter(path => path === 'manifest.json')).toHaveLength(1);
  await act(async () => { window.history.forward(); await new Promise(resolve => setTimeout(resolve, 20)); });
  expect(await screen.findByRole('heading', { level: 1, name: '贞观之治' })).toBeInTheDocument();
});

it('retries failed compact initialization and then resolves the archive', async () => {
  window.location.hash = '#/history-galaxy/person/person-li-shimin';
  const fixture = fixtureLoader(); fixture.breakIndex();
  render(<App historyLoader={fixture.loader} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('加载失败');
  fixture.repair();
  await userEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(await screen.findByRole('heading', { level: 1, name: '唐太宗' })).toBeInTheDocument();
});
it('restores a stored galaxy URL on a direct archive visit with no Back marker', async () => {
  window.history.replaceState(null, '', '/#/history-galaxy?era=song&q=water');
  rememberHistoryLocation();
  window.history.replaceState(null, '', '/#/history-galaxy/event/zhenguan');
  expect(getHistoryReturnLocation()).toBe('#/history-galaxy?era=song&q=water');
  restoreHistoryReturnLocation();
  await waitFor(() => expect(window.location.hash).toBe('#/history-galaxy?era=song&q=water'));
});
it('rejects a forged stored return URL', () => {
  sessionStorage.setItem('history-galaxy-return', 'https://example.com/');
  expect(getHistoryReturnLocation()).toBe('#/history-galaxy');
});

it('does not mistake Back from a galaxy for a new forward archive entry', async () => {
  const fixture = fixtureLoader();
  render(<App historyLoader={fixture.loader} />);
  await navigate('#/history-galaxy/event/zhenguan');
  await screen.findByRole('heading', { level: 1, name: '贞观之治' });
  await navigate('#/history-galaxy?era=song&q=water');
  await screen.findByRole('button', { name: '查看历史事件：627 年 — 649 年 贞观之治' });
  await act(async () => { window.history.back(); await new Promise(resolve => setTimeout(resolve, 20)); });
  await screen.findByRole('heading', { level: 1, name: '贞观之治' });
  await act(async () => { window.history.forward(); await new Promise(resolve => setTimeout(resolve, 20)); });
  await screen.findByRole('button', { name: '查看历史事件：627 年 — 649 年 贞观之治' });
  await act(async () => { window.history.back(); await new Promise(resolve => setTimeout(resolve, 20)); });
  await screen.findByRole('heading', { level: 1, name: '贞观之治' });
  await userEvent.click(screen.getByRole('link', { name: '返回历史星河' }));
  await waitFor(() => expect(window.location.hash).toBe('#/history-galaxy?era=song&q=water'));
  await screen.findByRole('button', { name: '查看历史事件：627 年 — 649 年 贞观之治' });
});

it('keeps missing structured records missing without rendering a legacy narrative', async () => {
  const { archiveFixture } = await import('../../../tests/fixtures/historyArchives');
  const fixture = archiveFixture();
  fixture.manifest.structuredEventCount--;
  fixture.manifest.periodCounts['sui-tang-five-dynasties']--;
  fixture.manifest.eventCount--;
  fixture.manifest.coreEventCount--;
  fixture.records[fixture.manifest.indexes.events] = fixture.events.filter((event: { id: string }) => event.id !== 'zhenguan');
  const tang = fixture.records['eras/tang.json'] as { events: { id: string }[] };
  tang.events = tang.events.filter(event => event.id !== 'zhenguan');
  window.history.replaceState(null, '', '/#/history-galaxy/event/zhenguan');
  render(<App historyLoader={fixture.loader} />);
  expect(await screen.findByRole('heading', { name: '未找到历史档案' })).toBeInTheDocument();
  expect(screen.queryByText('基础档案')).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '原因' })).not.toBeInTheDocument();
});
