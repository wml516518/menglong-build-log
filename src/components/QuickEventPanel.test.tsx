import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HistoryGalaxyApp from '../HistoryGalaxyApp';
import { archiveFixture } from '../../tests/fixtures/historyArchives';

beforeEach(() => { window.history.replaceState(null, '', '/#/history-galaxy'); });
async function open(fixture = archiveFixture()) {
  render(<HistoryGalaxyApp loader={fixture.loader} />);
  await userEvent.click(await screen.findByRole('button', { name: '查看历史事件：627年 贞观之治' }));
  return { fixture, panel: screen.getByRole('dialog', { name: '贞观之治' }) };
}
it('shows the compact summary and lazy causes, results, impacts and linked core people in the existing panel', async () => {
  const fixture = archiveFixture();
  fixture.pause('eras/tang.json');
  const { panel } = await open(fixture);
  expect(within(panel).getByText('唐太宗在位期间，君臣以恢复生产、整顿政治和听取意见为主要施政方向。')).toBeInTheDocument();
  expect(within(panel).getByText('627 年 — 649 年')).toBeInTheDocument();
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
  expect(within(panel).getByText(/唐太宗在位期间/)).toBeInTheDocument();
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
  expect(screen.getByRole('button', { name: '查看历史事件：627年 贞观之治' })).toHaveFocus();
});
