import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlaygroundApp from './PlaygroundApp';

afterEach(() => vi.unstubAllGlobals());

it('uses the isolated same-origin API and persists streamed replies with the chosen settings', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ model: 'test-model' })))
    .mockResolvedValueOnce(new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode('event: token\ndata: {"content":"你好"}\n\nevent: done\ndata: {}\n\n'));
      controller.close();
    } })));
  vi.stubGlobal('fetch', fetcher);
  render(<PlaygroundApp />);
  expect(screen.getByRole('link', { name: '返回个人主页' })).toHaveAttribute('href', '/#projects');
  expect(await screen.findByText('在线 · test-model')).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText('Prompt 预设'), 'code-reviewer');
  fireEvent.change(screen.getByLabelText('温度'), { target: { value: '0.2' } });
  await userEvent.type(screen.getByLabelText('消息'), '检查代码');
  await userEvent.click(screen.getByRole('button', { name: '发送' }));
  expect(await screen.findByText('你好')).toBeInTheDocument();
  expect(fetcher.mock.calls[0][0]).toBe('/api/ai-chat/api/health');
  expect(fetcher.mock.calls[1][0]).toBe('/api/ai-chat/api/chat');
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({ preset: 'code-reviewer', temperature: 0.2, max_tokens: 800 });
  await waitFor(() => expect(JSON.parse(localStorage.getItem('ai-chat-playground-state')!).messages.at(-1).content).toBe('你好'));
});

it('keeps backend details out of the public error state and re-enables sending', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ model: 'test' })))
    .mockResolvedValueOnce(new Response('private API key detail', { status: 502 })));
  render(<PlaygroundApp />);
  await userEvent.type(screen.getByLabelText('消息'), '测试');
  await userEvent.click(screen.getByRole('button', { name: '发送' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('请求失败，请稍后重试。');
  expect(screen.queryByText(/private API/)).not.toBeInTheDocument();
  expect(screen.getByLabelText('对话记录')).toHaveAttribute('aria-busy', 'false');
});
