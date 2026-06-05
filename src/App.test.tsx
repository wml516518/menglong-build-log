import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the English portfolio homepage by default', () => {
    render(<App />);

    expect(screen.getByText('MengLong Wang')).toBeInTheDocument();
    expect(screen.getByText('Building practical AI tools and full-stack products.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '中' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches to Chinese and persists the preference', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '中' }));

    expect(screen.getByText('构建实用的 AI 工具和全栈产品。')).toBeInTheDocument();
    expect(localStorage.getItem('portfolio-language')).toBe('zh');
  });
});
