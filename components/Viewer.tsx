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
  MagnifyingGlass
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button'; // Assuming Button is imported from here

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
}

interface HighlightMenuProps {
  renderProps: RenderHighlightTargetProps;
  onAskAI?: (text: string, context: string) => void;
  onAddNote?: (pageIndex: number, selectedText: string) => void;
  currentPage: number;
  isDarkMode: boolean;
}

// Mapping table for custom PDF font encodings (common in Sanskrit/Vedic texts)
// These PDFs use extended ASCII/Windows-1252 positions for diacritical marks
const SANSKRIT_CHAR_MAP: Record<string, string> = {
  // Vowels with macron (long vowels)
  'ƒ': 'ā', 'Ž': 'ā',
  'Œ': 'ī', '¡': 'ī',
  '—': 'ū', '˜': 'ū',
  // Vowels with dot below (vocalic r/l)
  '‚': 'ṛ', '„': 'ṛ',
  '…': 'ṝ',
  '£': 'ḷ',
  // Consonants with dot below
  '†': 'ṇ', '‡': 'ṇ',
  '‰': 'ṣ', 'š': 'ṣ',
  '™': 'ṭ',
  'œ': 'ḍ',
  // Consonants with tilde/other marks  
  'ˆ': 'ñ', '¤': 'ñ',
  '§': 'ṅ',
  'ç': 'ś', '›': 'ś',
  // Special quotes and punctuation from PDFs
  'Ð': '"', 'Ñ': '"',
  'Ò': '"', 'Ó': '"',
  'Ô': "'", 'Õ': "'",
  '–': '–', // en-dash
  // Capital letters with diacritics
  'r': 'Ś', // Often 'r' at start becomes Ś in these fonts
};

// Helper to clean up PDF text encoding issues using the mapping table
const cleanText = (text: string) => {
  let result = text;

  // Apply Sanskrit character mappings
  for (const [bad, good] of Object.entries(SANSKRIT_CHAR_MAP)) {
    result = result.split(bad).join(good);
  }

  // Handle common prefix issues (Ś often missing or replaced)
  result = result
    // Fix "rŒmatŒ" -> "Śrīmatī" pattern
    .replace(/\brŒmatŒ\b/gi, 'Śrīmatī')
    .replace(/\brŒla\b/gi, 'Śrīla')
    // Normalize to handle any remaining composed characters
    .normalize('NFC')
    // Remove remaining control characters
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Fix common ligatures
    .replace(/ﬀ/g, "ff")
    .replace(/ﬁ/g, "fi")
    .replace(/ﬂ/g, "fl")
    .replace(/ﬃ/g, "ffi")
    .replace(/ﬄ/g, "ffl")
    .replace(/¬/g, "")
    .trim();

  return result;
};


