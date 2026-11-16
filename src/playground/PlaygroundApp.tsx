import { Activity, ArrowLeft, Bot, RotateCcw, Send, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createMessage, loadConversation, saveConversation, streamChat, type ApiMessage, type ChatMessage, type ChatSettings } from './chat';
import { presets } from './presets';
import './playground.css';

const apiBaseUrl = '/api/ai-chat';
const welcome = '欢迎使用 AI 对话实验室。请选择 Prompt 预设、调整参数，然后发送一条消息开始测试。';
const defaultSettings: ChatSettings = { preset: 'general', temperature: 0.7, maxTokens: 800 };

export default function PlaygroundApp() {
  const loaded = useMemo(loadConversation, []);
  const [messages, setMessages] = useState<ChatMessage[]>(loaded?.messages ?? [createMessage('assistant', welcome)]);
  const [settings, setSettings] = useState<ChatSettings>(loaded?.settings ?? defaultSettings);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [health, setHealth] = useState('正在检查');
  const [error, setError] = useState('');
  const selectedPreset = presets.find(preset => preset.id === settings.preset) ?? presets[0];

  useEffect(() => { saveConversation(messages, settings); }, [messages, settings]);
  useEffect(() => {
    const previousLanguage = document.documentElement.lang;
    document.documentElement.lang = 'zh-CN';
    document.title = 'AI 对话实验室 | 王梦龙';
    const controller = new AbortController();
    fetch(`${apiBaseUrl}/api/health`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Offline'); return response.json(); })
      .then((data: { model: string }) => setHealth(`在线 · ${data.model}`))
      .catch(() => { if (!controller.signal.aborted) setHealth('服务离线'); });
    return () => { controller.abort(); document.documentElement.lang = previousLanguage; };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setError('');
    setInput('');
    const assistantMessage = createMessage('assistant', '');
    setMessages([...messages, createMessage('user', trimmed), assistantMessage]);
    setIsStreaming(true);
    const apiMessages: ApiMessage[] = [
      { role: 'system', content: selectedPreset.systemPrompt },
      ...messages.filter(message => message.content.trim()).map(({ role, content }) => ({ role, content })),
      { role: 'user', content: trimmed }
    ];
    try {
      await streamChat(apiBaseUrl, { messages: apiMessages, preset: settings.preset, temperature: settings.temperature, max_tokens: settings.maxTokens }, token => {
        setMessages(current => current.map(message => message.id === assistantMessage.id ? { ...message, content: message.content + token } : message));
      });
    } catch {
      const publicError = '请求失败，请稍后重试。';
      setError(publicError);
      setMessages(current => current.map(message => message.id === assistantMessage.id ? { ...message, content: publicError } : message));
    } finally { setIsStreaming(false); }
  }

  return <main className="playground">
    <a className="playground-back" href="/#projects"><ArrowLeft size={16} aria-hidden="true" />返回个人主页</a>
    <header className="playground-topbar">
      <div><p className="playground-eyebrow">全栈 AI 项目</p><h1>AI 对话实验室</h1></div>
      <div className="playground-health" role="status"><Activity size={16} aria-hidden="true" /><span>{health}</span></div>
    </header>
    <section className="playground-workspace">
      <aside className="playground-controls" aria-label="参数控制">
        <h2><SlidersHorizontal size={18} aria-hidden="true" />参数控制</h2>
        <label>Prompt 预设<select value={settings.preset} onChange={event => setSettings({ ...settings, preset: event.target.value })}>{presets.map(preset => <option value={preset.id} key={preset.id}>{preset.name}</option>)}</select></label>
        <label>温度<input aria-label="温度" type="range" min="0" max="2" step="0.1" value={settings.temperature} onChange={event => setSettings({ ...settings, temperature: Number(event.target.value) })} /><span>{settings.temperature.toFixed(1)}</span></label>
        <label>最大生成长度<input type="number" min="64" max="4096" value={settings.maxTokens} onChange={event => setSettings({ ...settings, maxTokens: Number(event.target.value) })} /></label>
        <button type="button" disabled={isStreaming} onClick={() => { setMessages([createMessage('assistant', '对话已清空，可以开始新的测试。')]); setError(''); }}><Trash2 size={16} aria-hidden="true" />清空对话</button>
        <button type="button" className="secondary" onClick={() => setSettings(defaultSettings)}><RotateCcw size={16} aria-hidden="true" />恢复默认参数</button>
      </aside>
      <section className="playground-chat">
        <div className="playground-messages" aria-label="对话记录" aria-live="polite" aria-busy={isStreaming}>
          {messages.map(message => <article className="playground-message" key={message.id}>
            <div className="playground-avatar">{message.role === 'assistant' ? <Bot size={18} aria-label="助手" /> : '你'}</div>
            <p>{message.content || (isStreaming ? '正在思考……' : '')}</p>
          </article>)}
        </div>
        {error ? <div className="playground-error" role="alert">{error}</div> : null}
        <form className="playground-composer" onSubmit={handleSubmit}>
          <textarea aria-label="消息" placeholder="输入你想测试的问题……" value={input} onChange={event => setInput(event.target.value)} />
          <button type="submit" disabled={isStreaming || !input.trim()}><Send size={18} aria-hidden="true" />{isStreaming ? '正在发送' : '发送'}</button>
        </form>
      </section>
    </section>
  </main>;
}
