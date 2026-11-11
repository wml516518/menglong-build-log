# AI Chat Playground Chinese Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the public AI Chat Playground into a fully Chinese streaming-chat experience without changing its React/FastAPI API contract.

**Architecture:** Keep the existing frontend and backend boundaries. Centralize Chinese UI copy and error normalization in the frontend, retain stable preset IDs and request payloads, and add focused SSE/persistence coverage before updating metadata, documentation, and responsive behavior.

**Tech Stack:** React 19, TypeScript, Vite 5, FastAPI, Python, Vitest, Testing Library, pytest, Netlify, Render

**Spec:** `/Users/wangmenglong/Desktop/PrivateChat/docs/superpowers/specs/2026-11-09-ai-chat-playground-chinese-design.md`

## Global Constraints

- Work in `/Users/wangmenglong/Desktop/AIChatPlayground` on a new `codex/` feature branch based on the latest `origin/main`.
- All user-visible page copy, presets, status, errors, metadata, and README content must be Chinese.
- Preserve preset IDs: `general`, `code-reviewer`, `resume-optimizer`, and `product-brainstormer`.
- Preserve the existing `/api/health` and `/api/chat` request/response contracts.
- Do not add accounts, server sessions, model switching, file upload, or Markdown editing.
- Do not expose raw provider errors, secrets, stack traces, or internal URLs in the UI.
- The final frontend must pass `npm test` and `npm run build`; the backend must pass `pytest`.
- Verify desktop and mobile browser flows and the deployed Netlify/Render integration before delivery.

---

## File Structure

- `frontend/src/copy.ts`: Chinese labels, messages, and public error mapping.
- `frontend/src/presets.ts`: stable preset IDs with Chinese names and system prompts.
- `frontend/src/chat.ts`: storage and SSE parsing; expose typed request errors without changing payloads.
- `frontend/src/chat.test.ts`: persistence, SSE token order, and error parsing.
- `frontend/src/App.tsx`: Chinese workspace, status, controls, streaming state, and accessible live region.
- `frontend/src/App.test.tsx`: Chinese UI, payload controls, clear/persistence, and error regressions.
- `frontend/src/styles.css`: responsive and reduced-motion behavior.
- `frontend/index.html`: Chinese document language and metadata.
- `README.md`: Chinese project, development, testing, and deployment documentation.

---

### Task 1: Localize Presets and Centralize Public Copy

**Files:**
- Create: `frontend/src/copy.ts`
- Modify: `frontend/src/presets.ts`
- Create: `frontend/src/presets.test.ts`

**Interfaces:**
- Produces: `uiCopy` object with Chinese labels/messages used by `App`.
- Produces: `toPublicChatError(error: unknown): string`.
- Preserves: `Preset.id` values consumed by local storage and API requests.

- [ ] **Step 1: Write failing preset and error-copy tests**

Create `frontend/src/presets.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { toPublicChatError, uiCopy } from './copy';
import { presets } from './presets';

describe('Chinese playground copy', () => {
  it('keeps stable preset IDs and exposes Chinese labels', () => {
    expect(presets.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: 'general', name: '通用助手' },
      { id: 'code-reviewer', name: '代码审查' },
      { id: 'resume-optimizer', name: '简历优化' },
      { id: 'product-brainstormer', name: '产品构思' }
    ]);
    expect(presets.every((preset) => /[\u4e00-\u9fff]/.test(preset.systemPrompt))).toBe(true);
  });

  it('maps private or English failures to public Chinese messages', () => {
    expect(toPublicChatError(new TypeError('Failed to fetch'))).toBe(uiCopy.errors.offline);
    expect(toPublicChatError(new DOMException('Timed out', 'AbortError'))).toBe(uiCopy.errors.timeout);
    expect(toPublicChatError(new Error('OPENAI_API_KEY is not configured'))).toBe(uiCopy.errors.request);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `cd frontend && npm test -- --run src/presets.test.ts`

Expected: FAIL because `copy.ts` does not exist and preset names are English.

- [ ] **Step 3: Create the Chinese copy module**

Create `frontend/src/copy.ts`:

```ts
export const uiCopy = {
  projectEyebrow: '全栈 AI 项目',
  title: 'AI 对话实验室',
  health: { checking: '正在检查', offline: '服务离线', online: '在线' },
  controls: '参数控制',
  preset: 'Prompt 预设',
  temperature: '温度',
  maxTokens: '最大生成长度',
  clear: '清空对话',
  reset: '恢复默认参数',
  conversation: '对话记录',
  message: '消息',
  placeholder: '输入你想测试的问题……',
  send: '发送',
  sending: '正在发送',
  thinking: '正在思考……',
  user: '你',
  assistant: '助手',
  welcome: '欢迎使用 AI 对话实验室。请选择 Prompt 预设、调整参数，然后发送一条消息开始测试。',
  cleared: '对话已清空，可以开始新的测试。',
  errors: {
    offline: '暂时无法连接 AI 服务，请稍后重试。',
    timeout: '回答生成超时，请缩短问题或稍后重试。',
    interrupted: '回答传输中断，请重新发送。',
    request: '请求失败，请稍后重试。'
  }
} as const;