const HighlightMenu = ({ renderProps, onAskAI, onAddNote, currentPage, isDarkMode }: HighlightMenuProps) => {
  const [mode, setMode] = useState<'menu' | 'ask'>('menu');
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedText = cleanText(renderProps.selectedText);

  useEffect(() => {
    if (mode === 'ask') {
      inputRef.current?.focus();
    }
  }, [mode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (query.trim()) {
        onAskAI?.(query, selectedText);
        renderProps.cancel();
      }
    }
    if (e.key === 'Escape') {
      setMode('menu');
    }
  };

  const isSingleWord = selectedText.trim().split(/\s+/).length === 1;

  return (
    <div
      style={{
        background: isDarkMode ? '#1c1c1c' : '#fff',
        border: `1px solid ${isDarkMode ? '#2A2A2A' : '#e4e4e7'}`,
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
        minWidth: mode === 'ask' ? '240px' : 'auto'
      }}
      className="animate-in fade-in zoom-in-95 duration-100"
    >
      {mode === 'menu' ? (
        <div className="flex gap-1">
          <button
            onClick={() => setMode('ask')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-zinc-500/20 rounded-md text-xs transition-colors text-zinc-200 whitespace-nowrap"
          >
            <Sparkle weight="fill" className="w-4 h-4 text-primary" /> Ask AI
          </button>

          {/* Smart Actions */}
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
          <button
            onClick={() => {
              onAddNote?.(currentPage, selectedText);
              renderProps.cancel();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-zinc-500/20 rounded-md text-xs transition-colors text-zinc-200 whitespace-nowrap"
          >
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
              placeholder={isSingleWord ? "Define..." : "Ask about this..."}
              className="w-full bg-[#252525] border border-[#333] rounded px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-primary/50"
            />
          </div>
          <button
            onClick={() => {
              if (query.trim()) {
                onAskAI?.(query, selectedText);
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
  fileUrl, isDarkMode = true, initialPage = 0, onAskAI, onPageChange, onToggleTheme, onAddNote, onAddBookmark, jumpToPage
}: PDFViewerProps) {
  const [loading, setLoading] = useState(true);
  const [currentPageIndex, setCurrentPageIndex] = useState(initialPage);

  // Update internal page state when initialPage changes (e.g. from parent re-fetch)
  useEffect(() => {
    setCurrentPageIndex(initialPage);
  }, [initialPage]);

  // Create stable refs for dynamic values - these are read inside callbacks
  const propsRef = useRef({ isDarkMode, onAskAI, onToggleTheme, onAddNote, onAddBookmark, currentPageIndex });
  propsRef.current = { isDarkMode, onAskAI, onToggleTheme, onAddNote, onAddBookmark, currentPageIndex };

  // Handle page changes
  const handlePageChange = (e: { currentPage: number }) => {
    setCurrentPageIndex(e.currentPage);
    onPageChange?.(e.currentPage);
  };

  // Plugins must be created once
  const pageNavigationPluginInstance = pageNavigationPlugin();

  const highlightPluginInstance = highlightPlugin({
    renderHighlightTarget: (props: RenderHighlightTargetProps) => (
      <HighlightMenu
        renderProps={props}
        onAskAI={propsRef.current.onAskAI}
        onAddNote={propsRef.current.onAddNote}
        currentPage={propsRef.current.currentPageIndex}
        isDarkMode={propsRef.current.isDarkMode || false}
      />
    ),
  });

  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    renderToolbar: (Toolbar: (props: ToolbarProps) => React.ReactElement) => (
      <Toolbar>
        {(slots: ToolbarSlot) => (
          <div className="flex items-center justify-between w-full px-4 py-2 border-b bg-[#161616] border-[#2A2A2A]">
            <div className="flex items-center gap-2">
              <slots.GoToPreviousPage>{(p) => <button onClick={p.onClick} disabled={p.isDisabled} className="p-1.5 rounded hover:bg-zinc-500/10 disabled:opacity-30"><Minus className="w-4 h-4" /></button>}</slots.GoToPreviousPage>
              <div className="flex items-center gap-1 text-xs font-medium text-zinc-400"><slots.CurrentPageInput /><span className="mx-1">/</span><slots.NumberOfPages /></div>
              <slots.GoToNextPage>{(p) => <button onClick={p.onClick} disabled={p.isDisabled} className="p-1.5 rounded hover:bg-zinc-500/10 disabled:opacity-30"><Plus className="w-4 h-4" /></button>}</slots.GoToNextPage>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg px-2 bg-[#212121] border border-[#2A2A2A]">
                <slots.ZoomOut>{(p) => <button onClick={p.onClick} className="p-1 hover:text-zinc-200 text-zinc-400"><Minus className="w-3.5 h-3.5" /></button>}</slots.ZoomOut>
                <div className="text-[11px] min-w-[40px] text-center font-mono text-zinc-300"><slots.Zoom /></div>
                <slots.ZoomIn>{(p) => <button onClick={p.onClick} className="p-1 hover:text-zinc-200 text-zinc-400"><Plus className="w-3.5 h-3.5" /></button>}</slots.ZoomIn>
              </div>
              <div className="w-[1px] h-4 bg-[#2A2A2A] mx-1" />
              <button
                onClick={() => propsRef.current.onAddBookmark?.(propsRef.current.currentPageIndex)}
                className="p-1.5 rounded hover:bg-zinc-500/10 text-zinc-400 hover:text-yellow-500 transition-colors"
                title="Bookmark this page"
              >
                <BookmarkSimple weight="bold" className="w-4 h-4" />
              </button>
              <button
                onClick={() => propsRef.current.onToggleTheme?.()}
                className="p-1.5 rounded hover:bg-zinc-500/10 text-zinc-400 hover:text-zinc-100 transition-colors"
                title="Toggle theme"
              >
                {propsRef.current.isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <slots.EnterFullScreen>{(p) => <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-primary transition-colors" title="Full Screen"><CornersOut weight="bold" className="w-4 h-4" /></Button>}</slots.EnterFullScreen>
            </div>
          </div>
        )}
      </Toolbar>
    ),
    sidebarTabs: () => [],
  });

  // Handle jump to page logic using the pageNavigationPlugin instance
  useEffect(() => {
    if (jumpToPage !== undefined) {
      pageNavigationPluginInstance.jumpToPage(jumpToPage);
    }
  }, [jumpToPage, pageNavigationPluginInstance]);

  const plugins = [
    pageNavigationPluginInstance,
    highlightPluginInstance,
    defaultLayoutPluginInstance
  ];

  return (
    <div className={cn("h-full w-full flex flex-col overflow-hidden rounded-xl border transition-colors duration-300",
      isDarkMode ? "bg-[#161616] border-[#2A2A2A] pdf-viewer-dark" : "bg-zinc-50 border-zinc-200 pdf-viewer-light")}>
      <Worker workerUrl="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js">
        <div className="flex-1 h-full overflow-hidden relative">
          <Viewer
            fileUrl={fileUrl}
            plugins={plugins}
            defaultScale={SpecialZoomLevel.PageWidth}
            theme={isDarkMode ? "dark" : "light"}
            initialPage={initialPage}
            onPageChange={handlePageChange}
            onDocumentLoad={() => {
              setLoading(false);
              if (initialPage > 0) {
                pageNavigationPluginInstance.jumpToPage(initialPage);
              }
            }}
          />
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
        .pdf-viewer-dark .rpv-core__inner-page { background-color: #161616 !important; box-shadow: 0 0 20px rgba(0,0,0,0.5); margin: 20px auto !important; }
        .pdf-viewer-dark .rpv-core__canvas-layer { filter: invert(0.9) hue-rotate(180deg) !important; }
        .pdf-viewer-dark .rpv-core__text-layer { mix-blend-mode: plus-lighter; }
        .rpv-core__textbox { background-color: ${isDarkMode ? '#212121' : '#f4f4f5'} !important; border: 1px solid ${isDarkMode ? '#2A2A2A' : '#e4e4e7'} !important; color: ${isDarkMode ? '#EDEDED' : '#18181b'} !important; font-size: 11px !important; border-radius: 4px !important; padding: 2px 4px !important; width: 35px !important; }
        .rpv-default-layout__body { scrollbar-width: thin; scrollbar-color: #2A2A2A #161616; }
      `}</style>
    </div>
  );
}
