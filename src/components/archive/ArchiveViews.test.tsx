import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HistoryRoutes from '../../HistoryRoutes';
import App from '../../App';
import { archiveFixture } from '../../../tests/fixtures/historyArchives';
import type { ArchiveRoute } from '../../routes';

beforeEach(() => { sessionStorage.clear(); window.history.replaceState(null, '', '/'); });
function open(view: ArchiveRoute['view'], id: string, fixture = archiveFixture()) {
  const kind = view.replace('history-', '');
  window.history.replaceState(null, '', `/#/history-galaxy/${kind}/${id}`);
  return { fixture, ...render(<HistoryRoutes route={{ view, id, query: '' }} loader={fixture.loader} />) };
}
it('renders the complete event structure with Markdown, indexed entities and semantic relationships', async () => {
  const { fixture } = open('history-event', 'zhenguan');
  await screen.findByRole('heading', { level: 1, name: '贞观之治' });
  expect(screen.getAllByRole('heading', { level: 2 }).map(node => node.textContent)).toEqual([
    '事件概览', '历史背景', '原因', '发展过程', '结果', '影响', '人物', '地点', '关系图', '史学说明', '参考资料'
  ]);
  expect(screen.getByText('纳谏', { selector: 'strong' })).toBeInTheDocument();
  expect(screen.getByText('恢复社会生产。')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '唐太宗' })).toHaveAttribute('href', '#/history-galaxy/person/person-li-shimin');
  expect(screen.getByText('长安')).toBeInTheDocument();
  expect(screen.getByText(/西安/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '唐代政治之旅' })).toHaveAttribute('href', '#/history-galaxy/theme/tang-journey');
  const graph = await screen.findByRole('list', { name: '事件关系' });
  expect(within(graph).getByText('包含事件')).toBeInTheDocument();
  expect(await within(graph).findByText('促成')).toBeInTheDocument();
  expect(within(graph).getAllByRole('link', { name: '开元盛世' })).toHaveLength(2);
  expect(screen.getAllByText('资料整理中').length).toBeGreaterThan(0);
  // Names come from compact indexes; unrelated person archives are never requested.
  expect(fixture.requests.filter(path => path.startsWith('eras/'))).toEqual(['eras/tang.json']);
});
it('renders an outgoing part-of relation as belonging to the broader event', async () => {
  const fixture = archiveFixture();
  fixture.records[fixture.manifest.relations] = [{ id: 'zhenguan-kaiyuan', fromId: 'zhenguan', toId: 'kaiyuan', type: 'part-of' }];
  open('history-event', 'zhenguan', fixture);
  const graph = await screen.findByRole('list', { name: '事件关系' });
  expect(await within(graph).findByText('隶属事件')).toBeInTheDocument();
  expect(within(graph).getAllByRole('link', { name: '开元盛世' }).length).toBeGreaterThan(0);
});
it('renders chronological life, identity changes, works, relations, events, interpretation and sources', async () => {
  const fixture = archiveFixture();
  fixture.person.timeline.reverse();
  open('history-person', 'person-li-shimin', fixture);
  await screen.findByRole('heading', { level: 1, name: '唐太宗' });
  for (const heading of ['人物概览', '生平年表', '身份变化', '贡献', '著作与遗迹', '人物关系', '相关事件', '评价', '后世影响', '史学说明', '参考资料']) {
    expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument();
  }
  const timeline = screen.getByRole('list', { name: '生平年表' });
  expect(within(timeline).getAllByRole('listitem').map(item => item.textContent)).toEqual(['626 年即位开始执政。', '627 年改元贞观开展政治修整。']);
  expect(screen.getByText('作为唐朝皇帝执政。')).toBeInTheDocument();
  expect(screen.getByText('《帝范》')).toBeInTheDocument();
  expect(screen.getByText('昭陵')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '魏征' })).toHaveAttribute('href', '#/history-galaxy/person/person-wei-zheng');
  expect(screen.getByText('君臣')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '贞观之治' })).toHaveAttribute('href', '#/history-galaxy/event/zhenguan');
  expect(await screen.findByRole('link', { name: /历史资料目录/ })).toBeInTheDocument();
  expect(screen.getAllByText('资料整理中').length).toBeGreaterThanOrEqual(2);
});
it('renders theme chapters in authored order with event links and shared sources', async () => {
  const { fixture } = open('history-theme', 'tang-journey');
  await screen.findByRole('heading', { level: 1, name: '唐代政治之旅' });
  const journey = screen.getByRole('list', { name: '主题旅程' });
  expect(within(journey).getAllByRole('heading', { level: 3 }).map(item => item.textContent)).toEqual(['恢复与整顿', '繁盛与变化']);
  expect(within(journey).getByRole('link', { name: '贞观之治' })).toHaveAttribute('href', '#/history-galaxy/event/zhenguan');
  expect(within(journey).getByRole('link', { name: '开元盛世' })).toHaveAttribute('href', '#/history-galaxy/event/kaiyuan');
  expect(within(journey).getByText('资料整理中')).toBeInTheDocument();
  expect(await screen.findByRole('link', { name: /历史资料目录/ })).toBeInTheDocument();
  expect(fixture.requests.filter(path => path.startsWith('eras/'))).toEqual([]);
});
it('renders secure sources, bibliographic text without URLs and safe Markdown links', async () => {
  const { container } = open('history-event', 'zhenguan');
  const source = await screen.findByRole('link', { name: /历史资料目录/ });
  expect(source).toHaveAttribute('href', 'https://example.org/catalog');
  expect(source).toHaveAttribute('target', '_blank');
  expect(source).toHaveAttribute('rel', 'noopener noreferrer');
  expect(screen.getByText('中国通史')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '中国通史' })).not.toBeInTheDocument();
  expect(screen.getByText(/上海人民出版社/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '进一步阅读' })).toHaveAttribute('rel', 'noopener noreferrer');
  expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
});
it('retains the primary archive when sources fail and allows a scoped retry', async () => {
  const fixture = archiveFixture(); fixture.failures.add(fixture.manifest.sources);
  open('history-event', 'zhenguan', fixture);
  await screen.findByRole('heading', { level: 1, name: '贞观之治' });
  expect(await screen.findByRole('alert')).toHaveTextContent('参考资料加载失败');
  fixture.failures.clear();
  await userEvent.click(screen.getByRole('button', { name: '重试参考资料' }));
  expect(await screen.findByRole('link', { name: /历史资料目录/ })).toBeInTheDocument();
  expect(fixture.requests.filter(path => path.startsWith('eras/'))).toHaveLength(1);
});
it('shows loading and retries a failed theme without automatically looping', async () => {
  const fixture = archiveFixture(); fixture.pause('themes/tang-journey.json'); fixture.failures.add('themes/tang-journey.json');
  open('history-theme', 'tang-journey', fixture);
  expect(await screen.findByRole('status')).toHaveTextContent('正在加载历史档案');
  await act(async () => { fixture.resume('themes/tang-journey.json'); });
  expect(await screen.findByRole('alert')).toHaveTextContent('历史档案加载失败');
  expect(fixture.requests.filter(path => path.startsWith('themes/'))).toHaveLength(1);
  fixture.failures.clear();
  await userEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(await screen.findByRole('heading', { name: '唐代政治之旅' })).toBeInTheDocument();
});
it.each(['history-event', 'history-person', 'history-theme'] as const)('does not fetch or loop on an unknown %s primary', async view => {
  const { fixture, rerender } = open(view, 'missing');
  expect(await screen.findByRole('heading', { name: '未找到历史档案' })).toBeInTheDocument();
  rerender(<HistoryRoutes route={{ view, id: 'missing', query: '' }} loader={fixture.loader} />);
  expect(fixture.requests.some(path => path.startsWith('eras/') || path.startsWith('themes/'))).toBe(false);
});
it('returns through real quick/event/person links with the complete galaxy query intact', async () => {
  const galaxy = '#/history-galaxy?era=tang&cat=politics&person=person-li-shimin&from=600&to=800&min=3&q=%E5%94%90&custom=keep';
  window.history.replaceState(null, '', `/${galaxy}`);
  const fixture = archiveFixture();
  render(<App historyLoader={fixture.loader} />);
  await userEvent.click(await screen.findByRole('button', { name: '查看历史事件：627 年 — 649 年 贞观之治' }));
  await userEvent.click(screen.getByRole('link', { name: /完整档案/ }));
  await screen.findByRole('heading', { level: 1, name: '贞观之治' });
  await userEvent.click(screen.getByRole('link', { name: '唐代政治之旅' }));
  await screen.findByRole('heading', { level: 1, name: '唐代政治之旅' });
  await userEvent.click(within(screen.getByRole('list', { name: '主题旅程' })).getByRole('link', { name: '贞观之治' }));
  await screen.findByRole('heading', { level: 1, name: '贞观之治' });
  await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: '贞观之治' })).toHaveFocus());
  await userEvent.click(screen.getByRole('link', { name: '唐太宗' }));
  await screen.findByRole('heading', { level: 1, name: '唐太宗' });
  await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: '唐太宗' })).toHaveFocus());
  expect(screen.getByRole('link', { name: '返回历史星河' })).toHaveAttribute('href', galaxy);
  await userEvent.click(screen.getByRole('link', { name: '返回历史星河' }));
  await waitFor(() => expect(window.location.hash).toBe(galaxy));
  expect(await screen.findByRole('searchbox', { name: '搜索历史' })).toHaveValue('唐');
  expect(fixture.requests.filter(path => path === 'manifest.json')).toHaveLength(1);
});

