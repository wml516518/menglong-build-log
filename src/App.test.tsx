import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the English portfolio homepage by default', () => {
    render(<App />);

    expect(screen.getAllByText('MengLong Wang').length).toBeGreaterThan(0);
    expect(screen.getByText('Building practical AI tools and full-stack products.')).toBeInTheDocument();
    expect(screen.getByText('Shanghai, China')).toBeInTheDocument();
    expect(screen.getByText('Henan Finance University')).toBeInTheDocument();
    expect(screen.getAllByText('wml565868@gmail.com').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '中' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches to Chinese and persists the preference', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '中' }));

    expect(screen.getByText('构建实用的 AI 工具和全栈产品。')).toBeInTheDocument();
    expect(screen.getByText('中国上海')).toBeInTheDocument();
    expect(screen.getByText('河南财政金融学院')).toBeInTheDocument();
    expect(localStorage.getItem('portfolio-language')).toBe('zh');
  });
});