export function toPublicChatError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') return uiCopy.errors.timeout;
  if (error instanceof TypeError) return uiCopy.errors.offline;
  if (error instanceof Error && error.name === 'StreamInterruptedError') return uiCopy.errors.interrupted;
  return uiCopy.errors.request;
}
```

- [ ] **Step 4: Replace preset names and prompts with exact Chinese values**

Update `frontend/src/presets.ts` without changing IDs:

```ts
export const presets: Preset[] = [
  { id: 'general', name: '通用助手', systemPrompt: '你是一名准确、简洁、实用的中文助手。' },
  { id: 'code-reviewer', name: '代码审查', systemPrompt: '你负责审查代码。优先指出缺陷、风险、回归和缺失测试，并提供可执行的修改建议。' },
  { id: 'resume-optimizer', name: '简历优化', systemPrompt: '你在不夸大经历的前提下，改善简历表达、结果描述和岗位匹配度。' },
  { id: 'product-brainstormer', name: '产品构思', systemPrompt: '你帮助分析用户价值、方案权衡、最小可行范围和实施路径。' }
];
```

- [ ] **Step 5: Run focused tests and commit**

Run: `cd frontend && npm test -- --run src/presets.test.ts`

Expected: PASS.

```bash
git add frontend/src/copy.ts frontend/src/presets.ts frontend/src/presets.test.ts
git commit -m "feat: add Chinese playground copy"
```

---

### Task 2: Harden Streaming, Persistence, and Chinese Error Mapping

**Files:**
- Modify: `frontend/src/chat.ts`
- Create: `frontend/src/chat.test.ts`

**Interfaces:**
- Produces: exported `StreamInterruptedError` class.
- Preserves: `streamChat(apiBaseUrl, payload, onToken): Promise<void>` signature and API payload.
- Preserves: storage key `ai-chat-playground-state`.

- [ ] **Step 1: Write failing SSE and persistence tests**

Create `frontend/src/chat.test.ts` with a stream helper and these cases:

```ts
import { describe, expect, it, vi } from 'vitest';
import { loadConversation, saveConversation, streamChat, StreamInterruptedError } from './chat';

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    }
  }), { status: 200 });
}

it('joins Chinese SSE tokens in arrival order', async () => {
  globalThis.fetch = vi.fn().mockResolvedValue(sseResponse([
    'event: token\ndata: {"content":"你"}\n\n',
    'event: token\ndata: {"content":"好"}\n\nevent: done\ndata: {}\n\n'
  ]));
  const tokens: string[] = [];
  await streamChat('https://api.example.test', {
    messages: [{ role: 'user', content: '问候' }], preset: 'general', temperature: 0.7, max_tokens: 800
  }, (token) => tokens.push(token));
  expect(tokens.join('')).toBe('你好');
});

it('throws a typed interruption when a stream ends with an incomplete event', async () => {
  globalThis.fetch = vi.fn().mockResolvedValue(sseResponse(['event: token\ndata: {"content":"未完成"}']));
  await expect(streamChat('https://api.example.test', {
    messages: [{ role: 'user', content: '测试' }], preset: 'general', temperature: 0.7, max_tokens: 800
  }, vi.fn())).rejects.toBeInstanceOf(StreamInterruptedError);
});

