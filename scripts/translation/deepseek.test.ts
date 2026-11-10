// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { createDeepSeekTranslator } from './deepseek';

const segments = [{ id: 'profile.headline', text: '构建实用产品。', context: 'headline' }];
const payload = { translations: [{ id: 'profile.headline', text: 'Build practical products.' }] };
const reply = (content = JSON.stringify(payload), finish_reason = 'stop') => new Response(JSON.stringify({ choices: [{ finish_reason, message: { content } }] }));
const setup = (fetch = vi.fn().mockResolvedValue(reply())) => ({ fetch, translator: createDeepSeekTranslator({ apiKey: 'test-key', fetch, sleep: vi.fn().mockResolvedValue(undefined), timeoutMs: 10 }) });

it('requests JSON with disabled thinking and returns exact IDs', async () => {
  const { fetch, translator } = setup();
  expect(await translator.translate(segments)).toEqual(new Map([['profile.headline', 'Build practical products.']]));
  const [url, init] = fetch.mock.calls[0];
  expect(url).toBe('https://api.deepseek.com/chat/completions');
  expect(JSON.parse(init.body)).toMatchObject({ model: 'deepseek-flash', thinking: { type: 'disabled' }, response_format: { type: 'json_object' }, stream: false });
  expect(init.headers).toMatchObject({ Authorization: 'Bearer test-key', 'Content-Type': 'application/json' });
  expect(JSON.parse(init.body).messages[0].content).toMatch(/JSON/);
});

it.each([429, 500, 'blank', 'malformed', 'timeout'])('recovers from transient %s', async kind => {
  const fetch = vi.fn();
  if (kind === 'timeout') fetch.mockRejectedValueOnce(new DOMException('timeout', 'TimeoutError'));
  else fetch.mockResolvedValueOnce(typeof kind === 'number' ? new Response('', { status: kind }) : reply(kind === 'blank' ? ' ' : '{'));
  fetch.mockResolvedValueOnce(reply());
  const sleep = vi.fn().mockResolvedValue(undefined);
  const result = await createDeepSeekTranslator({ apiKey: 'test-key', fetch, sleep }).translate(segments);
  expect(result.get('profile.headline')).toBe('Build practical products.');
  expect(sleep).toHaveBeenCalledWith(500);
});

it.each([401, 403, 'missing', 'duplicate', 'extra', 'finish'])('rejects terminal %s without retry or secrets', async kind => {
  const entries = kind === 'duplicate' ? [...payload.translations, ...payload.translations] : kind === 'extra' ? [...payload.translations, { id: 'secret', text: 'x' }] : [];
  const fetch = vi.fn().mockResolvedValue(typeof kind === 'number' ? new Response('', { status: kind }) : kind === 'finish' ? reply(JSON.stringify(payload), 'length') : reply(JSON.stringify({ translations: entries })));
  const { translator } = setup(fetch);
  await expect(translator.translate(segments)).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(1);
  try { await translator.translate(segments); } catch (error) { expect(String(error)).not.toMatch(/test-key|Authorization/); }
});

it('exhausts exactly three attempts with bounded delays', async () => {
  const fetch = vi.fn().mockImplementation(async () => new Response('', { status: 503 }));
  const sleep = vi.fn().mockResolvedValue(undefined);
  await expect(createDeepSeekTranslator({ apiKey: 'test-key', fetch, sleep }).translate(segments)).rejects.toThrow(/503.*3/);
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(sleep.mock.calls).toEqual([[500], [1500]]);
});

it('aborts a hung request using the configured timeout', async () => {
  const fetch = vi.fn((_url, init) => new Promise<Response>((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason))));
  await expect(createDeepSeekTranslator({ apiKey: 'test-key', fetch, timeoutMs: 5, sleep: async () => {} }).translate(segments)).rejects.toThrow(/attempt 3/);
  expect(fetch).toHaveBeenCalledTimes(3);
});

it('rejects loss of protected glossary terms', async () => {
  const { translator } = setup();
  await expect(translator.translate([{ ...segments[0], text: 'React 产品' }])).rejects.toThrow(/protected/i);
});
