"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { db, type PDFFile, type Note, addNote, addBookmark } from '@/lib/db';
import { WebLLMService, type ModelStatus, APP_MODELS } from '@/lib/webllm';
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { cn } from '@/lib/utils';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from 'framer-motion';

const Sidebar = dynamic(() => import('@/components/Sidebar').then(mod => mod.Sidebar), { ssr: false });
const Dropzone = dynamic(() => import('@/components/Dropzone').then(mod => mod.Dropzone), { ssr: false });
const PDFViewer = dynamic(() => import('@/components/Viewer').then(mod => mod.PDFViewer), { ssr: false });
const AIChat = dynamic(() => import('@/components/AIChat').then(mod => mod.AIChat), { ssr: false });
const NotesPanel = dynamic(() => import('@/components/NotesPanel').then(mod => mod.NotesPanel), { ssr: false });

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState<PDFFile | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isPdfDarkMode, setIsPdfDarkMode] = useState(true);
  const [showNotesPanel, setShowNotesPanel] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [jumpToPage, setJumpToPage] = useState<number | undefined>();
  const [notesPanelKey, setNotesPanelKey] = useState(0);

  const [modelStatus, setModelStatus] = useState<ModelStatus>({ progress: 0, text: "Idle", isLoaded: false });
  const [currentModel, setCurrentModel] = useState(APP_MODELS[0].id);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWindowDragging, setIsWindowDragging] = useState(false);
  const [showChat, setShowChat] = useState(true);
  
  const [ragEnabled, setRagEnabled] = useState(true);
  const [webEnabled, setWebEnabled] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [aiMode, setAiMode] = useState<'general' | 'science' | 'history' | 'scriptural'>('general');
  const [jinaKey, setJinaKey] = useState('');
  const [pipelineStatus, setPipelineStatus] = useState("");

  const llmRef = useRef<WebLLMService | null>(null);
  const dragCounter = useRef(0);
  const hasShownReadyToast = useRef(false);

  useEffect(() => {
    setIsMounted(true);
    const savedKey = localStorage.getItem('omnia_jina_key');
    if (savedKey) setJinaKey(savedKey);

    const initRag = async () => {
      const { ragEngine } = await import('@/lib/rag');
      await ragEngine.init();
    };
    initRag();

    llmRef.current = new WebLLMService((status) => {
      setModelStatus(status);
    });

    const init = async () => {
          const savedPdfId = localStorage.getItem('omnia_last_pdf_id');
          if (savedPdfId) {
            const id = parseInt(savedPdfId);
            if (!isNaN(id)) {
              const pdf = await db.pdfs.get(id);
              if (pdf) handleSelectPDF(pdf);
            }
          }      llmRef.current?.loadModel(currentModel);
    };
    init();
  }, []);

  // Separate effect for the ready toast to ensure it only fires once
  useEffect(() => {
    if (modelStatus.isLoaded && !hasShownReadyToast.current) {
      toast.success("AI Engine Ready");
      hasShownReadyToast.current = true;
    }
  }, [modelStatus.isLoaded]);

  const handleJinaKeyChange = (key: string) => {
    setJinaKey(key);
    localStorage.setItem('omnia_jina_key', key);
  };

  const handleModelChange = useCallback(async (modelId: string) => {
    setCurrentModel(modelId);
    if (llmRef.current) await llmRef.current.loadModel(modelId);
  }, []);

  const handleFileUploaded = useCallback(async (id: number) => {
    const pdf = await db.pdfs.get(id);
    if (pdf) handleSelectPDF(pdf);
  }, []);

  const handleSelectPDF = useCallback(async (pdfOrId: PDFFile | number) => {
    let id = typeof pdfOrId === 'number' ? pdfOrId : pdfOrId.id;
    if (!id) return;

    const freshPdf = await db.pdfs.get(id);
    if (!freshPdf) return;

    localStorage.setItem('omnia_last_pdf_id', id.toString());
    setSelectedPdf(freshPdf);
    setCurrentPage(freshPdf.currentPage || 0);
    setPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(freshPdf.blob);
    });

    db.pdfs.update(freshPdf.id!, { lastRead: Date.now() });
    setMessages([]);
    setSidebarCollapsed(true);
    setNotesPanelKey(prev => prev + 1);

    if (ragEnabled) {
      setIsIndexing(true);
      try {
        const { extractTextFromPDF } = await import('@/lib/pdf-parser');
        const { ragEngine } = await import('@/lib/rag');
        const chunks = await extractTextFromPDF(freshPdf.blob);
        await ragEngine.indexPDF(id, chunks.map(c => ({ ...c, pdfId: id })));
        toast.success("Document Analyzed");
      } catch (e) {
        console.error("Indexing failed", e);
      } finally {
        setIsIndexing(false);
      }
    }
  }, [ragEnabled]);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!llmRef.current || !modelStatus.isLoaded) return; 
    
    let contextParts: string[] = [];
    setIsStreaming(true);
    
    try {
      // 1. ADAPTIVE KEYWORD EXTRACTION
      let searchQuery = content;
      if (webEnabled || ragEnabled) {
        setPipelineStatus("Identifying Topics");
        try {
          const queryResponse = await llmRef.current.chat([
            { role: "system", content: "Extract 3-4 specific search keywords. If the user asks for a summary or 'best things', output 'summary overview key themes'. Respond ONLY with keywords." },
            { role: "user", content: content }
          ]);
          let fullQuery = "";
          for await (const chunk of queryResponse) {
            fullQuery += chunk.choices[0]?.delta?.content || "";
          }
          const cleanedQuery = fullQuery.replace(/[^a-zA-Z0-9 ]/g, '').trim();
          if (cleanedQuery) searchQuery = cleanedQuery;
          console.log("[PIPELINE] Keywords:", searchQuery);
        } catch (e) {}
      }

      // 2. PARALLEL FETCH
      const researchPromises = [];
      if (webEnabled && jinaKey) {
        researchPromises.push((async () => {
          setPipelineStatus("Web Search");
          try {
            const res = await fetch(`https://s.jina.ai/${encodeURIComponent(searchQuery)}`, {
              headers: { 'Authorization': `Bearer ${jinaKey}`, 'Accept': 'text/plain' },
              signal: AbortSignal.timeout(12000)
            });
            if (res.ok) {
              const text = await res.text();
              contextParts.push(`--- WEB RESEARCH ---
${text.slice(0, 1500)}
---`);
            }
          } catch (e) {}
        })());
      }

      if (ragEnabled && selectedPdf?.id) {
        researchPromises.push((async () => {
          setPipelineStatus("Reading Document");
          try {
            const { ragEngine } = await import('@/lib/rag');
            const results = await ragEngine.searchContext(searchQuery, selectedPdf.id);
            if (results.length > 0) {
              const pdfContext = results.slice(0, 5).map(r => `(P${r.pageIndex + 1}): ${r.text.slice(0, 800)}`).join('\n\n');
              contextParts.push(`--- DOCUMENT SNIPPETS ---
${pdfContext}
---`);
            }
          } catch (e) {}
        })());
      }

      await Promise.all(researchPromises);

      // 3. FINAL SYNTHESIS
      setPipelineStatus("Thinking");
      const newMessages = [...messages, { role: 'user' as const, content }];
      setMessages(newMessages);

            const chatMessages = [
              { 
                role: "system" as const, 
                content: `You are an insightful AI Assistant. Use Markdown to format your response for high readability.
                
                COLOR FORMATTING RULES:
                1. CITATIONS: Use **[Page X]** for document sources and **[Web]** for internet sources.
                2. CHAPTERS: If you find a chapter name in the snippets, format it as **Chapter: Name**.
                3. KEY TERMS: Use **bold text** for important names or concepts.
                
                ANSWERING RULES:
                1. Use provided context (Web/Document). 
                2. If fragments are from different pages, connect them logically.
                3. Be descriptive. For Radha/Krishna topics, focus on the narrative flow.`
              },
              ...messages.slice(-4),
              { role: 'user' as const, content: contextParts.length > 0 ? `${contextParts.join('\n\n')}\n\nUser Question: ${content}` : content }
            ];
            const chunks = await llmRef.current.chat(chatMessages);
      let assistantContent = "";
      setMessages([...newMessages, { role: 'assistant', content: "" }]);
      
      for await (const chunk of chunks) {
        assistantContent += chunk.choices[0]?.delta?.content || "";
        setMessages([...newMessages, { role: 'assistant', content: assistantContent }]);
      }
    } catch (error) {
      toast.error("An error occurred during processing.");
    } finally {
      setIsStreaming(false);
      setPipelineStatus("");
    }
  }, [messages, modelStatus.isLoaded, ragEnabled, webEnabled, selectedPdf?.id, aiMode, jinaKey]);

  const handleAskAI = useCallback((text: string, context?: string) => {
    if (!llmRef.current || !modelStatus.isLoaded) return;
    handleSendMessage(context ? `Context: "${context}"

Question: ${text}` : text);
  }, [handleSendMessage, modelStatus.isLoaded]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    if (selectedPdf?.id) db.pdfs.update(selectedPdf.id, { currentPage: page });
  }, [selectedPdf?.id]);

  const handleJumpToPage = useCallback((page: number) => {
    setJumpToPage(page);
    setCurrentPage(page);
    setTimeout(() => setJumpToPage(undefined), 100);
  }, []);

  const handleAddNote = useCallback(async (pageIndex: number, selectedText: string) => {
    if (!selectedPdf?.id) return;
    await addNote({ pdfId: selectedPdf.id, pageIndex, content: '', selectedText, createdAt: Date.now(), updatedAt: Date.now() });
    toast.success("Note Added");
    setNotesPanelKey(prev => prev + 1);
  }, [selectedPdf?.id]);

  const handleAddBookmark = useCallback(async (pageIndex: number) => {
    if (!selectedPdf?.id) return;
    try {
      await addBookmark(selectedPdf.id, pageIndex, `Page ${pageIndex + 1}`);
      toast.success(`Bookmarked P${pageIndex + 1}`);
      setNotesPanelKey(prev => prev + 1);
    } catch (e) {
      toast.info("Already Bookmarked");
    }
  }, [selectedPdf?.id]);

  const handleImportNew = useCallback(() => {
    setSelectedPdf(null);
    setPdfUrl(null);
    setSidebarCollapsed(false);
  }, []);

  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); dragCounter.current++; if (e.dataTransfer.items.length > 0) setIsWindowDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); dragCounter.current--; if (dragCounter.current === 0) setIsWindowDragging(false); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = useCallback(async (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsWindowDragging(false); dragCounter.current = 0; const file = e.dataTransfer.files[0]; if (file && file.type === 'application/pdf') { const pdfId = await db.pdfs.add({ name: file.name, blob: file, type: file.type, size: file.size, lastRead: Date.now(), currentPage: 1 }); handleSelectPDF(pdfId as number); toast.success(`Imported ${file.name}`); } }, [handleSelectPDF]);

  return (
    <main className="flex h-screen bg-[#161616] text-foreground overflow-hidden relative" onDragEnter={handleDragEnter} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      {isWindowDragging && <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm z-[100] border-4 border-dashed border-primary flex items-center justify-center pointer-events-none transition-all animate-in fade-in zoom-in duration-300"><div className="bg-[#1a1a1a] p-8 rounded-2xl border border-primary/30 shadow-2xl flex flex-col items-center gap-4 text-center"><CaretRight weight="bold" className="w-12 h-12 text-primary rotate-90 animate-bounce" /><h3 className="text-xl font-bold text-zinc-100">Drop PDF to Import</h3></div></div>}
      {isMounted ? (
        <>
          <Sidebar onSelectPDF={handleSelectPDF} selectedPdfId={selectedPdf?.id} modelStatus={modelStatus} currentModel={currentModel} onModelChange={handleModelChange} isCollapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} onImportNew={handleImportNew} showNotes={showNotesPanel} onToggleNotes={() => setShowNotesPanel(!showNotesPanel)} showChat={showChat} onToggleChat={() => setShowChat(!showChat)} />
          <div className="flex-1 flex flex-col min-w-0 bg-[#161616]">
            {!selectedPdf && <header className="h-14 border-b border-[#2A2A2A] flex items-center px-8"><h2 className="text-sm font-bold tracking-widest uppercase text-zinc-500">Workspace</h2></header>}
            <div className={cn("flex-1 flex overflow-hidden", selectedPdf ? "p-0" : "p-8")}>
              <div className="flex-1 min-w-0 relative">{pdfUrl && selectedPdf ? <PDFViewer key={selectedPdf?.id} fileUrl={pdfUrl} isDarkMode={isPdfDarkMode} initialPage={selectedPdf?.currentPage || 0} onAskAI={handleAskAI} onPageChange={handlePageChange} onToggleTheme={() => setIsPdfDarkMode(!isPdfDarkMode)} onAddNote={handleAddNote} onAddBookmark={handleAddBookmark} jumpToPage={jumpToPage} /> : <div className="h-full flex items-center justify-center"><div className="w-full max-w-xl"><Dropzone onFileUploaded={handleFileUploaded} /></div></div>}</div>
              {selectedPdf && (showNotesPanel || showChat) && (
                <div className="flex h-full relative border-l border-[#2A2A2A]">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {showNotesPanel && <motion.div key="notes-panel" initial={{ width: 0, opacity: 0 }} animate={{ width: 320, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="h-full overflow-hidden border-r border-[#2A2A2A] shrink-0"><NotesPanel key={notesPanelKey} pdfId={selectedPdf.id!} currentPage={currentPage} onJumpToPage={handleJumpToPage} onAskAI={handleAskAI} /></motion.div>}
                    {showChat && <motion.div key="ai-chat" initial={{ width: 0, opacity: 0 }} animate={{ width: 380, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="h-full overflow-hidden bg-[#1a1a1a] shrink-0"><AIChat messages={messages} onSendMessage={handleSendMessage} onClearChat={() => setMessages([])} isStreaming={isStreaming} isModelLoaded={modelStatus.isLoaded} ragEnabled={ragEnabled} webEnabled={webEnabled} onToggleRag={setRagEnabled} onToggleWeb={setWebEnabled} isIndexing={isIndexing} aiMode={aiMode} onSetAiMode={setAiMode} jinaKey={jinaKey} onSetJinaKey={handleJinaKeyChange} status={pipelineStatus} /></motion.div>}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </>
      ) : <div className="h-screen w-full bg-[#161616]" />}
      <Toaster theme="dark" position="bottom-right" />
    </main>
  );
}
