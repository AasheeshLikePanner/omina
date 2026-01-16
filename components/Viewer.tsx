"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Viewer, Worker, SpecialZoomLevel } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin, ToolbarProps, ToolbarSlot } from '@react-pdf-viewer/default-layout';
import { highlightPlugin, RenderHighlightTargetProps } from '@react-pdf-viewer/highlight';
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import '@react-pdf-viewer/highlight/lib/styles/index.css';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sparkle,
  Minus,
  Plus,
  CornersOut,
  Sun,
  Moon,
  NotePencil,
  BookmarkSimple,
  ChatCircleDots,
  TextAa,
  MagnifyingGlass,
  Warning
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';

interface PDFViewerProps {
  fileUrl: string;
  isDarkMode?: boolean;
  initialPage?: number;
  onAskAI?: (text: string, context: string) => void;
  onPageChange?: (page: number) => void;
  onToggleTheme?: () => void;
  onAddNote?: (pageIndex: number, selectedText: string) => void;
  onAddBookmark?: (pageIndex: number) => void;
  jumpToPage?: number;
  repairMap?: Record<string, string>;
}

interface HighlightMenuProps {
  renderProps: RenderHighlightTargetProps;
  onAskAI?: (text: string, context: string) => void;
  onAddNote?: (pageIndex: number, selectedText: string) => void;
  currentPage: number;
  isDarkMode: boolean;
  repairMap?: Record<string, string>;
}

// Detect if text contains corrupted/broken character encoding
const detectBrokenEncoding = (text: string): boolean => {
  const brokenPatterns = [
    /[\u0080-\u009F]/g,
    /[™†‰]/g,
    /[\uFFFD]/g,
    /[\uE000-\uF8FF]/g,
    /[^\x20-\x7E\u00A0-\u024F\u0900-\u097F\u0C00-\u0C7F\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\u0600-\u06FF]/g
  ];
  const suspiciousCount = brokenPatterns.reduce((count, pattern) => {
    const matches = text.match(pattern);
    return count + (matches ? matches.length : 0);
  }, 0);
  return suspiciousCount > text.length * 0.2;
};