it('orders event development by historical year and person identities by their start year', async () => {
  const fixture = archiveFixture();
  fixture.event.course = [
    { year: 648, title: '后期修整', description: '继续整顿。' },
    { year: 627, title: '初期恢复', description: '恢复社会秩序。' }
  ];
  fixture.person.identities = [
    { startYear: 626, endYear: 649, roleId: 'emperor', description: '皇帝时期。' },
    { startYear: 618, endYear: 626, roleId: 'prince', description: '秦王时期。' }
  ];
  const { rerender } = open('history-event', 'zhenguan', fixture);
  const course = await screen.findByRole('list', { name: '发展过程' });
  expect(within(course).getAllByRole('heading').map(node => node.textContent)).toEqual(['初期恢复', '后期修整']);
  rerender(<HistoryRoutes route={{ view: 'history-person', id: 'person-li-shimin', query: '' }} loader={fixture.loader} />);
  await screen.findByRole('heading', { level: 1, name: '唐太宗' });
  const identities = screen.getByRole('heading', { name: '身份变化' }).closest('section')!;
  expect(within(identities).getAllByRole('listitem').map(node => node.textContent)).toEqual(['618 年 — 626 年秦王时期。', '626 年 — 649 年皇帝时期。']);
});
it('renders raw HTML as no elements and keeps unsafe prose destinations inert', async () => {
  const { ArchiveProse } = await import('./ArchivePrimitives');
  const { container } = render(<ArchiveProse>{'安全正文 **重点**\n\n<script>window.untrusted = 1</script>\n\n<iframe src="https://example.org"></iframe>\n\n[危险](javascript:alert%281%29) [资料](https://example.org/archive)'}</ArchiveProse>);
  expect(screen.getByText('重点', { selector: 'strong' })).toBeInTheDocument();
  expect(container.querySelector('script, iframe')).toBeNull();
  expect(screen.queryByRole('link', { name: '危险' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: '资料' })).toHaveAttribute('target', '_blank');
});
it('retries optional relationship catalogs while leaving the archive readable', async () => {
  const fixture = archiveFixture(); fixture.failures.add(fixture.manifest.relations);
  open('history-event', 'zhenguan', fixture);
  await screen.findByRole('heading', { level: 1, name: '贞观之治' });
  expect(await screen.findByRole('alert')).toHaveTextContent('事件关系加载失败');
  fixture.failures.clear();
  await userEvent.click(screen.getByRole('button', { name: '重试事件关系' }));
  expect(await screen.findByText('促成')).toBeInTheDocument();
  expect(fixture.requests.filter(path => path.startsWith('eras/'))).toHaveLength(1);
});
it('shows a missing primary even when its manifest era exists but contains no matching record', async () => {
  const fixture = archiveFixture();
  fixture.records['eras/tang.json'] = { ...(fixture.records['eras/tang.json'] as object), events: [] };
  open('history-event', 'zhenguan', fixture);
  expect(await screen.findByRole('heading', { name: '未找到历史档案' })).toBeInTheDocument();
  expect(fixture.requests.filter(path => path.startsWith('eras/'))).toHaveLength(1);
});

