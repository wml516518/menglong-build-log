import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { getHistoryReturnLocation, rememberHistoryLocation, restoreHistoryReturnLocation } from '../../routes';
import { createHistoryContentLoader } from '../../history/content/loader';

function fixtureLoader() {
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
    return new Response(readFileSync(`public/history-content/generated/${path}`, 'utf8'));
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
  expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
  expect(document.body).toHaveClass('history-route');
  expect(document.documentElement.lang).toBe('zh-CN');
  expect(document.title).toContain('历史星河');
  expect(screen.getByRole('link', { name: '返回历史星河' })).toHaveAttribute('href', '#/history-galaxy');
});
it('exposes loading and return navigation while pending', async () => {
  window.location.hash = '#/history-galaxy/event/zhenguan';
  const fixture = fixtureLoader(); fixture.pause();
  render(<App historyLoader={fixture.loader} />);
  expect(await screen.findByRole('status')).toHaveTextContent('正在加载');
  expect(screen.getByRole('link', { name: '返回历史星河' })).toBeInTheDocument();
  await act(async () => { fixture.resume(); });
  expect(await screen.findByRole('heading', { name: '贞观之治' })).toBeInTheDocument();
});
it('retries an era failure only on request', async () => {
  window.location.hash = '#/history-galaxy/event/zhenguan';
  const fixture = fixtureLoader(); fixture.breakEra();
  render(<App historyLoader={fixture.loader} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('加载失败');
  expect(fixture.requests.filter(path => path.startsWith('eras/'))).toHaveLength(1);
  fixture.repair();
  await userEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(await screen.findByRole('heading', { name: '贞观之治' })).toBeInTheDocument();
});
it.each(['event/missing', 'person/missing', 'theme/missing'])('shows unknown %s without loading an era', async path => {
  window.location.hash = `#/history-galaxy/${path}`;
  const fixture = fixtureLoader();
  const { rerender } = render(<App historyLoader={fixture.loader} />);
  expect(await screen.findByRole('heading', { name: '未找到历史档案' })).toBeInTheDocument();
  rerender(<App historyLoader={fixture.loader} />);
  expect(fixture.requests.filter(path => path.startsWith('eras/'))).toHaveLength(0);
  expect(screen.getByRole('link', { name: '返回历史星河' })).toBeInTheDocument();
});
it('uses browser Back to restore the full galaxy query with one provider', async () => {
  window.history.replaceState(null, '', '/#/history-galaxy?era=tang&q=唐');
  const fixture = fixtureLoader();
  render(<App historyLoader={fixture.loader} />);
  await screen.findByRole('button', { name: '查看历史事件：627年 贞观之治' });
  const archiveLink = document.createElement('a');
  archiveLink.href = '#/history-galaxy/event/zhenguan';
  archiveLink.textContent = '打开贞观之治档案';
  document.body.append(archiveLink);
  await userEvent.click(archiveLink);
  archiveLink.remove();
  await screen.findByRole('heading', { name: '贞观之治' });
  await userEvent.click(screen.getByRole('link', { name: '返回历史星河' }));
  await waitFor(() => expect(window.location.hash).toBe('#/history-galaxy?era=tang&q=%E5%94%90'));
  await screen.findByRole('button', { name: '查看历史事件：627年 贞观之治' });
  expect(fixture.requests.filter(path => path === 'manifest.json')).toHaveLength(1);
  await act(async () => { window.history.forward(); await new Promise(resolve => setTimeout(resolve, 20)); });
  expect(await screen.findByRole('heading', { name: '贞观之治' })).toBeInTheDocument();
});

it('retries failed compact initialization and then resolves the archive', async () => {
  window.location.hash = '#/history-galaxy/person/person-li-shimin';
  const fixture = fixtureLoader(); fixture.breakIndex();
  render(<App historyLoader={fixture.loader} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('加载失败');
  fixture.repair();
  await userEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(await screen.findByRole('heading', { name: '唐太宗' })).toBeInTheDocument();
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
  await screen.findByRole('heading', { name: '贞观之治' });
  await navigate('#/history-galaxy?era=song&q=water');
  await screen.findByRole('button', { name: '查看历史事件：627年 贞观之治' });
  await act(async () => { window.history.back(); await new Promise(resolve => setTimeout(resolve, 20)); });
  await screen.findByRole('heading', { name: '贞观之治' });
  await act(async () => { window.history.forward(); await new Promise(resolve => setTimeout(resolve, 20)); });
  await screen.findByRole('button', { name: '查看历史事件：627年 贞观之治' });
  await act(async () => { window.history.back(); await new Promise(resolve => setTimeout(resolve, 20)); });
  await screen.findByRole('heading', { name: '贞观之治' });
  await userEvent.click(screen.getByRole('link', { name: '返回历史星河' }));
  await waitFor(() => expect(window.location.hash).toBe('#/history-galaxy?era=song&q=water'));
  await screen.findByRole('button', { name: '查看历史事件：627年 贞观之治' });
});
