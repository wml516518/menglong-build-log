import { Children, isValidElement } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import HistoryGalaxyApp from './HistoryGalaxyApp';
import { createHistoryContentLoader } from './history/content/loader';
import { ClusterField } from './scene/ClusterField';

// Only Canvas/Html placement is unavailable in jsdom. Keep the actual cluster
// button and operational controls; the browser regression checks hit testing.
vi.mock('@react-three/fiber', async importOriginal => ({
  ...await importOriginal<typeof import('@react-three/fiber')>(),
  Canvas: () => {
    const tree = ClusterField({
      clusters: [{ id: 'overlap', memberIds: ['a', 'b'], count: 2, semanticGroups: ['唐'], center: { x: 100, y: 100 }, bounds: { minX: 80, minY: 80, maxX: 120, maxY: 120 }, focusTarget: { x: 100, y: 100, width: 40, height: 40 } }],
      positions: new Map([['a', [0, 0, 0]], ['b', [1, 0, 0]]]), focusBounds: () => {}
    });
    const html = Children.toArray(tree.props.children).find(isValidElement)!;
    return <div className="history-canvas"><div style={{ position: 'absolute', zIndex: html.props.zIndexRange[0] }}>{html.props.children}</div></div>;
  }
}));

function appLayer(element: HTMLElement, root: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = element, layer: HTMLElement | null = null;
  while (current && current !== root) {
    const style = getComputedStyle(current);
    const positioned = ['absolute', 'relative', 'fixed', 'sticky'].includes(style.position);
    if (style.isolation === 'isolate' || (positioned && style.zIndex !== '' && style.zIndex !== 'auto')
      || (style.transform && style.transform !== 'none') || (style.opacity !== '' && Number(style.opacity) < 1)) layer = current;
    current = current.parentElement;
  }
  return layer;
}

it('contains a projected cluster below the explorer, HUD and story controls in the rendered stacking tree', async () => {
  const style = document.createElement('style'); style.textContent = readFileSync('src/history-galaxy.css', 'utf8'); document.head.append(style);
  vi.stubGlobal('WebGLRenderingContext', class {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({} as any));
  const loader = createHistoryContentLoader({ baseUrl: '/content/', fetchImpl: async input => new Response(readFileSync(`public/history-content/generated/${String(input).replace('/content/', '')}`, 'utf8')) });
  const user = userEvent.setup();
  try {
    await act(async () => { render(<HistoryGalaxyApp loader={loader} />); });
    const root = screen.getByRole('main');
    const cluster = await screen.findByRole('button', { name: '聚焦 2 个历史事件' });
    const sceneLayer = appLayer(cluster, root);
    // A scene HTML descendant must share its root layer with the canvas. It
    // cannot participate in the app's overlay stack using its own larger index.
    expect(sceneLayer).toBe(screen.getByLabelText('三维历史时间轴'));
    const controls = [
      screen.getByRole('button', { name: '清除全部筛选' }),
      screen.getByRole('button', { name: '归位时间轴' }),
      screen.getByRole('button', { name: '唐', exact: true }),
      screen.getByRole('link', { name: '返回主页' })
    ];
    for (const control of controls) expect(Number(getComputedStyle(sceneLayer!).zIndex)).toBeLessThan(Number(getComputedStyle(appLayer(control, root)!).zIndex));
    await user.click(screen.getByRole('button', { name: '聚焦历史事件：627年 贞观之治' }));
    const story = screen.getByRole('dialog', { name: '贞观之治' });
    expect(Number(getComputedStyle(sceneLayer!).zIndex)).toBeLessThan(Number(getComputedStyle(appLayer(story, root)!).zIndex));
  } finally { style.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); }
});