function tierFixture(detailLevel: 'basic' | 'core') {
  const fixture = archiveFixture();
  const { sourceRefs, background, causes, course, results, impacts, historiography, ...common } = fixture.event;
  const record = { ...common, detailLevel, editorialPeriodId: 'sui-tang-five-dynasties',
    summary: '唐太宗在位期间君臣以恢复生产整顿政治和听取意见为主要施政方向并调整制度使社会逐渐恢复发展。'.repeat(2),
    sourceRefs: [{ sourceId: sourceRefs[0].sourceId, locator: '卷二·贞观纪事', note: '年代以本卷记载为据。' }, { sourceId: sourceRefs[1].sourceId, locator: '唐代条目' }],
    ...(detailLevel === 'core' ? { background, causes, course, results, impacts, historiography } : {}) };
  Object.keys(fixture.event).forEach(key => delete fixture.event[key]);
  Object.assign(fixture.event, record);
  Object.assign(fixture.events.find((event: { id: string }) => event.id === record.id), { detailLevel, editorialPeriodId: record.editorialPeriodId, summary: record.summary });
  if (detailLevel === 'basic') { fixture.manifest.basicEventCount++; fixture.manifest.coreEventCount--; }
  return fixture;
}

it.each(['basic', 'core'] as const)('renders truthful %s full archives and precise citations', async detailLevel => {
  const fixture = tierFixture(detailLevel);
  open('history-event', 'zhenguan', fixture);
  const title = await screen.findByRole('heading', { level: 1, name: '贞观之治' });
  expect(title).toHaveFocus();
  expect(screen.getByText(fixture.event.summary)).toBeInTheDocument();
  expect(screen.getByText('627 年 — 649 年')).toBeInTheDocument();
  expect(screen.getByText('政治、制度')).toBeInTheDocument();
  expect(await screen.findByText('卷二·贞观纪事')).toBeInTheDocument();
  expect(screen.getByText('年代以本卷记载为据。')).toBeInTheDocument();
  for (const name of ['历史背景', '原因', '发展过程', '结果', '影响', '史学说明']) {
    if (detailLevel === 'core') expect(screen.getByRole('heading', { name, exact: true })).toBeInTheDocument();
    else expect(screen.queryByRole('heading', { name, exact: true })).not.toBeInTheDocument();
  }
  expect(screen.queryByText('基础档案') !== null).toBe(detailLevel === 'basic');
  expect(screen.getByRole('heading', { name: '关系图' })).toBeInTheDocument();
});

