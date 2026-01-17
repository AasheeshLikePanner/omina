"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { db, type PDFFile, type Note, addNote, addBookmark } from '@/lib/db';
import { WebLLMService, type ModelStatus, APP_MODELS } from '@/lib/webllm';
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { cn, applyRepairMap } from '@/lib/utils';
import { CaretLeft, CaretRight, Cpu, Sparkle, Notebook } from '@phosphor-icons/react';
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from 'framer-motion';

const Sidebar = dynamic(() => import('@/components/Sidebar').then(mod => mod.Sidebar), { ssr: false });
const Dropzone = dynamic(() => import('@/components/Dropzone').then(mod => mod.Dropzone), { ssr: false });
const PDFViewer = dynamic(() => import('@/components/Viewer').then(mod => mod.PDFViewer), { ssr: false });
const AIChat = dynamic(() => import('@/components/AIChat').then(mod => mod.AIChat), { ssr: false });
const NotesPanel = dynamic(() => import('@/components/NotesPanel').then(mod => mod.NotesPanel), { ssr: false });

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pdfIdParam = searchParams.get('id');

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
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasShownReadyToast = useRef(false);
  const isModelLoadedRef = useRef(false); // Track live status for async functions

  // Sync ref with state
  useEffect(() => {
    isModelLoadedRef.current = modelStatus.isLoaded;
  }, [modelStatus.isLoaded]);

  useEffect(() => {
    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.types.includes('Files')) {
        setIsWindowDragging(true);
        if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current);
        dragTimeoutRef.current = setTimeout(() => setIsWindowDragging(false), 150);
      }
    };

    const handleWindowDrop = () => {
      setIsWindowDragging(false);
      if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current);
    };

    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);
    window.addEventListener('dragend', handleWindowDrop);

    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
      window.removeEventListener('dragend', handleWindowDrop);
      if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSidebarCollapsed(prev => !prev);
      }
      if (modifier && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setShowChat(prev => !prev);
      }
      if (modifier && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setShowNotesPanel(prev => !prev);
      }
      if (modifier && e.key === '/') {
        e.preventDefault();
        if (!showChat) setShowChat(true);
        window.dispatchEvent(new CustomEvent('focus-ai-chat'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showChat]);

  const handleSelectPDF = useCallback(async (pdfOrId: PDFFile | number, updateUrl = true) => {
    let id = typeof pdfOrId === 'number' ? pdfOrId : pdfOrId.id;
    if (!id) return;

    const freshPdf = await db.pdfs.get(id);
    if (!freshPdf) return;

    if (updateUrl) router.push(`/?id=${id}`);

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

    setShowNotesPanel(!!freshPdf.isNotesOpen);
    setShowChat(!!freshPdf.isChatOpen);

    const runProcessing = async () => {
      let chunks: { text: string; pageIndex: number }[] = [];
      try {
        if (ragEnabled || (!freshPdf.repairMap && freshPdf.discoveryStatus !== 'learning')) {
          setIsIndexing(true);
          const { extractTextFromPDF } = await import('@/lib/pdf-parser');
          chunks = await extractTextFromPDF(freshPdf.blob);
        }

        if (ragEnabled && chunks.length > 0) {
          const { ragEngine } = await import('@/lib/rag');
          await ragEngine.indexPDF(id, chunks.map(c => ({ ...c, pdfId: id })));
          toast.success("Document Analyzed");
        }

        // Logic fix: If status is 'learning', it means previous attempt died. Reset it.
        if (freshPdf.discoveryStatus === 'learning') {
          await db.pdfs.update(id, { discoveryStatus: 'idle' });
          freshPdf.discoveryStatus = 'idle';
        }

        if (!freshPdf.repairMap && freshPdf.discoveryStatus !== 'complete' && chunks.length > 0) {
          (async () => {
            try {
              await db.pdfs.update(id!, { discoveryStatus: 'learning' });

              if (!llmRef.current || !isModelLoadedRef.current) {
                for (let i = 0; i < 30; i++) {
                  if (llmRef.current && isModelLoadedRef.current) break;
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
                if (!llmRef.current || !isModelLoadedRef.current) {
                  await db.pdfs.update(id!, { discoveryStatus: 'failed' });
                  return;
                }
              }

              const { getSmartSamples, buildStatisticalRepairMap } = await import('@/lib/repair-engine');
              const samples = await getSmartSamples(chunks);

              const { map: safeMap, unmapped } = buildStatisticalRepairMap(samples);
              let finalMap = { ...safeMap };

              if (unmapped.length > 0) {
                const prompt = `Fix these corrupted characters found in the text.
Unknown characters: ${unmapped.join(', ')}

Context samples:
${samples[0]?.slice(0, 300)}
...
${samples[1]?.slice(0, 300)}

Return ONLY a JSON object mapping the corrupted character to the correct character.
Example: {"Ä": "A", "ƒ": "ā"}`;

                try {
                  const response = await llmRef.current.chat([
                    { role: "system", content: "You are a PDF repair engine. Analyze the corrupted characters in context and provide the correct mapping. Return VALID JSON ONLY. No markdown." },
                    { role: "user", content: prompt }
                  ]);

                  let jsonStr = "";
                  for await (const chunk of response) {
                    jsonStr += chunk.choices[0]?.delta?.content || "";
                  }

                  const match = jsonStr.match(/\{[\s\S]*\}/);
                  if (match) {
                    const adaptiveRules = JSON.parse(match[0]);
                    finalMap = { ...finalMap, ...adaptiveRules };
                  }
                } catch (err) { }
              }

              await db.pdfs.update(id!, { repairMap: finalMap, discoveryStatus: 'complete' });
              setMessages(prev => [{ role: 'assistant', content: `**Intelligence Synchronized.** Learned ${Object.keys(finalMap).length} character repair rules.` }, ...prev]);
              setSelectedPdf(prev => prev?.id === id ? { ...prev, repairMap: finalMap, discoveryStatus: 'complete' } : prev);
            } catch (e) {
              await db.pdfs.update(id!, { discoveryStatus: 'failed' });
            }
          })();
        }
      } catch (e) {
        // Silent fail
      } finally {
        setIsIndexing(false);
      }
    };
    runProcessing();
  }, [ragEnabled, router]);

  useEffect(() => {
    if (!isMounted) return;
    const loadPdfFromParam = async () => {
      if (pdfIdParam) {
        const id = parseInt(pdfIdParam);
        if (!isNaN(id) && selectedPdf?.id !== id) {
          const pdf = await db.pdfs.get(id);
          if (pdf) handleSelectPDF(pdf, false);
        }
      } else if (selectedPdf) {
        setSelectedPdf(null);
        setPdfUrl(null);
        setSidebarCollapsed(false);
      }
    };
    loadPdfFromParam();
  }, [pdfIdParam, isMounted, handleSelectPDF, selectedPdf?.id]);

  useEffect(() => {
    setIsMounted(true);
    const savedKey = localStorage.getItem('omnia_jina_key');
    if (savedKey) setJinaKey(savedKey);

    const initRag = async () => {
      const { ragEngine } = await import('@/lib/rag');
      await ragEngine.init();
    };
    initRag();

    llmRef.current = new WebLLMService((status) => setModelStatus(status));

    const init = async () => {
      llmRef.current?.loadModel(currentModel);
    };
    init();
  }, []);

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
  }, [handleSelectPDF]);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!llmRef.current || !modelStatus.isLoaded || isStreaming) return;

    let contextParts: string[] = [];
    setIsStreaming(true);

    try {
      let searchQuery = content;
      if (webEnabled || ragEnabled) {
        setPipelineStatus("Identifying Topics");
        try {
          const queryResponse = await llmRef.current.chat([
            { role: "system", content: "Extract 2-3 search keywords. REPAIR artifacts. Respond ONLY with keywords." },
            { role: "user", content: content }
          ]);
          let fullQuery = "";
          for await (const chunk of queryResponse) fullQuery += chunk.choices[0]?.delta?.content || "";
          const cleanedQuery = fullQuery.replace(/[^a-zA-Z0-9Śāīūṛṝḷṇṣṭḍñṅś ]/g, '').trim();
          if (cleanedQuery) searchQuery = cleanedQuery;
        } catch (e) { }
      }

      const researchPromises = [];
      if (webEnabled && jinaKey) {
        researchPromises.push((async () => {
          setPipelineStatus("Web Search");
          try {
            const res = await fetch(`https://s.jina.ai/${encodeURIComponent(searchQuery)}`, {
              headers: { 'Authorization': `Bearer ${jinaKey}`, 'Accept': 'text/plain' },
              signal: AbortSignal.timeout(10000)
            });
            if (res.ok) {
              const text = await res.text();
              contextParts.push(`--- WEB RESEARCH ---\n${text.slice(0, 1000)}
---`);
            }
          } catch (e) { }
        })());
      }

      if (ragEnabled && selectedPdf?.id) {
        researchPromises.push((async () => {
          setPipelineStatus("Reading Document");
          try {
            const { ragEngine } = await import('@/lib/rag');
            const { applyRepairMap } = await import('@/lib/utils');
            const results = await ragEngine.searchContext(searchQuery, selectedPdf.id as number);
            if (results.length > 0) {
              const pdfContext = results.slice(0, 3).map(r => {
                const cleanedText = applyRepairMap(r.text, selectedPdf.repairMap);
                return `(P${r.pageIndex + 1}): ${cleanedText.slice(0, 600)}`;
              }).join('\n\n');
              contextParts.push(`--- DOCUMENT SNIPPETS ---\n${pdfContext}
---`);
            }
          } catch (e) { }
        })());
      }

      await Promise.all(researchPromises);

      setPipelineStatus("Thinking");
      setMessages(prev => [...prev, { role: 'user', content }]);


      const chatMessages = [
        {
          role: "system" as const,
          content: `You are a professional AI Reconstructor. 
          1. LITERAL ACCURACY: Provide literal, factual explanations. Never interpret metaphorically.
          2. SANSKRIT DIACRITICS: Always use proper diacritics (ṣ, ṭ, ḍ, ṇ, ā, ī, ū, ś, ṛ).
          3. CLEAN OUTPUT: Deliver factual answers only. Do not discuss encoding issues.`
        },
        ...messages.slice(-2),
        { role: 'user' as const, content: contextParts.length > 0 ? `${contextParts.join('\n\n')}\n\nLATEST USER QUESTION: ${content}` : content }
      ];

      const chunks = await llmRef.current.chat(chatMessages);
      let assistantContent = "";
      setMessages(prev => [...prev, { role: 'assistant', content: "" }]);

      for await (const chunk of chunks) {
        const delta = chunk.choices[0]?.delta?.content || "";
        assistantContent += delta;
        setMessages(prev => {
          const updated = [...prev];
          if (updated.length > 0) updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
          return updated;
        });
      }
    } catch (error) {
      console.error("[DEBUG] Pipeline error:", error);
      toast.error("An error occurred during processing.");
    } finally {
      setIsStreaming(false);
      setPipelineStatus("");
    }
  }, [messages, modelStatus.isLoaded, isStreaming, ragEnabled, webEnabled, selectedPdf, aiMode, jinaKey, router, handleSelectPDF]);

  const handleAskAI = useCallback((text: string, context?: string) => {
    if (!llmRef.current || !modelStatus.isLoaded) return;
    const cleanContext = selectedPdf?.repairMap ? applyRepairMap(context || "", selectedPdf.repairMap) : context;
    handleSendMessage(cleanContext ? `Context: "${cleanContext}"\n\nQuestion: ${text}` : text);
  }, [handleSendMessage, modelStatus.isLoaded, selectedPdf]);

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
    const cleanText = selectedPdf.repairMap ? applyRepairMap(selectedText, selectedPdf.repairMap) : selectedText;
    await addNote({ pdfId: selectedPdf.id, pageIndex, content: '', selectedText: cleanText, createdAt: Date.now(), updatedAt: Date.now() });
    toast.success("Note Added");
    setNotesPanelKey(prev => prev + 1);
  }, [selectedPdf]);

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
    router.push('/');
    setSelectedPdf(null);
    setPdfUrl(null);
    setSidebarCollapsed(false);
  }, [router]);

  return (
    <main className="flex h-screen bg-[#161616] text-foreground overflow-hidden relative">
      <AnimatePresence>
        {isWindowDragging && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-[1px] z-[100] flex items-center justify-center pointer-events-none">
            <div className="text-[9px] font-bold text-white/30 uppercase tracking-[1.5em] ml-[1.5em] animate-pulse">Release to Import</div>
          </motion.div>
        )}
      </AnimatePresence>
      {isMounted ? (
        <>
          <Sidebar onSelectPDF={handleSelectPDF} selectedPdfId={selectedPdf?.id} modelStatus={modelStatus} currentModel={currentModel} onModelChange={handleModelChange} isCollapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} onImportNew={handleImportNew} showNotes={showNotesPanel} onToggleNotes={() => { const s = !showNotesPanel; setShowNotesPanel(s); if (selectedPdf?.id) db.pdfs.update(selectedPdf.id, { isNotesOpen: s }); }} showChat={showChat} onToggleChat={() => { const s = !showChat; setShowChat(s); if (selectedPdf?.id) db.pdfs.update(selectedPdf.id, { isChatOpen: s }); }} />
          <div className="flex-1 flex flex-col min-w-0 bg-[#161616] relative overflow-hidden">
            {!selectedPdf && (
              <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12">
                <div className="w-full max-w-2xl space-y-8">
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-xl shadow-white/5 shrink-0">
                      <svg width="32" height="32" viewBox="0 0 256 256" fill="black"><path d="M240,56V200a8,8,0,0,1-8,8H160a24,24,0,0,0-24,23.94,7.9,7.9,0,0,1-5.12,7.55A8,8,0,0,1,120,232a24,24,0,0,0-24-24H24a8,8,0,0,1-8-8V56a8,8,0,0,1,8-8H88a32,32,0,0,1,32,32v87.73a8.17,8.17,0,0,0,7.47,8.25,8,8,0,0,0,8.53-8V80a32,32,0,0,1,32-32h64A8,8,0,0,1,240,56Z" /></svg>
                    </div>
                    <div className="space-y-1">
                      <h1 className="text-xl font-bold tracking-[-0.02em] text-white uppercase">OMNIA</h1>
                      <div className="flex items-center gap-3"><span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em]">Knowledge Interface</span><div className="w-1 h-1 rounded-full bg-primary/40" /><span className="text-[10px] font-bold text-primary uppercase tracking-[0.3em]">v1.0.0 Stable</span></div>
                    </div>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="border border-[#2A2A2A] bg-[#1a1a1a]/50 overflow-hidden rounded-xl">
                    <div className="px-4 py-3 border-b border-[#2A2A2A] bg-white/[0.02] flex items-center justify-between">
                      <div className="flex gap-4 items-center"><div className="flex gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#2A2A2A]" /><div className="w-2.5 h-2.5 rounded-full bg-[#2A2A2A]" /><div className="w-2.5 h-2.5 rounded-full bg-[#2A2A2A]" /></div><span className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.4em]">Secure_Workspace_Initialized</span></div>
                      <div className="flex items-center gap-3"><span className="text-[9px] font-bold text-primary uppercase tracking-widest px-2 py-0.5 bg-primary/10 rounded">No Account Required</span><span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest px-2 py-0.5 bg-emerald-500/10 rounded">100% Free</span></div>
                    </div>
                    <div className="p-1"><Dropzone onFileUploaded={handleFileUploaded} /></div>
                    <div className="grid grid-cols-3 divide-x divide-[#2A2A2A] border-t border-[#2A2A2A]">
                      <div className="p-5 space-y-1.5"><span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest block">Core_Engine</span><p className="text-xs text-zinc-400 font-medium">Local-Only AI (Web-GPU)</p></div>
                      <div className="p-5 space-y-1.5"><span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest block">Data_Privacy</span><p className="text-xs text-zinc-400 font-medium">Zero-Cloud Architecture</p></div>
                      <div className="p-5 space-y-1.5"><span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest block">Authentication</span><p className="text-xs text-zinc-400 font-medium">No Signup / Peer-to-Peer</p></div>
                    </div>
                  </motion.div>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-4 p-4 rounded-xl border border-white/[0.03] bg-white/[0.01]"><div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-500"><Cpu weight="bold" size={16} /></div><div className="space-y-0.5"><div className="text-[10px] font-bold text-zinc-200 uppercase tracking-wider">Hardware Processing</div><p className="text-[10px] text-zinc-600 font-medium">Your CPU/GPU handles all AI logic.</p></div></div>
                    <div className="flex items-center gap-4 p-4 rounded-xl border border-white/[0.03] bg-white/[0.01]"><div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-500"><Sparkle weight="bold" size={16} /></div><div className="space-y-0.5"><div className="text-[10px] font-bold text-zinc-200 uppercase tracking-wider">Cloud Air-Gap</div><p className="text-[10px] text-zinc-600 font-medium">Documents stay in local storage.</p></div></div>
                  </motion.div>
                </div>
              </div>
            )}
            <div className={cn("flex-1 flex overflow-hidden", selectedPdf ? "p-0" : "hidden")}>
              <div className="flex-1 min-w-0 relative">
                {pdfUrl && selectedPdf && <PDFViewer key={selectedPdf?.id} fileUrl={pdfUrl} isDarkMode={isPdfDarkMode} initialPage={selectedPdf?.currentPage || 0} onAskAI={handleAskAI} onPageChange={handlePageChange} onToggleTheme={() => setIsPdfDarkMode(!isPdfDarkMode)} onAddNote={handleAddNote} onAddBookmark={handleAddBookmark} jumpToPage={jumpToPage} repairMap={selectedPdf.repairMap} />}
              </div>
              {selectedPdf && (showNotesPanel || showChat) && (
                <div className="flex h-full relative border-l border-[#2A2A2A]">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {showNotesPanel && <motion.div key="notes-panel" initial={{ width: 0, opacity: 0 }} animate={{ width: 380, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="h-full overflow-hidden border-r border-[#2A2A2A] shrink-0"><NotesPanel key={notesPanelKey} pdfId={selectedPdf.id!} currentPage={currentPage} onJumpToPage={handleJumpToPage} onAskAI={handleAskAI} /></motion.div>}
                    {showChat && <motion.div key="ai-chat" initial={{ width: 0, opacity: 0 }} animate={{ width: 450, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="h-full overflow-hidden bg-[#1a1a1a] shrink-0"><AIChat messages={messages} onSendMessage={handleSendMessage} onClearChat={() => setMessages([])} isStreaming={isStreaming} isModelLoaded={modelStatus.isLoaded} ragEnabled={ragEnabled} webEnabled={webEnabled} onToggleRag={setRagEnabled} onToggleWeb={setWebEnabled} isIndexing={isIndexing} aiMode={aiMode} onSetAiMode={setAiMode} jinaKey={jinaKey} onSetJinaKey={handleJinaKeyChange} status={pipelineStatus} /></motion.div>}
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

export default function Home() {
  return (
    <Suspense fallback={<div className="h-screen w-full bg-[#161616]" />}>
      <HomeContent />
    </Suspense>
  );
}
