import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import HistoryGalaxyApp from './HistoryGalaxyApp';
import { createHistoryContentLoader } from './history/content/loader';

const boundary = vi.hoisted(() => ({ scene: undefined as any }));
// Canvas owns a separate WebGL renderer. All application/content/explorer state
// remains real; inspect exactly what this unavailable renderer would receive.
vi.mock('@react-three/fiber', async importOriginal => ({
  ...await importOriginal<typeof import('@react-three/fiber')>(),
  Canvas: ({ children }: any) => { boundary.scene = children.props.children.props; return <div aria-label="三维画布" />; }
}));
function loader() { return createHistoryContentLoader({ baseUrl: '/content/', fetchImpl: async input => new Response(readFileSync(`public/history-content/generated/${String(input).replace('/content/', '')}`, 'utf8')) }); }
const productionCount = JSON.parse(readFileSync('public/history-content/generated/manifest.json', 'utf8')).eventCount;
beforeEach(() => {
  window.history.replaceState(null, '', '#/history-galaxy');
  vi.stubGlobal('WebGLRenderingContext', class {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({} as any));
  boundary.scene = undefined;
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('uses scene viewport membership to dim context without removing its events and updates it when the camera moves', async () => {
  const user = userEvent.setup();
  render(<HistoryGalaxyApp loader={loader()} />);
  await waitFor(() => expect(boundary.scene?.events).toHaveLength(productionCount));
  act(() => boundary.scene.onViewportChange(new Set(['zhenguan', 'kaiyuan'])));
  await user.click(screen.getByRole('checkbox', { name: '仅当前视野' }));
  expect(new URLSearchParams(window.location.hash.split('?')[1]).get('view')).toBe('1');
  expect(boundary.scene.events).toHaveLength(productionCount);
  expect(boundary.scene.eventOpacities.get('zhenguan')).toBe(1);
  expect(boundary.scene.eventOpacities.get('anshi')).toBe(0.15);
  expect(screen.getByRole('button', { name: '查看历史事件：755年 安史之乱' })).toHaveAttribute('data-match', 'false');
  act(() => boundary.scene.onViewportChange(new Set(['anshi'])));
  expect(boundary.scene.eventOpacities.get('anshi')).toBe(1);
  expect(boundary.scene.eventOpacities.get('zhenguan')).toBe(0.15);
  await user.click(screen.getByRole('button', { name: '清除全部筛选' }));
  expect([...boundary.scene.eventOpacities.values()].every(opacity => opacity === 1)).toBe(true);
});

it('sends ranked search targets to protection and the exact selected event to the camera flight boundary', async () => {
  const user = userEvent.setup();
  render(<HistoryGalaxyApp loader={loader()} />);
  await waitFor(() => expect(boundary.scene?.events).toHaveLength(productionCount));
  await user.type(screen.getByRole('searchbox', { name: '搜索历史' }), '贞观');
  const result = await screen.findByRole('button', { name: '聚焦历史事件：627年 贞观之治' });
  expect(boundary.scene.searchTargetIds[0]).toBe('zhenguan');
  expect(boundary.scene.searchTargetIds).toContain('tang-zhenguan-law');
  expect(boundary.scene.eventOpacities.get('kaiyuan')).toBe(0.15);
  await user.click(result);
  expect(boundary.scene.selectedEvent).toMatchObject({ id: 'zhenguan', title: '贞观之治', year: 627 });
  expect(boundary.scene.selectionSignal).toBe(1);
  expect(screen.getByRole('dialog', { name: '贞观之治' })).toHaveFocus();
});

it('restores camera and released offsets into WebGL and debounces changed state before a pagehide flush', async () => {
  localStorage.setItem('history-galaxy-session-v2', JSON.stringify({ version: 2, selectedId: 'zhenguan', camera: { target: [-12, 2, 1], distance: 24 }, fixedOffsets: { zhenguan: [1.2, -0.5], removed: [1, 1] } }));
  render(<HistoryGalaxyApp loader={loader()} />);
  await waitFor(() => expect(boundary.scene?.events).toHaveLength(productionCount));
  expect(boundary.scene.initialCamera).toEqual({ target: [-12, 2, 1], distance: 24 });
  expect(boundary.scene.initialFixedOffsets).toEqual({ zhenguan: [1.2, -0.5] });
  expect(boundary.scene.selectedEvent.id).toBe('zhenguan');
  expect(await screen.findByRole('list', { name: '参考资料' })).toBeInTheDocument();
  const before = localStorage.getItem('history-galaxy-session-v2');
  act(() => {
    for (let index = 0; index < 10; index++) boundary.scene.onCameraChange({ target: [index, 1, 0], distance: 10 + index });
    boundary.scene.onFixedOffsetsChange({ zhenguan: [2, 1] });
  });
  expect(localStorage.getItem('history-galaxy-session-v2')).toBe(before);
  act(() => window.dispatchEvent(new Event('pagehide')));
  expect(JSON.parse(localStorage.getItem('history-galaxy-session-v2')!)).toMatchObject({ camera: { target: [9, 1, 0], distance: 19 }, fixedOffsets: { zhenguan: [2, 1] } });
});