it('round-trips persisted messages and settings', () => {
  const state = { messages: [{ id: '1', role: 'assistant' as const, content: '已保存' }], settings: { preset: 'general', temperature: 0.3, maxTokens: 512 } };
  saveConversation(state.messages, state.settings);
  expect(loadConversation()).toEqual(state);
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `cd frontend && npm test -- --run src/chat.test.ts`

Expected: FAIL because `StreamInterruptedError` is not exported and incomplete streams resolve silently.

- [ ] **Step 3: Implement typed interruption and final-buffer parsing**

In `frontend/src/chat.ts`, add:

```ts
export class StreamInterruptedError extends Error {
  constructor() {
    super('The streaming response ended before a complete event was received.');
    this.name = 'StreamInterruptedError';
  }
}
```

Extract existing event handling into `consumeEvent(event: string, onToken)` and, after the read loop, decode the final bytes. If `buffer.trim()` remains and cannot form a complete `event/data` block, throw `StreamInterruptedError`. Preserve backend `event: error` as an `Error`; `App` maps it to public Chinese copy.

- [ ] **Step 4: Run the focused suite and commit**

Run: `cd frontend && npm test -- --run src/chat.test.ts src/presets.test.ts`

Expected: PASS with ordered Chinese tokens, typed interruption, and persistence.

```bash
git add frontend/src/chat.ts frontend/src/chat.test.ts
git commit -m "test: cover streaming and persistence"
```

---

### Task 3: Convert the React Workspace to Chinese

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `uiCopy`, `toPublicChatError`, and Chinese `presets`.
- Preserves: request payload field names and settings behavior.
- Produces: `aria-live="polite"` conversation status without focus changes.

- [ ] **Step 1: Replace the App tests with Chinese behavioral coverage**

Expand `frontend/src/App.test.tsx` to cover:

```ts
it('renders the complete Chinese playground and online model state', async () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'AI 对话实验室' })).toBeInTheDocument();
  expect(screen.getByLabelText('消息')).toBeInTheDocument();
  expect(screen.getByLabelText('Prompt 预设')).toBeInTheDocument();
  expect(screen.getByLabelText('温度')).toBeInTheDocument();
  expect(screen.getByLabelText('最大生成长度')).toBeInTheDocument();
  expect(await screen.findByText('在线 · deepseek-V4-flash')).toBeInTheDocument();
});

it('sends selected preset and numeric controls without changing the API contract', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok', model: 'deepseek-V4-flash' })))
    .mockResolvedValueOnce(sseResponse(['event: token\ndata: {"content":"已优化"}\n\n', 'event: done\ndata: {}\n\n'])));
  render(<App />);
  await userEvent.selectOptions(screen.getByLabelText('Prompt 预设'), 'resume-optimizer');
  await userEvent.clear(screen.getByLabelText('温度'));
  await userEvent.type(screen.getByLabelText('温度'), '0.2');
  await userEvent.clear(screen.getByLabelText('最大生成长度'));
  await userEvent.type(screen.getByLabelText('最大生成长度'), '512');
  await userEvent.type(screen.getByLabelText('消息'), '优化这份简历');
  await userEvent.click(screen.getByRole('button', { name: '发送' }));
  const [, request] = vi.mocked(fetch).mock.calls[1];
  expect(JSON.parse(String(request?.body))).toMatchObject({
    preset: 'resume-optimizer', temperature: 0.2, max_tokens: 512
  });
});

it('clears the conversation with Chinese copy and persists the result', async () => {
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: '清空对话' }));
  expect(screen.getByText('对话已清空，可以开始新的测试。')).toBeInTheDocument();
  await waitFor(() => {
    expect(JSON.parse(localStorage.getItem('ai-chat-playground-state')!).messages).toHaveLength(1);
  });
});

it('shows a public Chinese message instead of a private backend error', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok', model: 'deepseek-V4-flash' })))
    .mockResolvedValueOnce(sseResponse(['event: error\ndata: {"message":"OPENAI_API_KEY is missing"}\n\n'])));
  render(<App />);
  await userEvent.type(screen.getByLabelText('消息'), '测试错误');
  await userEvent.click(screen.getByRole('button', { name: '发送' }));
  expect(await screen.findByText('请求失败，请稍后重试。')).toBeInTheDocument();
  expect(screen.queryByText(/OPENAI_API_KEY/)).not.toBeInTheDocument();
});
```

Import `userEvent`, `waitFor`, and `vi`, and define the same `sseResponse(chunks: string[])` `ReadableStream` helper from Task 2 at the top of this test file.

- [ ] **Step 2: Run App tests and confirm RED**

Run: `cd frontend && npm test -- --run src/App.test.tsx`

Expected: FAIL because visible copy and accessible names are English.

- [ ] **Step 3: Localize App while preserving behavior**

Update `frontend/src/App.tsx`:

- initialize welcome/cleared messages from `uiCopy`;
- set health states to exact Chinese copy;
- map errors through `toPublicChatError` before rendering;
- use `uiCopy` for every label, button, status, placeholder, and avatar;
- add `aria-live="polite" aria-busy={isStreaming}` to the message/status container;
- keep `preset`, `temperature`, `max_tokens`, and messages payload unchanged;
- keep all existing local-storage effects.

When streaming fails, set the assistant message to the mapped Chinese error only. Never concatenate `caught.message` into the DOM.

- [ ] **Step 4: Run frontend tests and commit**

Run: `cd frontend && npm test -- --run`

Expected: all Chinese UI, preset, SSE, persistence, and existing tests pass with no warnings.

```bash
git add frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat: localize AI chat workspace"
```

---

### Task 4: Finish Metadata, Responsive Behavior, Documentation, and Verification

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/src/styles.css`
- Modify: `README.md`
- Verify: `backend/` tests and API contract

**Interfaces:**
- Produces: Chinese HTML language/title/description.
- Produces: responsive Chinese workspace with reduced-motion support.
- Produces: Chinese repository documentation.

- [ ] **Step 1: Update metadata with exact values**

Set in `frontend/index.html`:

```html
<html lang="zh-CN">
<meta name="description" content="一个支持流式回答、Prompt 预设和生成参数调节的中文 AI 对话实验项目。" />
<title>AI 对话实验室｜Prompt 与模型参数测试</title>
```

- [ ] **Step 2: Add focus, overflow, and reduced-motion CSS**

In `frontend/src/styles.css`:

- use stable `minmax(0, ...)` grid tracks and `min-width: 0` for chat content;
- add visible `:focus-visible` outlines to buttons, select, inputs, and textarea;
- add `overflow-wrap: anywhere` to long messages;
- keep the existing single-column breakpoint below 860px;
- add `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; transition-duration: 0.01ms !important; } }`.

- [ ] **Step 3: Rewrite README in Chinese**

Document the Chinese UI, streaming responses, four presets, parameter controls, persistence, React/FastAPI stack, required `OPENAI_API_KEY`, local commands, test commands, and Netlify/Render deployment. State that secrets belong only on Render.

- [ ] **Step 4: Run fresh frontend/backend verification**

Run:

```bash
cd frontend && npm test -- --run && npm run build
cd ../backend && python3 -m pytest
```

Expected: all commands exit 0. Record any pre-existing dependency warning separately; no application warnings are accepted.

- [ ] **Step 5: Run real-browser verification**

Use the Playwright skill against local frontend and backend:

- 1440×900 and 390×844;
- verify Chinese metadata and visible copy;
- change the preset, temperature, and token count;
- submit Chinese text and observe the streaming busy state and final answer;
- clear and reload to verify persistence;
- force offline and SSE error responses to verify Chinese messages;
- assert no horizontal overflow, console errors, or unexpected 404s.

Capture screenshots under `output/playwright/` or an equivalent ignored artifact directory in this repository.

- [ ] **Step 6: Commit docs and final adjustments**

```bash
git add frontend/index.html frontend/src/styles.css README.md
git commit -m "docs: finish Chinese AI chat experience"
```

- [ ] **Step 7: Push, open PR, and verify deployment**

Push the feature branch and open a Pull Request against `main`. Attach the PR to the task, wait for GitHub CI and Netlify Deploy Preview, and test the preview. After explicit merge authorization, verify the production page and one real Chinese chat request against Render.
