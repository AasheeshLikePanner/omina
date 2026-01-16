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
  ChatCircleDots,
  Keyboard,
  House,
  Warning
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from '@/components/ui/scroll-area';
import { APP_MODELS } from '@/lib/webllm';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';

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

  const fetchPdfs = async () => {
    const allPdfs = await db.pdfs.orderBy('lastRead').reverse().toArray();
    setPdfs(allPdfs);
  };

  useEffect(() => {
    fetchPdfs();
    const interval = setInterval(fetchPdfs, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleDeletePdf = async (id: number) => {
    try {
      await db.pdfs.delete(id);
      await db.messages.where('pdfId').equals(id).delete();
      await db.notes.where('pdfId').equals(id).delete();
      await db.bookmarks.where('pdfId').equals(id).delete();
      await db.highlights.where('pdfId').equals(id).delete();
      
      toast.success("Document deleted permanently");
      fetchPdfs();
      if (selectedPdfId === id) {
        onImportNew();
      }
    } catch (error) {
      toast.error("Failed to delete document");
    }
  };

  const selectedModelName = APP_MODELS.find(m => m.id === currentModel)?.name || "Select Model";

  if (isCollapsed) {
    return (
      <div className="w-[60px] border-r border-[#2A2A2A]/50 bg-[#161616] flex flex-col items-center py-6 gap-6 transition-all duration-300">
        <Button variant="ghost" size="icon" onClick={onToggleCollapse} className="text-zinc-500 hover:text-zinc-100 hover:bg-white/5 h-8 w-8 rounded-lg transition-colors">
          <SidebarIcon weight="bold" className="w-5 h-5" />
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onImportNew} className={cn("h-9 w-9 rounded-lg transition-colors", !selectedPdfId ? "text-primary bg-primary/10" : "text-zinc-500 hover:text-zinc-100 hover:bg-white/5")}>
                <House weight={!selectedPdfId ? "fill" : "bold"} className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Home / New Upload</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {selectedPdfId && (
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
        )}
      </div>
    );
  }

  return (
    <aside className="w-64 border-r border-[#2A2A2A]/50 bg-[#161616] flex flex-col h-screen text-zinc-400 relative group/sidebar shadow-2xl">
      <div className="p-4 flex items-center justify-between border-b border-[#2A2A2A]/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center shadow-lg shadow-white/10 overflow-hidden">
            <svg width="18" height="18" viewBox="0 0 256 256" fill="black">
              <path d="M240,56V200a8,8,0,0,1-8,8H160a24,24,0,0,0-24,23.94,7.9,7.9,0,0,1-5.12,7.55A8,8,0,0,1,120,232a24,24,0,0,0-24-24H24a8,8,0,0,1-8-8V56a8,8,0,0,1,8-8H88a32,32,0,0,1,32,32v87.73a8.17,8.17,0,0,0,7.47,8.25,8,8,0,0,0,8.53-8V80a32,32,0,0,1,32-32h64A8,8,0,0,1,240,56Z" />
            </svg>
          </div>
          <span className="font-bold text-zinc-100 tracking-tight text-sm">Omnia</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onToggleCollapse} className="text-zinc-600 hover:text-zinc-200 h-8 w-8">
          <SidebarIcon weight="bold" className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-3 py-6 space-y-0.5">
          <label className="px-2 text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-3 block">
            Navigation
          </label>
          
          <button
            onClick={onImportNew}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all group/nav",
              !selectedPdfId ? "text-zinc-100 font-medium bg-white/5" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]"
            )}
          >
            <div className="flex items-center gap-3">
              <House weight={!selectedPdfId ? "fill" : "regular"} className={cn("w-4 h-4", !selectedPdfId ? "text-primary" : "group-hover/nav:text-zinc-400")} />
              <span className="text-xs">Home / New File</span>
            </div>
          </button>

          {selectedPdfId && (
            <>
              <button
                onClick={onToggleNotes}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all group/nav mt-1",
                  showNotes ? "text-zinc-100 font-medium bg-white/5" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]"
                )}
              >
                <div className="flex items-center gap-3">
                  <Notebook weight={showNotes ? "fill" : "regular"} className={cn("w-4 h-4", showNotes ? "text-primary" : "group-hover/nav:text-zinc-400")} />
                  <span className="text-xs">Notebook</span>
                </div>
                <kbd className="hidden group-hover/nav:block px-1.5 py-0.5 rounded bg-zinc-800 text-[9px] font-mono text-zinc-500 uppercase">⌘L</kbd>
              </button>
              <button
                onClick={onToggleChat}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all group/nav mt-1",
                  showChat ? "text-zinc-100 font-medium bg-white/5" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]"
                )}
              >
                <div className="flex items-center gap-3">
                  <ChatCircleDots weight={showChat ? "fill" : "regular"} className={cn("w-4 h-4", showChat ? "text-primary" : "group-hover/nav:text-zinc-400")} />
                  <span className="text-xs">AI Assistant</span>
                </div>
                <kbd className="hidden group-hover/nav:block px-1.5 py-0.5 rounded bg-zinc-800 text-[9px] font-mono text-zinc-500 uppercase">⌘J</kbd>
              </button>
            </>
          )}

          <div className="h-8" />

          <div className="px-2 flex items-center justify-between mb-3">
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
              <Plus weight="bold" className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="space-y-0.5">
            {pdfs.map((pdf) => (
              <div
                key={pdf.id}
                onClick={() => onSelectPDF(pdf)}
                className={cn(
                  "group/item grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer",
                  selectedPdfId === pdf.id
                    ? "text-zinc-100 font-medium bg-white/[0.04]"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText weight={selectedPdfId === pdf.id ? "fill" : "regular"} className={cn(
                    "w-3.5 h-3.5 shrink-0 transition-colors",
                    selectedPdfId === pdf.id ? "text-primary" : "text-zinc-800 group-hover/item:text-zinc-600"
                  )} />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate text-[10px] font-medium tracking-tight uppercase max-w-[100px]" title={pdf.name}>
                      {pdf.name}
                    </span>
                    <div className="flex items-center gap-1.5 h-3">
                      {pdf.discoveryStatus === 'learning' ? (
                        <span className="text-[7px] font-bold text-primary/60 uppercase tracking-widest animate-pulse">
                          Learning...
                        </span>
                      ) : pdf.discoveryStatus === 'complete' ? (
                        <span className="text-[7px] font-bold text-emerald-500/60 uppercase tracking-widest flex items-center gap-1">
                          <div className="w-1 h-1 rounded-full bg-emerald-500/40" />
                          AI Optimized
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        className={cn(
                          "p-1.5 text-zinc-700 hover:text-red-500/70 transition-all opacity-0 group-hover/item:opacity-100"
                        )}
                        title="Delete"
                      >
                        <Trash weight="bold" className="w-3.5 h-3.5" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-[#161616] border-[#222] max-w-xs p-6 rounded-2xl">
                      <AlertDialogHeader className="gap-1">
                        <AlertDialogTitle className="text-sm font-bold uppercase tracking-widest text-zinc-200">
                          Confirm Delete
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-[10px] uppercase tracking-wider text-zinc-500">
                          This action is permanent.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="mt-4 gap-2">
                        <AlertDialogCancel className="h-8 text-[9px] uppercase font-bold tracking-widest border-[#222] rounded-lg">
                          Back
                        </AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePdf(pdf.id!);
                          }}
                          className="h-8 text-[9px] uppercase font-bold tracking-widest bg-red-500/10 text-red-500 hover:bg-red-500/20 border-0 rounded-lg shadow-none"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  
                  {selectedPdfId === pdf.id && (
                    <div className="w-1 h-1 rounded-full bg-primary/40 group-hover/item:hidden" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {pdfs.length === 0 && (
            <div className="px-3 py-10 text-center space-y-3 border border-dashed border-zinc-800 rounded-xl mx-2 mt-4 opacity-40">
              <Plus weight="bold" className="w-5 h-5 text-zinc-600 mx-auto" />
              <p className="text-[10px] text-zinc-600 font-bold uppercase">No Docs</p>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="mt-auto p-4 space-y-4 border-t border-[#2A2A2A]/50">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-2 block px-1">
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
        
        <div className="pt-2 border-t border-[#2A2A2A]/50">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Keyboard weight="bold" className="w-4 h-4 text-primary/70" />
            <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
              Shortcuts
            </label>
          </div>
          <div className="space-y-2.5 px-1">
            {[
              { key: '⌘B', label: 'Sidebar' },
              { key: '⌘J', label: 'AI' },
              { key: '⌘L', label: 'Notes' },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between group cursor-default">
                <span className="text-[10px] text-zinc-500 group-hover:text-zinc-300 transition-colors font-medium">{s.label}</span>
                <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-mono text-zinc-400 group-hover:border-primary/50 group-hover:text-primary transition-all">
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
