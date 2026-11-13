import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HistoryGalaxyApp from '../HistoryGalaxyApp';
import { archiveFixture } from '../../tests/fixtures/historyArchives';

beforeEach(() => { window.history.replaceState(null, '', '/#/history-galaxy'); });
async function open(fixture = archiveFixture()) {
  render(<HistoryGalaxyApp loader={fixture.loader} />);
  await userEvent.click(await screen.findByRole('button', { name: '查看历史事件：627 年 — 649 年 贞观之治' }));
  return { fixture, panel: screen.getByRole('dialog', { name: '贞观之治' }) };
}
it('shows the compact summary and lazy causes, results, impacts and linked core people in the existing panel', async () => {
  const fixture = archiveFixture();
  fixture.pause('eras/tang.json');
  const { panel } = await open(fixture);
  expect(within(panel).getByText(fixture.event.summary)).toBeInTheDocument();
  expect(within(panel).getByText('627 年 — 649 年')).toBeInTheDocument();
  expect(within(panel).getByText('627 年 — 649 年')).toHaveAccessibleName('627 年 — 649 年');
  expect(within(panel).getByText(/唐代/)).toBeInTheDocument();
  expect(within(panel).getByLabelText('影响力 5 级')).toBeInTheDocument();
  expect(within(panel).getByRole('status')).toHaveTextContent('正在加载档案');
  await act(async () => { fixture.resume('eras/tang.json'); });
  expect(await within(panel).findByText('恢复社会生产。')).toBeInTheDocument();
  expect(within(panel).getByText('政局趋于稳定。')).toBeInTheDocument();
  expect(within(panel).getByText('为后来的发展提供制度基础。')).toBeInTheDocument();
  const people = within(panel).getByRole('navigation', { name: '核心人物' });
  expect(within(people).getAllByRole('link')).toHaveLength(3);
  expect(within(people).getByRole('link', { name: '唐太宗' })).toHaveAttribute('href', '#/history-galaxy/person/person-li-shimin');
  expect(within(panel).getByRole('link', { name: /完整档案/ })).toHaveAttribute('href', '#/history-galaxy/event/zhenguan');
  expect(within(within(panel).getByRole('navigation', { name: '相关事件' })).getAllByRole('link', { name: '开元盛世' }).length).toBeGreaterThan(0);
  expect(fixture.requests.filter(path => path.startsWith('eras/'))).toEqual(['eras/tang.json']);
});
it('limits core people to six and moves previous/next through real compact events', async () => {
  const fixture = archiveFixture();
  const ids = fixture.people.slice(0, 7).map((person: { id: string }) => person.id);
  fixture.event.personIds = ids;
  fixture.events.find((event: { id: string }) => event.id === 'zhenguan').personIds = ids;
  const { panel } = await open(fixture);
  expect(within(within(panel).getByRole('navigation', { name: '核心人物' })).getAllByRole('link')).toHaveLength(6);
  await userEvent.click(within(panel).getByRole('button', { name: '下一个历史事件' }));
  expect(screen.getByRole('dialog', { name: '开元盛世' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '上一个历史事件' }));
  expect(screen.getByRole('dialog', { name: '贞观之治' })).toBeInTheDocument();
});
it('keeps the summary on a lazy failure and retries only when requested', async () => {
  const fixture = archiveFixture(); fixture.failures.add('eras/tang.json');
  const { panel } = await open(fixture);
  expect(await within(panel).findByRole('alert')).toHaveTextContent('档案加载失败');
  expect(within(panel).getByText(fixture.event.summary)).toBeInTheDocument();
  expect(fixture.requests.filter(path => path.startsWith('eras/'))).toHaveLength(1);
  fixture.failures.clear();
  await userEvent.click(within(panel).getByRole('button', { name: '重试档案' }));
  expect(await within(panel).findByText('恢复社会生产。')).toBeInTheDocument();
});
it('restores focus on close and keeps a missing optional person readable', async () => {
  const fixture = archiveFixture();
  fixture.event.personIds.push('missing-person');
  fixture.events.find((event: { id: string }) => event.id === 'zhenguan').personIds.push('missing-person');
  const { panel } = await open(fixture);
  expect(panel).toHaveFocus();
  expect(within(within(panel).getByRole('navigation', { name: '核心人物' })).getByText('资料整理中')).toBeInTheDocument();
  await userEvent.click(within(panel).getByRole('button', { name: '关闭故事' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '查看历史事件：627 年 — 649 年 贞观之治' })).toHaveFocus();
});

