import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { HistoryTimeline2D } from './HistoryTimeline2D';
import { parseExplorerState } from '../history/explorer/state';
import type { CompactHistoryEventIndex, HistoryEra } from '../history/content/schema';

const compact: CompactHistoryEventIndex[] = JSON.parse(readFileSync('public/history-content/generated/indexes/events.compact.json', 'utf8'));
const eras: HistoryEra[] = JSON.parse(readFileSync('public/history-content/generated/manifest.json', 'utf8')).eras;
const bce: CompactHistoryEventIndex = { ...compact[0], id: 'qin-unification', title: '秦统一', startYear: -230, endYear: -221, year: -230, eraId: 'qin-han', period: '秦朝建立', yearPrecision: 'range', categories: ['politics'], influence: 5 };
const items = [bce, ...compact].map(event => ({ event, match: event.id !== compact[1].id, opacity: event.id === compact[1].id ? 0.15 : 1 }));
function Timeline() {
  const [selectedId, onSelect] = useState<string | null>(null);
  return <HistoryTimeline2D events={items} eras={eras} selectedId={selectedId} onSelect={onSelect} state={parseExplorerState(new URLSearchParams())} />;
}

it('renders all 30 current rows below the 200-row threshold, with semantic era/period grouping and accessible non-color cues', () => {
  render(<HistoryTimeline2D events={items.slice(1)} eras={eras} selectedId={null} onSelect={() => {}} state={parseExplorerState(new URLSearchParams())} />);
  const timeline = screen.getByRole('region', { name: '二维历史时间轴' });
  expect(within(timeline).getAllByRole('button', { name: /查看历史事件/ })).toHaveLength(30);
  expect(within(timeline).getByRole('heading', { name: /唐/, level: 2 })).toBeInTheDocument();
  expect(within(timeline).getAllByRole('heading', { level: 3 }).length).toBeGreaterThan(7);
  expect(within(timeline).getByText('29 / 30 个事件匹配')).toBeInTheDocument();
  const dimmed = within(timeline).getByRole('button', { name: /开元盛世/ });
  expect(dimmed).toHaveAttribute('data-match', 'false');
  expect(dimmed).toHaveTextContent('未匹配');
  expect(dimmed).toHaveTextContent(/影响力 \d 级/);
});

it('labels BCE ranges using historical dates and activates rows with Enter and Space', async () => {
  const user = userEvent.setup();
  render(<Timeline />);
  expect(screen.getByRole('button', { name: '查看历史事件：627 年 — 649 年 贞观之治' })).toBeInTheDocument();
  const row = screen.getByRole('button', { name: /查看历史事件：公元前 230 年 — 公元前 221 年 秦统一/ });
  expect(row).toHaveTextContent('政治');
  expect(row).toHaveAccessibleDescription(/政治.*影响力 5 级/);
  row.focus(); await user.keyboard('{Enter}');
  expect(row).toHaveAttribute('aria-pressed', 'true');
  const next = screen.getByRole('button', { name: /贞观之治/ });
  next.focus(); await user.keyboard(' ');
  expect(next).toHaveAttribute('aria-pressed', 'true');
});

it('moves chronologically with arrows and scrolls a newly selected event into view', async () => {
  const user = userEvent.setup();
  const scroll = vi.fn();
  const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
  HTMLElement.prototype.scrollIntoView = scroll;
  try {
    render(<Timeline />);
    const bceRow = screen.getByRole('button', { name: /秦统一/ }); bceRow.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: /贞观之治/ })).toHaveFocus();
    expect(screen.getByRole('button', { name: /贞观之治/ })).toHaveAttribute('aria-pressed', 'true');
    expect(scroll).toHaveBeenCalledWith({ block: 'nearest' });
    await user.keyboard('{ArrowLeft}'); expect(bceRow).toHaveFocus();
    expect(bceRow).toHaveAttribute('aria-pressed', 'true');
  } finally { if (descriptor) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', descriptor); else delete (HTMLElement.prototype as any).scrollIntoView; }
});

it('starts a previous-event keyboard journey at the latest event when the timeline itself receives focus', async () => {
  const user = userEvent.setup();
  render(<Timeline />);
  screen.getByRole('region', { name: '二维历史时间轴' }).focus();
  await user.keyboard('{ArrowLeft}');
  expect(screen.getByRole('button', { name: /1949 年 中华人民共和国成立/ })).toHaveFocus();
  expect(screen.getByRole('button', { name: /1949 年 中华人民共和国成立/ })).toHaveAttribute('aria-pressed', 'true');
});
