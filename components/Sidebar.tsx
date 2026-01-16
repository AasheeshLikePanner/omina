"use client";

import React, { useEffect, useState } from 'react';
import { db, type PDFFile } from '@/lib/db';
import { cn } from '@/lib/utils';
import {
  BookOpen,
  FileText,
  Plus,
  Cpu,
  Gear,
  CaretRight,
  Sidebar as SidebarIcon,
  Trash,
  Notebook,
  ChatCircleDots
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { APP_MODELS } from '@/lib/webllm';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SidebarProps {
  onSelectPDF: (pdf: PDFFile) => void;
  selectedPdfId?: number;
  modelStatus: { progress: number; text: string; isLoaded: boolean };
  currentModel: string;
  onModelChange: (modelId: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onImportNew: () => void;
  showNotes: boolean;
  onToggleNotes: () => void;
  showChat: boolean;
  onToggleChat: () => void;
}

export function Sidebar({
  onSelectPDF,
  selectedPdfId,
  modelStatus,
  currentModel,
  onModelChange,
  isCollapsed,
  onToggleCollapse,
  onImportNew,
  showNotes,
  onToggleNotes,
  showChat,
  onToggleChat
}: SidebarProps) {
  const [pdfs, setPdfs] = useState<PDFFile[]>([]);

  useEffect(() => {
    const fetchPdfs = async () => {
      const allPdfs = await db.pdfs.orderBy('lastRead').reverse().toArray();
      setPdfs(allPdfs);
    };
    fetchPdfs();
    const interval = setInterval(fetchPdfs, 3000);
    return () => clearInterval(interval);
  }, []);

  const selectedModelName = APP_MODELS.find(m => m.id === currentModel)?.name || "Select Model";

  if (isCollapsed) {
    return (
      <div className="w-[60px] border-r border-[#2A2A2A]/50 bg-[#161616] flex flex-col items-center py-6 gap-6 transition-all duration-300">
        <Button variant="ghost" size="icon" onClick={onToggleCollapse} className="text-zinc-500 hover:text-zinc-100 hover:bg-white/5 h-8 w-8 rounded-lg transition-colors">
          <SidebarIcon weight="bold" className="w-5 h-5" />
        </Button>
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
          <BookOpen weight="fill" className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 flex flex-col items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleNotes}
            className={cn("h-9 w-9 rounded-lg transition-colors", showNotes ? "text-primary bg-primary/10" : "text-zinc-500 hover:text-zinc-100 hover:bg-white/5")}
          >
            <Notebook weight={showNotes ? "fill" : "bold"} className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleChat}
            className={cn("h-9 w-9 rounded-lg transition-colors", showChat ? "text-primary bg-primary/10" : "text-zinc-500 hover:text-zinc-100 hover:bg-white/5")}
          >
            <ChatCircleDots weight={showChat ? "fill" : "bold"} className="w-5 h-5" />
          </Button>
        </div>
        <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-zinc-100 hover:bg-white/5 h-9 w-9 mb-2">
          <Gear weight="bold" className="w-5 h-5" />
        </Button>
      </div>
    );
  }

  return (
    <aside className="w-64 border-r border-[#2A2A2A]/50 bg-[#161616] flex flex-col h-screen text-zinc-400 relative group/sidebar shadow-2xl">
      <div className="p-4 flex items-center justify-between border-b border-[#2A2A2A]/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-white text-black flex items-center justify-center font-bold shadow-lg shadow-white/10 overflow-hidden">
            <BookOpen weight="fill" className="w-4 h-4" />
          </div>
          <span className="font-bold text-zinc-100 tracking-tight text-sm">Nexus Reader</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onToggleCollapse} className="text-zinc-600 hover:text-zinc-200 h-8 w-8">
          <SidebarIcon weight="bold" className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-3 space-y-4">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-2 block px-2">
            AI Engine
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between bg-[#111] border-[#2A2A2A]/50 hover:bg-[#212121] text-zinc-300 rounded-lg h-9 shadow-sm transition-all">
                <div className="flex items-center gap-2 truncate">
                  <div className={`w-1.5 h-1.5 rounded-full ${modelStatus.isLoaded ? 'bg-green-500' : 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]'}`} />
                  <span className="truncate text-xs font-medium">{selectedModelName}</span>
                </div>
                <CaretRight weight="bold" className="w-3 h-3 text-zinc-600" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-[#1c1c1c] border-[#2A2A2A] text-zinc-300 p-1 rounded-lg shadow-2xl">
              <DropdownMenuLabel className="text-[10px] uppercase text-zinc-500 px-2 py-1.5">Local Models</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[#2A2A2A]" />
              {APP_MODELS.map((model) => (
                <DropdownMenuItem
                  key={model.id}
                  onClick={() => onModelChange(model.id)}
                  className="rounded-md py-1.5 focus:bg-primary/10 focus:text-primary cursor-pointer text-xs"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{model.name}</span>
                    <span className="text-[9px] opacity-60">{model.vram} VRAM</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {modelStatus.progress > 0 && !modelStatus.isLoaded && (
            <div className="mt-2 space-y-1.5 px-1 pb-1">
              <div className="flex justify-between text-[9px] font-medium uppercase tracking-tight">
                <span className="text-zinc-500 truncate mr-2">{modelStatus.text}</span>
                <span className="text-primary font-mono">{Math.round(modelStatus.progress * 100)}%</span>
              </div>
              <Progress value={modelStatus.progress * 100} className="h-0.5 bg-[#2a2a2a] overflow-hidden" />
            </div>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 px-2">
        <div className="space-y-0.5 py-2">
          <label className="px-2 text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-2 block">
            Navigation
          </label>
          <button
            onClick={onToggleNotes}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group/nav",
              showNotes ? "text-zinc-100 font-medium bg-white/5" : "text-zinc-500 hover:text-zinc-300 hover:bg-[#1c1c1c]"
            )}
          >
            <Notebook weight={showNotes ? "fill" : "regular"} className={cn("w-4 h-4", showNotes ? "text-primary" : "group-hover/nav:text-zinc-400")} />
            <span className="text-xs">Notes & Bookmarks</span>
          </button>
          <button
            onClick={onToggleChat}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group/nav mt-0.5",
              showChat ? "text-zinc-100 font-medium bg-white/5" : "text-zinc-500 hover:text-zinc-300 hover:bg-[#1c1c1c]"
            )}
          >
            <ChatCircleDots weight={showChat ? "fill" : "regular"} className={cn("w-4 h-4", showChat ? "text-primary" : "group-hover/nav:text-zinc-400")} />
            <span className="text-xs">AI Assistant</span>
          </button>

          <div className="h-4" />

          <div className="px-2 flex items-center justify-between mb-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">
              Library
            </label>
            <Button
              variant="ghost"
              size="icon"
              onClick={onImportNew}
              className="h-5 w-5 text-zinc-600 hover:text-primary transition-colors"
              title="Import New PDF"
            >
              <Plus weight="bold" className="w-3 h-3" />
            </Button>
          </div>
          {pdfs.map((pdf) => (
            <button
              key={pdf.id}
              onClick={() => onSelectPDF(pdf)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group/item",
                selectedPdfId === pdf.id
                  ? "bg-zinc-800/40 text-zinc-100 font-medium border border-zinc-700/50 shadow-lg"
                  : "hover:bg-[#1c1c1c] text-zinc-500 hover:text-zinc-300"
              )}
            >
              <FileText weight={selectedPdfId === pdf.id ? "fill" : "regular"} className={cn(
                "w-4 h-4 shrink-0 transition-colors",
                selectedPdfId === pdf.id ? "text-primary" : "text-zinc-700 group-hover/item:text-zinc-500"
              )} />
              <span className="truncate flex-1 text-left text-xs">{pdf.name}</span>
              {selectedPdfId === pdf.id && <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
            </button>
          ))}

          {pdfs.length === 0 && (
            <div className="px-3 py-10 text-center space-y-3 border border-dashed border-zinc-800 rounded-xl mx-2 mt-2 opacity-40">
              <Plus weight="bold" className="w-5 h-5 text-zinc-600 mx-auto" />
              <p className="text-[10px] text-zinc-600 font-bold uppercase">No Docs</p>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-[#2A2A2A]/50 bg-[#111]/30">
        <Button variant="ghost" className="w-full justify-start gap-3 text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800/40 rounded-lg h-9 transition-all">
          <Gear weight="bold" className="w-4 h-4" />
          <span className="text-xs font-semibold">Settings</span>
        </Button>
      </div>
    </aside>
  );
}