it.each([
  [-230, -221, 'range', '公元前 230 年 — 公元前 221 年'],
  [-1600, -1600, 'circa', '约公元前 1600 年'],
  [700, 700, 'circa', '约 700 年'],
])('keeps the visible and accessible date complete for %s–%s (%s)', async (startYear, endYear, yearPrecision, date) => {
  const fixture = archiveFixture();
  Object.assign(fixture.events.find((event: { id: string }) => event.id === 'zhenguan'), { startYear, endYear, year: startYear, yearPrecision });
  render(<HistoryGalaxyApp loader={fixture.loader} />);
  await userEvent.click(await screen.findByRole('button', { name: `查看历史事件：${date} 贞观之治` }));
  const panel = screen.getByRole('dialog', { name: '贞观之治' });
  expect(within(panel).getByText(date)).toHaveAccessibleName(date);
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

it.each(['basic', 'core'] as const)('renders truthful %s quick details, citations and navigation with focus restoration', async detailLevel => {
  const fixture = tierFixture(detailLevel);
  const { panel } = await open(fixture);
  expect(await within(panel).findByText('卷二·贞观纪事')).toBeInTheDocument();
  expect(within(panel).getByText('年代以本卷记载为据。')).toBeInTheDocument();
  expect(within(panel).getByText('政治、制度')).toBeInTheDocument();
  if (detailLevel === 'basic') {
    expect(within(panel).getByText('基础档案')).toBeInTheDocument();
    for (const name of ['原因', '发展过程', '结果', '影响', '史学说明']) expect(within(panel).queryByRole('heading', { name })).not.toBeInTheDocument();
  } else {
    expect(within(panel).queryByText('基础档案')).not.toBeInTheDocument();
    expect(within(panel).getByText('恢复社会生产。')).toBeInTheDocument();
  }
  expect(within(panel).getByRole('link', { name: /完整档案/ })).toBeInTheDocument();
  expect(within(panel).getByRole('navigation', { name: '相关事件' })).toHaveTextContent('开元盛世');
  await userEvent.click(within(panel).getByRole('button', { name: '下一个历史事件' }));
  await userEvent.click(screen.getByRole('button', { name: '上一个历史事件' }));
  await userEvent.click(screen.getByRole('button', { name: '关闭故事' }));
  expect(screen.getByRole('button', { name: '查看历史事件：627 年 — 649 年 贞观之治' })).toHaveFocus();
});

it.each(['basic', 'core'] as const)('keeps %s summary and retries archive and citation failures locally', async detailLevel => {
  const fixture = tierFixture(detailLevel);
  fixture.failures.add('eras/tang.json');
  const { panel } = await open(fixture);
  expect(await within(panel).findByRole('alert')).toHaveTextContent('档案加载失败');
  expect(within(panel).getByText(fixture.event.summary)).toBeInTheDocument();
  fixture.failures.clear();
  fixture.failures.add(fixture.manifest.sources);
  await userEvent.click(within(panel).getByRole('button', { name: '重试档案' }));
  expect(await within(panel).findByRole('alert')).toHaveTextContent('参考资料加载失败');
  fixture.failures.clear();
  await userEvent.click(within(panel).getByRole('button', { name: '重试参考资料' }));
  expect(await within(panel).findByText('卷二·贞观纪事')).toBeInTheDocument();
  expect(fixture.requests.filter(path => path.startsWith('eras/'))).toHaveLength(2);
});