const HighlightMenu = ({ renderProps, onAskAI, onAddNote, currentPage, isDarkMode, repairMap }: HighlightMenuProps) => {
  const [mode, setMode] = useState<'menu' | 'ask' | 'broken'>('menu');
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Advanced Universal Text Repair: Applies the learned repairMap locally
  const { selectedText, isBroken } = React.useMemo(() => {
    let text = renderProps.selectedText;
    
    // Step 1: Normalize
    text = text.normalize('NFKC');
    
    // Step 2: Apply the Learned Rosetta Stone (Repair Map)
    if (repairMap) {
      for (const [junk, real] of Object.entries(repairMap)) {
        text = text.split(junk).join(real);
      }
    }
    
    // Step 3: Clean artifacts
    text = text
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    return { selectedText: text, isBroken: detectBrokenEncoding(text) };
  }, [renderProps.selectedText, repairMap]);

  useEffect(() => {
    if (mode === 'ask') inputRef.current?.focus();
  }, [mode]);

  // Auto-detect broken text and switch to warning mode
  useEffect(() => {
    if (isBroken && mode === 'menu') {
      setMode('broken');
    }
  }, [isBroken, mode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) {
      // If text is broken, warn user to describe what they see instead
      if (isBroken) {
        onAskAI?.(`[Note: The PDF has broken text encoding. User selected corrupted text: "${selectedText}"] ${query}`, selectedText);
      } else {
        onAskAI?.(query, selectedText);
      }
      renderProps.cancel();
    }
    if (e.key === 'Escape') setMode('menu');
  };

  const handleAskAI = () => {
    if (isBroken) {
      // Automatically inform AI about broken encoding
      onAskAI?.(
        `The selected text appears corrupted due to PDF encoding issues. The raw text extracted is: "${selectedText}". Can you help identify what this text should say based on the document context?`,
        selectedText
      );
    } else {
      setMode('ask');
    }
  };

  const isSingleWord = selectedText.trim().split(/\s+/).length === 1;

  return (
    <div
      style={{
        background: isDarkMode ? '#1c1c1c' : '#fff',
        border: 'none',
        borderRadius: '8px',
        padding: '4px',
        position: 'absolute',
        left: `${renderProps.selectionRegion.left}%`,
        top: `${renderProps.selectionRegion.top + renderProps.selectionRegion.height}%`,
        zIndex: 100,
        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.4)',
        marginTop: '8px',
        display: 'flex',
        flexDirection: 'column',
        minWidth: mode === 'ask' ? '240px' : mode === 'broken' ? '280px' : 'auto'
      }}
      className="animate-in fade-in zoom-in-95 duration-100"
    >
      {mode === 'broken' ? (
        <div className="p-3 space-y-2">
          <div className="flex items-start gap-2">
            <Warning weight="fill" className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
            <div className="space-y-1.5">
              <p className="text-xs text-zinc-300 leading-relaxed">
                This PDF has <strong>broken character encoding</strong>. The text appears as: 
                <code className="block mt-1 px-2 py-1 bg-zinc-800 rounded text-[10px] font-mono text-orange-400">
                  {selectedText}
                </code>
              </p>
              <p className="text-[11px] text-zinc-400">
                The visual text doesn't match the copied data.
              </p>
            </div>
          </div>
          <div className="flex gap-1.5 pt-1">
            <button 
              onClick={() => {
                onAskAI?.(
                  `The selected text has broken PDF encoding and appears as: "${selectedText}". Please help identify what this text actually says based on the surrounding document context.`,
                  selectedText
                );
                renderProps.cancel();
              }}
              className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-primary/20 hover:bg-primary/30 rounded-md text-xs transition-colors text-primary font-medium"
            >
              <Sparkle weight="fill" className="w-3.5 h-3.5" />
              Fix with AI
            </button>
            <button 
              onClick={() => setMode('menu')}
              className="px-2.5 py-1.5 hover:bg-zinc-500/20 rounded-md text-xs transition-colors text-zinc-400"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : mode === 'menu' ? (
        <div className="flex gap-1">
          <button onClick={handleAskAI} className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-zinc-500/20 rounded-md text-xs transition-colors text-zinc-200 whitespace-nowrap">
            <Sparkle weight="fill" className="w-4 h-4 text-primary" /> Ask AI
          </button>
          <button 
            onClick={() => { 
              const prompt = isSingleWord 
                ? `Define the word "${selectedText}" in the context of this document.` 
                : `Explain this section simply: "${selectedText}"`;
              onAskAI?.(prompt, selectedText); 
              renderProps.cancel(); 
            }} 
            className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-zinc-500/20 rounded-md text-xs transition-colors text-zinc-200 whitespace-nowrap"
          >
            {isSingleWord ? "Define" : "Explain"}
          </button>
          <div className="w-[1px] bg-zinc-700 my-1" />
          <button onClick={() => { onAddNote?.(currentPage, selectedText); renderProps.cancel(); }} className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-zinc-500/20 rounded-md text-xs transition-colors text-zinc-200 whitespace-nowrap">
            <NotePencil weight="bold" className="w-3.5 h-3.5 text-yellow-500" /> Note
          </button>
        </div>
      ) : (
        <div className="flex items-center p-1 gap-1">
          <div className="relative flex-1">
            <input 
              ref={inputRef} 
              value={query} 
              onChange={(e) => setQuery(e.target.value)} 
              onKeyDown={handleKeyDown} 
              placeholder={isBroken ? "Describe what you see..." : isSingleWord ? "Define..." : "Ask about this..."} 
              className="w-full bg-[#252525] border-none rounded px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none" 
            />
          </div>
          <button 
            onClick={() => { 
              if (query.trim()) { 
                if (isBroken) {
                  onAskAI?.(`[Broken PDF encoding detected: "${selectedText}"] ${query}`, selectedText);
                } else {
                  onAskAI?.(query, selectedText);
                }
                renderProps.cancel(); 
              } 
            }} 
            className="p-1.5 bg-primary/20 hover:bg-primary/30 text-primary rounded"
          >
            <Sparkle weight="fill" className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export function PDFViewer({
  fileUrl, isDarkMode = true, initialPage = 0, onAskAI, onPageChange, onToggleTheme, onAddNote, onAddBookmark, jumpToPage, repairMap
}: PDFViewerProps) {
  const [loading, setLoading] = useState(true);
  const [currentPageIndex, setCurrentPageIndex] = useState(initialPage);

  useEffect(() => {
    setCurrentPageIndex(initialPage);
  }, [initialPage]);

  const propsRef = useRef({ isDarkMode, onAskAI, onToggleTheme, onAddNote, onAddBookmark, currentPageIndex, repairMap });
  propsRef.current = { isDarkMode, onAskAI, onToggleTheme, onAddNote, onAddBookmark, currentPageIndex, repairMap };

  const handlePageChange = (e: { currentPage: number }) => {
    setCurrentPageIndex(e.currentPage);
    onPageChange?.(e.currentPage);
  };

  const pageNavigationPluginInstance = pageNavigationPlugin();
  const highlightPluginInstance = highlightPlugin({
    renderHighlightTarget: (props: RenderHighlightTargetProps) => (
      <HighlightMenu renderProps={props} onAskAI={propsRef.current.onAskAI} onAddNote={propsRef.current.onAddNote} currentPage={propsRef.current.currentPageIndex} isDarkMode={propsRef.current.isDarkMode || false} repairMap={propsRef.current.repairMap} />
    ),
  });

  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    renderToolbar: (Toolbar: (props: ToolbarProps) => React.ReactElement) => (
      <Toolbar>
        {(slots: ToolbarSlot) => (
          <div className={cn("flex items-center justify-between w-full px-4 py-2 transition-colors duration-300", isDarkMode ? "bg-[#161616]" : "bg-white")}>
            <div className="flex items-center gap-2">
              <slots.GoToPreviousPage>{(p) => <button onClick={p.onClick} disabled={p.isDisabled} className="p-1.5 rounded hover:bg-zinc-500/10 disabled:opacity-30"><Minus className="w-4 h-4" /></button>}</slots.GoToPreviousPage>
              <div className="flex items-center gap-1 text-xs font-medium text-zinc-400"><slots.CurrentPageInput /><span className="mx-1">/</span><slots.NumberOfPages /></div>
              <slots.GoToNextPage>{(p) => <button onClick={p.onClick} disabled={p.isDisabled} className="p-1.5 rounded hover:bg-zinc-500/10 disabled:opacity-30"><Plus className="w-4 h-4" /></button>}</slots.GoToNextPage>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn("flex items-center gap-1 rounded-lg px-2 transition-colors", isDarkMode ? "bg-[#212121]" : "bg-zinc-50")}>
                <slots.ZoomOut>{(p) => <button onClick={p.onClick} className="p-1 hover:text-zinc-200 text-zinc-400"><Minus className="w-3.5 h-3.5" /></button>}</slots.ZoomOut>
                <div className={cn("text-[11px] min-w-[40px] text-center font-mono", isDarkMode ? "text-zinc-300" : "text-zinc-600")}><slots.Zoom /></div>
                <slots.ZoomIn>{(p) => <button onClick={p.onClick} className="p-1 hover:text-zinc-200 text-zinc-400"><Plus className="w-3.5 h-3.5" /></button>}</slots.ZoomIn>
              </div>
              <div className={cn("w-[1px] h-4 mx-1", isDarkMode ? "bg-[#2A2A2A]" : "bg-zinc-100")} />
              <button onClick={() => propsRef.current.onAddBookmark?.(propsRef.current.currentPageIndex)} className="p-1.5 rounded hover:bg-zinc-500/10 text-zinc-400 hover:text-yellow-500 transition-colors" title="Bookmark this page"><BookmarkSimple weight="bold" className="w-4 h-4" /></button>
              <button onClick={() => propsRef.current.onToggleTheme?.()} className="p-1.5 rounded hover:bg-zinc-500/10 text-zinc-400 hover:text-zinc-100 transition-colors" title="Toggle theme">{propsRef.current.isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button>
              <slots.EnterFullScreen>{(p) => <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-primary transition-colors" title="Full Screen"><CornersOut weight="bold" className="w-4 h-4" /></Button>}</slots.EnterFullScreen>
            </div>
          </div>
        )}
      </Toolbar>
    ),
    sidebarTabs: () => [],
  });

  useEffect(() => {
    if (jumpToPage !== undefined) pageNavigationPluginInstance.jumpToPage(jumpToPage);
  }, [jumpToPage, pageNavigationPluginInstance]);

  const plugins = [pageNavigationPluginInstance, highlightPluginInstance, defaultLayoutPluginInstance];

  return (
    <div className={cn("h-full w-full flex flex-col overflow-hidden transition-colors duration-300", isDarkMode ? "bg-[#161616] pdf-viewer-dark" : "bg-white pdf-viewer-light")}>
      <Worker workerUrl="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js">
        <div className="flex-1 h-full overflow-hidden relative">
          <Viewer fileUrl={fileUrl} plugins={plugins} defaultScale={SpecialZoomLevel.PageWidth} theme={isDarkMode ? "dark" : "light"} initialPage={initialPage} onPageChange={handlePageChange} onDocumentLoad={() => { setLoading(false); if (initialPage > 0) pageNavigationPluginInstance.jumpToPage(initialPage); }} />
          {loading && (
            <div className={cn("absolute inset-0 flex items-center justify-center z-10", isDarkMode ? "bg-[#161616]" : "bg-white")}>
              <div className="w-full max-w-md p-8 space-y-4">
                <Skeleton className={cn("h-8 w-3/4", isDarkMode ? "bg-[#212121]" : "bg-zinc-100")} />
                <Skeleton className={cn("h-4 w-full", isDarkMode ? "bg-[#212121]" : "bg-zinc-100")} />
                <Skeleton className={cn("h-[400px] w-full", isDarkMode ? "bg-[#212121]" : "bg-zinc-100")} />
              </div>
            </div>
          )}
        </div>
      </Worker>
      <style jsx global>{`
        .pdf-viewer-dark .rpv-core__viewer { background-color: #161616 !important; }
        .pdf-viewer-dark .rpv-core__inner-page { background-color: #161616 !important; box-shadow: none !important; margin: 20px auto !important; }
        .pdf-viewer-dark .rpv-core__canvas-layer { filter: invert(0.9) hue-rotate(180deg) !important; }
        .pdf-viewer-dark .rpv-core__text-layer { mix-blend-mode: plus-lighter; }
        .pdf-viewer-light .rpv-core__inner-page { box-shadow: none !important; margin: 20px auto !important; }
        .rpv-core__textbox { background-color: ${isDarkMode ? '#212121' : '#fff'} !important; border: none !important; color: ${isDarkMode ? '#EDEDED' : '#18181b'} !important; font-size: 11px !important; border-radius: 4px !important; padding: 2px 4px !important; width: 35px !important; }
        .rpv-default-layout__body { scrollbar-width: thin; scrollbar-color: ${isDarkMode ? '#2A2A2A #161616' : '#e4e4e7 #fff'}; }
      `}</style>
    </div>
  );
}