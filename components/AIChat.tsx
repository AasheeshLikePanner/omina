"use client";
import React, { useState, useRef, useEffect } from 'react';
import {
  PaperPlaneRight,
  Robot,
  User,
  Sparkle,
  CircleNotch,
  Eraser,
  SlidersHorizontal,
  CaretDown,
  CaretUp,
  FileText
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  onClearChat: () => void;
  isStreaming: boolean;
  isModelLoaded: boolean;
  onToggleRag?: (enabled: boolean) => void;
  onToggleWeb?: (enabled: boolean) => void;
  ragEnabled?: boolean;
  webEnabled?: boolean;
  isIndexing?: boolean;
  aiMode?: string;
  onSetAiMode?: (mode: 'general' | 'science' | 'history' | 'scriptural') => void;
  jinaKey?: string;
  onSetJinaKey?: (key: string) => void;
  status?: string;
}

export function AIChat({ 
  messages, 
  onSendMessage, 
  onClearChat, 
  isStreaming, 
  isModelLoaded,
  onToggleRag,
  onToggleWeb,
  ragEnabled = true,
  webEnabled = false,
  isIndexing = false,
  aiMode = 'general',
  onSetAiMode,
  jinaKey = '',
  onSetJinaKey,
  status = ""
}: AIChatProps) {
  const [input, setInput] = useState('');
  const [systemContext, setSystemContext] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [showCaps, setShowCaps] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const capsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (capsRef.current && !capsRef.current.contains(event.target as Node)) {
        setShowCaps(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isStreaming) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreaming]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isStreaming && isModelLoaded) {
      onSendMessage(input);
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-full w-full relative">
      <div className="p-3 border-b border-[#2A2A2A] bg-[#161616] flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
              <Robot weight="fill" className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="font-semibold text-sm text-zinc-200">AI Assistant</span>
            {isIndexing && (
              <div className="flex items-center gap-1.5 ml-2 bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                <CircleNotch className="w-2.5 h-2.5 animate-spin text-primary" />
                <span className="text-[9px] font-bold text-primary uppercase tracking-wider">Indexing...</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setShowContext(!showContext)} className={cn("h-7 w-7 text-zinc-400 hover:text-primary transition-colors", showContext && "bg-[#212121] text-primary")} title="Set Context">
              <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClearChat} className="h-7 w-7 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Clear Chat">
              <Eraser className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        <AnimatePresence>
          {showContext && (
            <motion.div key="system-context-menu" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="pt-2 pb-1">
                <Textarea
                  value={systemContext}
                  onChange={(e) => setSystemContext(e.target.value)}
                  placeholder="Set system instructions..."
                  className="min-h-[60px] text-xs bg-[#212121] border-none outline-none focus:ring-0 text-zinc-300 placeholder:text-zinc-600 resize-none"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 relative overflow-hidden bg-[#1a1a1a]">
        <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-[#1a1a1a] to-transparent z-10 pointer-events-none" />
        
        {/* Top Reasoning / Pipeline Status */}
        <AnimatePresence>
          {isStreaming && status && (!messages[messages.length - 1]?.content) && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-4 left-0 right-0 z-20 flex justify-center"
            >
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#212121]/80 backdrop-blur-md border border-white/5 rounded-full shadow-xl">
                <CircleNotch className="w-3 h-3 animate-spin text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  {status}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <ScrollArea className="h-full" ref={scrollRef}>
          <div className="p-4 space-y-6 min-h-full pb-4 pt-10">
            {messages.length === 0 && (
              <div className="text-center py-20 space-y-4 opacity-50">
                <div className="w-12 h-12 rounded-2xl bg-[#212121] flex items-center justify-center mx-auto border border-[#2A2A2A]">
                  <Robot weight="fill" className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-zinc-300">Ready to assist</p>
                  <p className="text-xs text-zinc-500 px-8">Toggle intelligence modes below.</p>
                </div>
              </div>
            )}
            <AnimatePresence initial={false}>
              {messages.map((m, i) => {
                if (m.role === 'assistant' && !m.content && isStreaming) return null;
                return (
                  <motion.div
                    key={`msg-${i}`}
                    layout="position"
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                    transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1], layout: { type: "spring", stiffness: 350, damping: 30 } }}
                    className={cn("flex gap-3", m.role === 'user' ? "flex-row-reverse" : "flex-row")}
                  >
                    <div className={cn("w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-1 shadow-sm", m.role === 'user' ? "bg-primary/20 text-primary" : "bg-[#252525] text-zinc-400")}>
                      {m.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Robot className="w-3.5 h-3.5" />}
                    </div>
                    <div className={cn("flex-1 min-w-0 max-w-[85%]", m.role === 'user' ? "flex justify-end" : "flex justify-start")}>
                      <div className={cn("relative px-3.5 py-2.5 rounded-2xl text-sm shadow-sm prose prose-invert prose-p:leading-relaxed prose-pre:bg-[#000]/30 prose-pre:border prose-pre:border-white/5 max-w-none break-words", m.role === 'user' ? "bg-[#2A2A2A] text-zinc-100 rounded-tr-sm border border-[#333]" : "bg-[#161616] text-zinc-300 rounded-tl-sm border border-[#222]")}>
                        <ReactMarkdown components={{ strong: ({node, ...props}) => { const content = String(props.children); if (content.startsWith('[Page')) return <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary font-bold text-[10px] uppercase border border-primary/20 mx-0.5">{content}</span>; if (content.startsWith('[Web')) return <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 font-bold text-[10px] uppercase border border-amber-500/20 mx-0.5">{content}</span>; if (content.toLowerCase().includes('chapter')) return <span className="text-emerald-400 font-extrabold underline underline-offset-4 decoration-emerald-400/30">{content}</span>; return <strong className="text-zinc-100 font-bold" {...props} />; } }} remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      <div className="p-3 bg-[#161616] border-t border-[#2A2A2A] shrink-0 relative text-foreground">
        <AnimatePresence>
          {showCaps && (
            <motion.div key="capabilities-menu" ref={capsRef} initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} className="absolute bottom-full left-3 mb-3 w-64 bg-[#1c1c1c] border border-[#2A2A2A] rounded-2xl p-4 shadow-2xl z-50 backdrop-blur-sm">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Domain Mode</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['general', 'science', 'history', 'scriptural'] as const).map((mode) => (
                      <button key={mode} onClick={() => onSetAiMode?.(mode)} className={cn("px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border", aiMode === mode ? "bg-primary/10 border-primary/30 text-primary shadow-[0_0_10px_rgba(var(--primary),0.1)]" : "bg-[#252525] border-transparent text-zinc-500 hover:text-zinc-300")}>{mode}</button>
                    ))}
                  </div>
                </div>
                <div className="h-[1px] bg-[#2A2A2A]" />
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5"><span className="text-[11px] font-bold text-zinc-200">PDF RAG</span><span className="text-[9px] text-zinc-500">Search within document</span></div>
                  <Switch checked={ragEnabled} onCheckedChange={(val) => onToggleRag?.(val)} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5"><span className="text-[11px] font-bold text-zinc-200">Web Research</span><span className="text-[9px] text-zinc-500">Live search via Jina AI</span></div>
                  <Switch checked={webEnabled} onCheckedChange={(val) => onToggleWeb?.(val)} />
                </div>
                {webEnabled && (
                  <div className="space-y-1.5 pt-1 animate-in slide-in-from-top-1 duration-200">
                    <label className="text-[9px] font-bold text-zinc-500 uppercase px-1">Jina API Key</label>
                    <input type="password" value={jinaKey} onChange={(e) => onSetJinaKey?.(e.target.value)} placeholder="Paste key..." className="w-full bg-[#252525] border-none outline-none focus:ring-0 rounded-lg px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 shadow-inner" />
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="relative flex items-end gap-2 bg-[#212121] border-none rounded-xl p-1.5 transition-all shadow-sm outline-none focus:outline-none focus:ring-0">
          <Button onClick={() => setShowCaps(!showCaps)} variant="ghost" size="icon" className={cn("h-8 w-8 rounded-lg shrink-0 mb-0.5 transition-colors focus-visible:ring-0 focus:ring-0 focus:outline-none outline-none", showCaps ? "bg-white/5 text-primary" : "text-zinc-500 hover:text-zinc-300")}>
            <Sparkle weight={showCaps ? "fill" : "bold"} className="w-4 h-4" />
          </Button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!isStreaming && input.trim()) handleSubmit(e); } }}
            disabled={!isModelLoaded}
            placeholder={isModelLoaded ? "Ask a question..." : "Loading model..."}
            className="min-h-[40px] max-h-[120px] bg-transparent border-none text-sm focus-visible:ring-0 focus:ring-0 ring-0 outline-none focus:outline-none px-1 py-2 text-zinc-200 placeholder:text-zinc-500 resize-none overflow-y-auto"
          />
          <Button onClick={handleSubmit} size="icon" disabled={!input.trim() || isStreaming || !isModelLoaded} className="h-8 w-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 mb-0.5 focus-visible:ring-0 focus:ring-0 focus:outline-none outline-none ring-0">
            {isStreaming ? <CircleNotch className="w-4 h-4 animate-spin" /> : <PaperPlaneRight weight="fill" className="w-4 h-4" />}
          </Button>
        </div>
        <div className="flex justify-between items-center mt-2 px-1 h-4">
          <div className="flex items-center gap-3">
             <span className="text-[10px] text-zinc-500 flex items-center gap-1.5">
              <div className={cn("w-1.5 h-1.5 rounded-full", isModelLoaded ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-yellow-500")} />
              {isModelLoaded ? "Ready" : "Syncing..."}
            </span>
            <div className="flex gap-2">
              {ragEnabled && <span className="text-[9px] font-bold text-primary/70 uppercase tracking-tighter bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10">Doc</span>}
              {webEnabled && <span className="text-[9px] font-bold text-primary/70 uppercase tracking-tighter bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10">Web</span>}
            </div>
          </div>
          <span className="text-[10px] text-zinc-600">Enter to send</span>
        </div>
      </div>
    </div>
  );
}
