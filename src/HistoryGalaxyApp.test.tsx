import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HistoryGalaxyApp from './HistoryGalaxyApp';

describe('History Galaxy app', () => {
  it('provides a route back to the portfolio homepage', async () => {
    await act(async () => { render(<HistoryGalaxyApp />); });

    expect(screen.getByRole('link', { name: '返回主页' })).toHaveAttribute('href', '#home');
  });

  beforeEach(() => {
    window.location.hash = '';
  });

  it('opens directly as the Chinese history galaxy with seven era controls', async () => {
    await act(async () => { render(<HistoryGalaxyApp />); });

    expect(screen.getByRole('heading', { level: 1, name: '历史星河' })).toBeInTheDocument();
    expect(screen.getByText('公元 618 - 1949')).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: '时代导航' })).getAllByRole('button')).toHaveLength(7);
  });

  it('provides all thirty historical events as accessible controls', async () => {
    await act(async () => { render(<HistoryGalaxyApp />); });

    expect(screen.getAllByRole('button', { name: /查看历史事件/ })).toHaveLength(30);
    expect(screen.getByRole('button', { name: '查看历史事件：627年 贞观之治' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看历史事件：1949年 中华人民共和国成立' })).toBeInTheDocument();
  });

  it('opens a story with people and closes it', async () => {
    const user = userEvent.setup();
    render(<HistoryGalaxyApp />);

    await user.click(screen.getByRole('button', { name: '查看历史事件：1840年 鸦片战争' }));

    const dialog = screen.getByRole('dialog', { name: '鸦片战争' });
    expect(within(dialog).getByText('林则徐')).toBeInTheDocument();
    expect(within(dialog).getByText(/南京条约/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: '关闭故事' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('moves through events with keyboard controls and closes on Escape', async () => {
    const user = userEvent.setup();
    render(<HistoryGalaxyApp />);

    await user.click(screen.getByRole('button', { name: '查看历史事件：1840年 鸦片战争' }));
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('dialog', { name: '太平天国' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('selects an era lead event from the dynasty navigation', async () => {
    const user = userEvent.setup();
    render(<HistoryGalaxyApp />);

    await user.click(within(screen.getByRole('navigation', { name: '时代导航' })).getByRole('button', { name: '宋' }));

    const dialog = screen.getByRole('dialog', { name: '陈桥兵变' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByLabelText('960年')).toBeInTheDocument();
  });

  it('keeps every era navigation button operational', async () => {
    const user = userEvent.setup();
    render(<HistoryGalaxyApp />);
    const navigation = screen.getByRole('navigation', { name: '时代导航' });

    for (const era of ['唐', '五代', '宋', '元', '明', '清', '近代']) {
      const eraButton = within(navigation).getByRole('button', { name: era });
      await user.click(eraButton);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(eraButton).toHaveAttribute('aria-pressed', 'true');
    }
  });

  it('opens a focused event with Enter and exposes the 2D fallback list', async () => {
    const user = userEvent.setup();
    render(<HistoryGalaxyApp />);
    const eventButton = screen.getByRole('button', { name: '查看历史事件：1919年 五四运动' });

    eventButton.focus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('dialog', { name: '五四运动' })).toHaveFocus();
    expect(screen.getByLabelText('历史事件列表')).toHaveClass('is-fallback');
  });
});
