export type ChatMessage = { id: string; role: 'assistant' | 'user'; content: string };
export type ChatSettings = { preset: string; temperature: number; maxTokens: number };
export type ApiMessage = { role: 'system' | 'assistant' | 'user'; content: string };

const storageKey = 'ai-chat-playground-state';

export function createMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return { id: crypto.randomUUID(), role, content };
}

export function saveConversation(messages: ChatMessage[], settings: ChatSettings): void {
  try { localStorage.setItem(storageKey, JSON.stringify({ messages, settings })); } catch { return; }
}

export function loadConversation(): { messages: ChatMessage[]; settings: ChatSettings } | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (!parsed || !Array.isArray(parsed.messages) || !parsed.messages.every((message: ChatMessage) => message && typeof message.id === 'string' && typeof message.content === 'string' && ['assistant', 'user'].includes(message.role))) return null;
    if (!parsed.settings || typeof parsed.settings.preset !== 'string' || !Number.isFinite(parsed.settings.temperature) || !Number.isFinite(parsed.settings.maxTokens)) return null;
    return parsed;
  } catch { return null; }
}

export async function streamChat(apiBaseUrl: string, payload: { messages: ApiMessage[]; preset: string; temperature: number; max_tokens: number }, onToken: (token: string) => void): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  if (!response.ok || !response.body) throw new Error('Chat request failed');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const event of events) {
        const eventType = event.split('\n').find(line => line.startsWith('event: '))?.slice(7);
        const dataLine = event.split('\n').find(line => line.startsWith('data: '));
        if (!dataLine) continue;
        const data = JSON.parse(dataLine.slice(6));
        if (eventType === 'error') throw new Error('Backend error');
        if (eventType === 'token' && typeof data.content === 'string') onToken(data.content);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) throw new Error('Stream interrupted');
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