it.each(['basic', 'core'] as const)('retries %s full archives and sources without losing navigation', async detailLevel => {
  const fixture = tierFixture(detailLevel);
  fixture.failures.add('eras/tang.json');
  open('history-event', 'zhenguan', fixture);
  expect(await screen.findByRole('alert')).toHaveTextContent('历史档案加载失败');
  fixture.failures.clear();
  fixture.failures.add(fixture.manifest.sources);
  await userEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(await screen.findByRole('heading', { level: 1, name: '贞观之治' })).toHaveFocus();
  expect(await screen.findByRole('alert')).toHaveTextContent('参考资料加载失败');
  fixture.failures.clear();
  await userEvent.click(screen.getByRole('button', { name: '重试参考资料' }));
  expect(await screen.findByText('卷二·贞观纪事')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '返回历史星河' })).toBeInTheDocument();
  expect(fixture.requests.filter(path => path.startsWith('eras/'))).toHaveLength(2);
});

it('renders mixed string and located references, including separate citations to one source', async () => {
  const { SourcesList } = await import('./SourcesList');
  const { HistoryContentProvider } = await import('../../history/content/store');
  const fixture = archiveFixture();
  render(<HistoryContentProvider loader={fixture.loader}><SourcesList references={[
    'history-institution',
    { sourceId: 'history-institution', locator: '唐代第一节', note: '据本节核对。' },
    { sourceId: 'history-institution', locator: '唐代第二节' }
  ]} /></HistoryContentProvider>);
  const sources = await screen.findByRole('list', { name: '参考资料' });
  expect(within(sources).getAllByRole('link', { name: /历史资料目录/ })).toHaveLength(3);
  const items = within(sources).getAllByRole('listitem');
  expect(items[0]).toHaveTextContent('资料编写组 · 历史研究机构 · 唐代');
  expect(items[0]).not.toHaveTextContent('唐代第一节');
  expect(items[1]).toHaveTextContent('唐代第一节据本节核对。');
  expect(items[2]).toHaveTextContent('唐代第二节');
});
