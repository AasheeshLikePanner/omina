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
  CaretUp
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Magic streaming component that animates words in
// Butter-smooth spring-based word streaming
const SmoothStreamingText = ({ content }: { content: string }) => {
  const words = React.useMemo(() => {
    return content.split(/(\s+)/).filter(Boolean);
  }, [content]);

  return (
    <div className="inline leading-relaxed whitespace-pre-wrap antialiased">
      {words.map((word, i) => (
        <motion.span
          key={`${i}-${word.length}`}
          initial={{ opacity: 0, scale: 0.98, y: 2 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 30,
            mass: 0.8
          }}
          className="inline-block origin-left"
        >
          {word}
        </motion.span>
      ))}
    </div>
  );
};

interface AIChatProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  onClearChat: () => void;
  isStreaming: boolean;
  isModelLoaded: boolean;
}

export function AIChat({ messages, onSendMessage, onClearChat, isStreaming, isModelLoaded }: AIChatProps) {
  const [input, setInput] = useState('');
  const [systemContext, setSystemContext] = useState('');
  const [showContext, setShowContext] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom with better performance
  useEffect(() => {
    if (isStreaming) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isStreaming && isModelLoaded) {
      const fullMessage = systemContext.trim()
        ? `[Context: ${systemContext}]\n\n${input}`
        : input;
      onSendMessage(fullMessage);
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-full w-full relative">
      {/* Chat Header */}
      <div className="p-3 border-b border-[#2A2A2A] bg-[#161616] flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
              <Robot weight="fill" className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="font-semibold text-sm text-zinc-200">AI Assistant</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowContext(!showContext)}
              className={cn(
                "h-7 w-7 text-zinc-400 hover:text-primary transition-colors",
                showContext && "bg-[#212121] text-primary"
              )}
              title="Set Context / System Prompt"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClearChat}
              className="h-7 w-7 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Clear Chat"
            >
              <Eraser className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Top Context Input */}
        <AnimatePresence>
          {showContext && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-2 pb-1">
                <Textarea
                  value={systemContext}
                  onChange={(e) => setSystemContext(e.target.value)}
                  placeholder="Set context (e.g. 'You are a legal expert. Be concise.')"
                  className="min-h-[60px] text-xs bg-[#212121] border-[#2A2A2A] text-zinc-300 placeholder:text-zinc-600 focus-visible:ring-primary/20 resize-none"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Messages Area */}
      <div className="flex-1 relative overflow-hidden bg-[#1a1a1a]">
        {/* Top Gradient Mask for smooth scrolling disappearance */}
        <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-[#1a1a1a] to-transparent z-10 pointer-events-none" />

        <ScrollArea className="h-full" ref={scrollRef}>
          <div className="p-4 space-y-6 min-h-full pb-4 pt-10">
            {messages.length === 0 && (
              <div className="text-center py-20 space-y-4 opacity-50">
                <div className="w-12 h-12 rounded-2xl bg-[#212121] flex items-center justify-center mx-auto border border-[#2A2A2A]">
                  <Robot weight="fill" className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-zinc-300">Ready to assist</p>
                  <p className="text-xs text-zinc-500 px-8">
                    Ask questions about the PDF or set a context above for specific tasks.
                  </p>
                </div>
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  layout="position"
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                  transition={{
                    duration: 0.4,
                    ease: [0.23, 1, 0.32, 1], // Custom cubic-bezier for 'buttery' feel
                    layout: { type: "spring", stiffness: 350, damping: 30 }
                  }}
                  className={cn(
                    "flex gap-3",
                    m.role === 'user' ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-1 shadow-sm",
                    m.role === 'user'
                      ? "bg-primary/20 text-primary"
                      : "bg-[#252525] text-zinc-400"
                  )}>
                    {m.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Robot className="w-3.5 h-3.5" />}
                  </div>
                  <div className={cn(
                    "flex-1 min-w-0 max-w-[85%]", // Constrain width for better readability
                    m.role === 'user' ? "flex justify-end" : "flex justify-start"
                  )}>
                    <div className={cn(
                      "relative px-3 py-2 rounded-2xl text-sm shadow-sm prose prose-invert prose-xs max-w-none break-words [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:pl-4 [&>ol]:pl-4",
                      m.role === 'user'
                        ? "bg-[#2A2A2A] text-zinc-100 rounded-tr-sm border border-[#333]"
                        : "bg-[#161616] text-zinc-300 rounded-tl-sm border border-[#222]"
                    )}>
                      {m.role === 'assistant' && i === messages.length - 1 && isStreaming ? (
                        <SmoothStreamingText content={m.content} />
                      ) : (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {m.content}
                        </ReactMarkdown>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isStreaming && (
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-md bg-[#252525] flex items-center justify-center shrink-0 mt-1">
                  <CircleNotch className="w-4 h-4 animate-spin text-primary" />
                </div>
                <div className="flex items-center h-8 bg-[#161616] px-3 rounded-2xl border border-[#222]">
                  <div className="flex gap-1">
                    <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce" />
                    <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="p-3 bg-[#161616] border-t border-[#2A2A2A] shrink-0">
        <div className="relative flex items-end gap-2 bg-[#212121] border border-[#2A2A2A] rounded-xl p-1.5 focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary/50 transition-all">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            disabled={!isModelLoaded || isStreaming}
            placeholder={isModelLoaded ? "Ask a question..." : "Loading model..."}
            className="min-h-[40px] max-h-[120px] bg-transparent border-none text-sm focus-visible:ring-0 px-2 py-2 text-zinc-200 placeholder:text-zinc-500 resize-none overflow-y-auto"
          />
          <Button
            onClick={handleSubmit}
            size="icon"
            disabled={!input.trim() || isStreaming || !isModelLoaded}
            className="h-8 w-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 mb-0.5"
          >
            <PaperPlaneRight weight="fill" className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex justify-between items-center mt-2 px-1 h-4">
          <span className="text-[10px] text-zinc-500 flex items-center gap-1.5">
            <div className={cn("w-1.5 h-1.5 rounded-full", isModelLoaded ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-yellow-500")} />
            {isModelLoaded ? "Engine Ready" : "Initializing..."}
          </span>
          <span className="text-[10px] text-zinc-600">Enter to send, Shift+Enter for newline</span>
        </div>
      </div>
    </div>
  );
}