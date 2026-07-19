'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/bottom-nav';
import { ParticleAvatar } from '@/components/particle-avatar';
import { getUser, getMemories, CHILDREN_FIVE_TIMES, syncMemoriesFromBackend } from '@/lib/store';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const BTN_GRADIENT = 'linear-gradient(90deg, #C4A35A, #7B9E89)';

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [perspective, setPerspective] = useState<'parent' | 'child'>('parent');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.replace('/onboarding'); return; }
    setUser(u);
    if (u.role === 'child') setPerspective('child');
    // Sync memories from backend so memoryContext includes DB data
    syncMemoriesFromBackend();
  }, [router]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const buildMemoryContext = useCallback(() => {
    const memories = getMemories();
    return memories.slice(0, 20).map(m => {
      const primaryType = m.timeTypes?.[0];
      const t = primaryType ? CHILDREN_FIVE_TIMES.find(t => t.value === primaryType) : undefined;
      return `${m.date}: ${m.content} [${t?.label || '其他'}] [${m.emotion}] [${m.scene}]`;
    }).join('\n');
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;
    setStreaming(true);
    setShowSuggestions(false);

    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          childName: user?.childName || '宝宝',
          memoryContext: buildMemoryContext(),
          userRole: perspective,
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error('API error');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let assistantMsg = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.done) break;
            if (data.content) {
              assistantMsg += data.content;
              setMessages(prev => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 1] = { role: 'assistant', content: assistantMsg };
                return newMsgs;
              });
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，我暂时无法回应。请稍后再试。' }]);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [messages, streaming, user, perspective, buildMemoryContext]);

  const suggestions = perspective === 'parent'
    ? ['小宝今天有什么特别的事吗？', '说说小宝的性格特点', '小宝最近在成长什么方面？']
    : ['我真正擅长什么？', '我小时候是什么样的人？', '我为什么会有这样的反应？'];

  const avatarLabel = perspective === 'parent'
    ? `${user?.childName || '宝宝'}的孪生体 · 家长视角`
    : `${user?.childName || '宝宝'}的孪生体 · 孩子视角`;

  const avatarSub = perspective === 'parent'
    ? '以第三人称陪伴记录成长'
    : '以第二人称帮你认识自己';

  if (!user) return null;

  return (
    <div className="min-h-screen relative overflow-hidden morandi-dawn">
      {/* 莫兰迪云朵 */}
      <div className="ghibli-cloud animate-cloud-drift" style={{ width: 200, height: 120, top: '5%', left: '5%', background: 'rgba(255,255,255,0.35)' }} />
      <div className="ghibli-cloud animate-float-slow" style={{ width: 160, height: 100, bottom: '10%', right: '5%', background: 'rgba(196,163,90,0.1)' }} />

      <div className="relative max-w-2xl mx-auto px-4 pb-24 pt-4 flex flex-col h-screen z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-full overflow-hidden shadow-md flex items-center justify-center"
              style={{ width: 40, height: 40, boxShadow: '0 2px 8px rgba(196,163,90,0.2)' }}>
              <ParticleAvatar growth={0.7} size={40} animate={true} />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#6B5B45]">{avatarLabel}</h1>
              <p className="text-[10px] text-[#8B7B65]/40">{avatarSub}</p>
            </div>
          </div>
          {/* Perspective Toggle */}
          <div className="flex items-center gap-1 bg-white/40 rounded-xl p-0.5 border" style={{ borderColor: 'rgba(196,163,90,0.15)' }}>
            <button
              onClick={() => setPerspective('parent')}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                perspective === 'parent' ? 'text-[#6B5B45] shadow-sm' : 'text-[#8B7B65]/40'
              }`}
              style={perspective === 'parent' ? { background: 'rgba(212,200,142,0.4)' } : {}}
            >
              家长
            </button>
            <button
              onClick={() => setPerspective('child')}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                perspective === 'child' ? 'text-[#6B5B45] shadow-sm' : 'text-[#8B7B65]/40'
              }`}
              style={perspective === 'child' ? { background: 'rgba(212,200,142,0.4)' } : {}}
            >
              孩子
            </button>
          </div>
        </div>

        {/* AI Content Label */}
        <p className="text-[9px] text-[#8B7B65]/30 text-center mb-2">
          此对话由AI孪生体生成，基于真实成长记录，不代表专业心理建议
        </p>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto space-y-3 mb-3 px-0.5">
          {messages.length === 0 && !streaming && (
            <div className="text-center py-8">
              <div className="mx-auto mb-3 animate-breathe">
                <ParticleAvatar growth={0.75} size={80} animate={true} />
              </div>
              <p className="text-sm text-[#8B7B65]/70 mb-4">
                {perspective === 'parent'
                  ? `你好，我是${user?.childName || '宝宝'}的时光镜像。跟我聊聊TA的成长吧。`
                  : `你好，我是你的时光镜像。让我带你看看你小时候的故事。`}
              </p>
              {showSuggestions && (
                <div className="flex flex-wrap gap-2 justify-center max-w-sm mx-auto">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(s)}
                      className="px-3 py-1.5 rounded-xl bg-white/40 text-xs text-[#8B7B65]/70 border transition-all hover:bg-white/60"
                      style={{ borderColor: 'rgba(196,163,90,0.15)' }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs mr-2 mt-1 flex-shrink-0 shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #D4C88E, #C4A35A)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 2v6m0 0c-2 0-4 2-4 5 0 3 2 5 4 5s4-2 4-5c0-3-2-5-4-5zm0 0c-3-2-6-1-6 3 0 4 3 6 6 5m0-8c3-2 6-1 6 3 0 4-3 6-6 5" />
                  </svg>
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'text-white rounded-br-md shadow-sm'
                  : 'glass-warm text-[#6B5B45] rounded-bl-md'
              }`}
              style={msg.role === 'user' ? { background: BTN_GRADIENT } : {}}>
                {msg.role === 'assistant' ? (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                ) : (
                  msg.content
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-white ml-2 mt-1 flex-shrink-0 shadow-sm"
                  style={{ background: perspective === 'parent' ? '#C4A35A' : '#7B9E89' }}>
                  {perspective === 'parent' ? '👩' : '👦'}
                </div>
              )}
            </div>
          ))}

          {streaming && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs mr-2 mt-1 flex-shrink-0 shadow-sm"
                style={{ background: 'linear-gradient(135deg, #D4C88E, #C4A35A)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 2v6m0 0c-2 0-4 2-4 5 0 3 2 5 4 5s4-2 4-5c0-3-2-5-4-5zm0 0c-3-2-6-1-6 3 0 4 3 6 6 5m0-8c3-2 6-1 6 3 0 4-3 6-6 5" />
                </svg>
              </div>
              <div className="glass-warm rounded-2xl rounded-bl-md px-4 py-2.5">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-[#C4A35A] rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                  <span className="w-1.5 h-1.5 bg-[#C4A35A] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <span className="w-1.5 h-1.5 bg-[#C4A35A] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              placeholder={perspective === 'parent' ? '聊聊孩子的成长...' : '问问关于你自己的事...'}
              rows={1}
              className="w-full bg-white/50 rounded-xl pl-3 pr-10 py-2.5 text-sm text-[#6B5B45] border resize-none focus:outline-none transition-all"
              style={{ borderColor: 'rgba(196,163,90,0.15)' }}
            />
          </div>
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming}
            className="px-4 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-40 hover:shadow-lg transition-all flex-shrink-0"
            style={{ background: BTN_GRADIENT }}
          >
            发送
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
