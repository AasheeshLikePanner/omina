"use client";
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  PaperPlaneRight,
  Robot,
  User,
  Sparkle,
  CircleNotch,
  Eraser,
  SlidersHorizontal,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// iPhone-style "ghost" word materialization
const MagicWordStream = ({ content, isStreaming }: { content: string, isStreaming: boolean }) => {
  const words = useMemo(() => content.split(/(\s+)/), [content]);
  return (
    <div className="inline leading-relaxed">
      {words.map((word, i) => (
        <motion.span
          key={`${i}-${word}`}
          initial={isStreaming ? { opacity: 0 } : { opacity: 1 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="inline-block whitespace-pre-wrap"
        >
          {word}
        </motion.span>
      ))}
    </div>
  );
};

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
  messages, onSendMessage, onClearChat, isStreaming, isModelLoaded,
  onToggleRag, onToggleWeb, ragEnabled = true, webEnabled = false,
  isIndexing = false, aiMode = 'general', onSetAiMode, jinaKey = '', onSetJinaKey, status = ""
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
      if (capsRef.current && !capsRef.current.contains(event.target as Node)) setShowCaps(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: isStreaming ? 'auto' : 'smooth' });
  }, [messages, isStreaming]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isStreaming && isModelLoaded) {
      onSendMessage(input);
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-full w-full relative bg-[#161616]">
      {/* Header */}
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
                <span className="text-[9px] font-bold text-primary uppercase tracking-wider">Syncing...</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setShowContext(!showContext)} className={cn("h-7 w-7 text-zinc-400 hover:text-primary transition-colors focus:ring-0", showContext && "bg-[#212121] text-primary")} title="Set Context">
              <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClearChat} className="h-7 w-7 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors focus:ring-0" title="Clear Chat">
              <Eraser className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        <AnimatePresence>
          {showContext && (
            <motion.div key="context" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }} className="overflow-hidden">
              <div className="pt-2 pb-1">
                <Textarea value={systemContext} onChange={(e) => setSystemContext(e.target.value)} placeholder="System instructions..." className="min-h-[60px] text-xs bg-[#212121] !border-none !ring-0 text-zinc-300 placeholder:text-zinc-600 resize-none shadow-inner focus:ring-0" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Message List */}
      <div className="flex-1 relative overflow-hidden bg-[#1a1a1a]">
        {/* Top Status Overlay */}
        <AnimatePresence>
          {isStreaming && status && (!messages[messages.length - 1]?.content) && (
            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="absolute top-4 left-0 right-0 z-20 flex justify-center pointer-events-none">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/5 shadow-2xl">
                <CircleNotch className="w-3 h-3 animate-spin text-primary" />
                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary/80">{status}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <ScrollArea className="h-full" ref={scrollRef}>
          <div className="p-4 space-y-6 min-h-full pb-8 pt-10">
            {messages.length === 0 && (
              <div className="text-center py-20 opacity-30 select-none">
                <Sparkle weight="fill" className="w-8 h-8 mx-auto text-zinc-500 mb-2" />
                <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">Intelligence Active</p>
              </div>
            )}
            <AnimatePresence initial={false} mode="popLayout">
              {messages.map((m, i) => {
                if (m.role === 'assistant' && !m.content && isStreaming) return null;
                return (
                  <motion.div
                    key={`msg-${i}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                    className={cn("flex gap-3", m.role === 'user' ? "flex-row-reverse" : "flex-row")}
                  >
                    <div className={cn("w-6 h-6 rounded flex items-center justify-center shrink-0 mt-1 shadow-sm", m.role === 'user' ? "bg-primary text-primary-foreground" : "bg-[#252525] text-zinc-400")}>
                      {m.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Robot className="w-3.5 h-3.5" />}
                    </div>
                    <div className={cn("flex-1 min-w-0 max-w-[85%]", m.role === 'user' ? "flex justify-end" : "flex justify-start")}>
                      <div className={cn(
                        "relative px-4 py-2.5 rounded-[20px] text-sm prose prose-invert prose-p:leading-relaxed max-w-none break-words",
                        m.role === 'user' ? "bg-primary text-primary-foreground rounded-tr-none shadow-md" : "bg-[#212121] text-zinc-200 rounded-tl-none border border-white/[0.03]"
                      )}>
                        {m.role === 'assistant' && i === messages.length - 1 && isStreaming ? (
                          <MagicWordStream content={m.content} isStreaming={isStreaming} />
                        ) : (
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              strong: ({node, ...props}) => {
                                const content = String(props.children);
                                if (content.startsWith('[Page')) return <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary font-bold text-[10px] mx-0.5">{content}</span>;
                                if (content.startsWith('[Web')) return <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 font-bold text-[10px] mx-0.5">{content}</span>;
                                if (content.toLowerCase().includes('chapter')) return <span className="text-emerald-400 font-bold underline underline-offset-4 decoration-emerald-400/30">{content}</span>;
                                return <strong className="text-white font-bold" {...props} />;
                              }
                            }}
                          >
                            {m.content}
                          </ReactMarkdown>
                        )}
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

      {/* Input Area */}
      <div className="p-3 bg-[#161616] border-t border-[#2A2A2A] shrink-0 relative">
        <AnimatePresence>
          {showCaps && (
            <motion.div key="caps" ref={capsRef} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.2, ease: "easeOut" }} className="absolute bottom-full left-3 mb-3 w-64 bg-[#1c1c1c] border border-white/[0.05] rounded-2xl p-4 shadow-2xl z-50 backdrop-blur-md">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-1.5">
                  {(['general', 'science', 'history', 'scriptural'] as const).map((mode) => (
                    <button key={mode} onClick={() => onSetAiMode?.(mode)} className={cn("px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border focus:ring-0 focus:outline-none", aiMode === mode ? "bg-primary/10 border-primary/30 text-primary shadow-lg" : "bg-[#252525] border-transparent text-zinc-500 hover:text-zinc-300")}>{mode}</button>
                  ))}
                </div>
                <div className="h-[1px] bg-[#2A2A2A]" />
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-bold text-zinc-200 uppercase tracking-widest">PDF RAG</span>
                  <Switch checked={ragEnabled} onCheckedChange={(val) => onToggleRag?.(val)} className="focus:ring-0 focus:outline-none" />
                </div>
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-bold text-zinc-200 uppercase tracking-widest">Web Research</span>
                  <Switch checked={webEnabled} onCheckedChange={(val) => onToggleWeb?.(val)} className="focus:ring-0 focus:outline-none" />
                </div>
                {webEnabled && <input type="password" value={jinaKey} onChange={(e) => onSetJinaKey?.(e.target.value)} placeholder="Jina API Key..." className="w-full bg-[#252525] !border-none !ring-0 rounded-lg px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none shadow-inner focus:ring-0" />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative flex items-end gap-2 bg-[#212121] !border-none rounded-xl p-1.5 transition-all !shadow-none !outline-none !ring-0">
          <Button onClick={() => setShowCaps(!showCaps)} variant="ghost" size="icon" className={cn("h-8 w-8 rounded-lg shrink-0 mb-0.5 transition-colors focus:outline-none focus:ring-0 !shadow-none", showCaps ? "bg-white/5 text-primary" : "text-zinc-500")}>
            <Sparkle weight={showCaps ? "fill" : "bold"} className="w-4 h-4" />
          </Button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!isStreaming && input.trim()) handleSubmit(e); } }}
            disabled={!isModelLoaded}
            placeholder={isModelLoaded ? "Ask anything..." : "Waking up AI..."}
            className="min-h-[40px] max-h-[120px] bg-transparent !border-none !ring-0 !outline-none px-1 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 resize-none overflow-y-auto focus:ring-0 focus:outline-none"
          />
          <Button onClick={handleSubmit} size="icon" disabled={!input.trim() || isStreaming || !isModelLoaded} className="h-8 w-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 mb-0.5 !shadow-none !outline-none !ring-0 focus:ring-0 focus:outline-none">
            {isStreaming ? <CircleNotch className="w-4 h-4 animate-spin" /> : <PaperPlaneRight weight="fill" className="w-4 h-4" />}
          </Button>
        </div>
        
        <div className="flex justify-between items-center mt-2 px-1 h-4">
          <div className="flex items-center gap-3">
             <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] flex items-center gap-1.5">
              <div className={cn("w-1.5 h-1.5 rounded-full", isModelLoaded ? "bg-green-500 shadow-[0_0_8px_rgba(var(--primary),0.4)]" : "bg-yellow-500")} />
              {isModelLoaded ? "ONLINE" : "BOOTING"}
            </span>
            <div className="flex gap-2">
              {ragEnabled && <span className="text-[8px] font-extrabold text-primary/60 uppercase tracking-widest bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10">PDF</span>}
              {webEnabled && <span className="text-[8px] font-extrabold text-amber-500/60 uppercase tracking-widest bg-amber-500/5 px-1.5 py-0.5 rounded border border-amber-500/10">WEB</span>}
            </div>
          </div>
          <span className="text-[9px] font-bold text-zinc-700 tracking-wider uppercase">Nexus v1.0</span>
        </div>
      </div>
    </div>
  );
}
