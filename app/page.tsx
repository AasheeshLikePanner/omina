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

// Dynamic imports with ssr: false
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

  const [modelStatus, setModelStatus] = useState<ModelStatus>({
    progress: 0,
    text: "Idle",
    isLoaded: false
  });
  const [currentModel, setCurrentModel] = useState(APP_MODELS[0].id);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWindowDragging, setIsWindowDragging] = useState(false);
  const [showChat, setShowChat] = useState(true);

  const llmRef = useRef<WebLLMService | null>(null);
  const dragCounter = useRef(0);

  useEffect(() => {
    setIsMounted(true);
    llmRef.current = new WebLLMService((status) => {
      setModelStatus(status);
      if (status.isLoaded) {
        toast.success("AI Model loaded and ready!");
      }
    });

    const init = async () => {
      // Restore session
      const savedPdfId = localStorage.getItem('nexus_last_pdf_id');
      if (savedPdfId) {
        const id = parseInt(savedPdfId);
        if (!isNaN(id)) {
          const pdf = await db.pdfs.get(id);
          if (pdf) handleSelectPDF(pdf);
        }
      }
      llmRef.current?.loadModel(currentModel);
    };
    init();
  }, []);

  const handleModelChange = useCallback(async (modelId: string) => {
    setCurrentModel(modelId);
    if (llmRef.current) await llmRef.current.loadModel(modelId);
  }, []);

  const handleFileUploaded = useCallback(async (id: number) => {
    const pdf = await db.pdfs.get(id);
    if (pdf) handleSelectPDF(pdf);
  }, []);

  const handleSelectPDF = useCallback(async (pdfOrId: PDFFile | number) => {
    // If we passed an object, getting its ID. If ID, using it directly.
    // Ideally we always fetch fresh from DB to rely on persisted currentPage.
    let id: number;
    if (typeof pdfOrId === 'number') {
      id = pdfOrId;
    } else if (pdfOrId.id) {
      id = pdfOrId.id;
    } else {
      return;
    }

    const freshPdf = await db.pdfs.get(id);
    if (!freshPdf) return;

    // Save session
    localStorage.setItem('nexus_last_pdf_id', id.toString());

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
  }, []);

  // 1. Move handleSendMessage UP
  const handleSendMessage = useCallback(async (content: string) => {
    if (!llmRef.current || !modelStatus.isLoaded) return;
    const newMessages = [...messages, { role: 'user' as const, content }];
    setMessages(newMessages);
    setIsStreaming(true);
    try {
      const chatMessages = [
        { role: "system" as const, content: "You are a helpful AI assistant. Use markdown for formatting." },
        ...newMessages
      ];
      const chunks = await llmRef.current.chat(chatMessages);
      let assistantContent = "";
      setMessages([...newMessages, { role: 'assistant', content: "" }]);
      for await (const chunk of chunks) {
        assistantContent += chunk.choices[0]?.delta?.content || "";
        setMessages([...newMessages, { role: 'assistant', content: assistantContent }]);
      }
    } catch (error) {
      console.error(error);
      toast.error("AI response failed.");
    } finally {
      setIsStreaming(false);
    }
  }, [messages, modelStatus.isLoaded]);

  // 2. Define handleAskAI which uses handleSendMessage
  const handleAskAI = useCallback((text: string, context?: string) => {
    if (!llmRef.current || !modelStatus.isLoaded) return;
    const messageContent = context
      ? `Context: "${context}"\n\nQuestion: ${text}`
      : text;
    handleSendMessage(messageContent);
  }, [handleSendMessage, modelStatus.isLoaded]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    if (selectedPdf?.id) {
      db.pdfs.update(selectedPdf.id, { currentPage: page });
      setSelectedPdf(prev => prev ? { ...prev, currentPage: page } : null);
    }
  }, [selectedPdf?.id]);

  const handleJumpToPage = useCallback((page: number) => {
    setJumpToPage(page);
    setCurrentPage(page);
    setTimeout(() => setJumpToPage(undefined), 100);
  }, []);

  const handleAddNote = useCallback(async (pageIndex: number, selectedText: string) => {
    if (!selectedPdf?.id) return;
    await addNote({
      pdfId: selectedPdf.id,
      pageIndex,
      content: '',
      selectedText,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    toast.success("Note added! Edit it in the Notes panel.");
    setNotesPanelKey(prev => prev + 1);
  }, [selectedPdf?.id]);

  const handleAddBookmark = useCallback(async (pageIndex: number) => {
    if (!selectedPdf?.id) return;
    try {
      await addBookmark(selectedPdf.id, pageIndex, `Page ${pageIndex + 1}`);
      toast.success(`Bookmarked page ${pageIndex + 1}`);
      setNotesPanelKey(prev => prev + 1);
    } catch (e) {
      toast.info("Page already bookmarked");
    }
  }, [selectedPdf?.id]);

  const handleImportNew = useCallback(() => {
    setSelectedPdf(null);
    setPdfUrl(null);
    setSidebarCollapsed(false);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsWindowDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsWindowDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsWindowDragging(false);
    dragCounter.current = 0;

    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      // We can reuse processFile logic from Dropzone or just manually handle
      const pdfId = await db.pdfs.add({
        name: file.name,
        blob: file,
        type: file.type,
        size: file.size,
        lastRead: Date.now(),
        currentPage: 1
      });
      handleSelectPDF(pdfId as number);
      toast.success(`Successfully imported ${file.name}`);
    } else {
      toast.error("Please drop a valid PDF file");
    }
  }, [handleSelectPDF]);

  return (
    <main
      className="flex h-screen bg-[#161616] text-foreground overflow-hidden relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Global Drag Overlay */}
      {isWindowDragging && (
        <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm z-[100] border-4 border-dashed border-primary flex items-center justify-center pointer-events-none transition-all animate-in fade-in zoom-in duration-300">
          <div className="bg-[#1a1a1a] p-8 rounded-2xl border border-primary/30 shadow-2xl flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center animate-bounce">
              <CaretRight weight="bold" className="w-8 h-8 text-primary rotate-90" />
            </div>
            <h3 className="text-xl font-bold text-zinc-100">Drop PDF to Import</h3>
            <p className="text-sm text-zinc-500">Adding document to your workspace</p>
          </div>
        </div>
      )}
      {isMounted ? (
        <>
          <Sidebar
            onSelectPDF={handleSelectPDF}
            selectedPdfId={selectedPdf?.id}
            modelStatus={modelStatus}
            currentModel={currentModel}
            onModelChange={handleModelChange}
            isCollapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            onImportNew={handleImportNew}
            showNotes={showNotesPanel}
            onToggleNotes={() => setShowNotesPanel(!showNotesPanel)}
            showChat={showChat}
            onToggleChat={() => setShowChat(!showChat)}
          />

          <div className="flex-1 flex flex-col min-w-0 bg-[#161616]">
            {!selectedPdf && (
              <header className="h-14 border-b border-[#2A2A2A] flex items-center justify-between px-8">
                <h2 className="text-sm font-bold tracking-widest uppercase text-zinc-500">Workspace</h2>
              </header>
            )}

            <div className={cn("flex-1 flex overflow-hidden", selectedPdf ? "p-0" : "p-8")}>
              <div className="flex-1 min-w-0 relative">
                {pdfUrl && selectedPdf ? (
                  <PDFViewer
                    key={selectedPdf?.id}
                    fileUrl={pdfUrl}
                    isDarkMode={isPdfDarkMode}
                    initialPage={selectedPdf?.currentPage || 0}
                    onAskAI={handleAskAI}
                    onPageChange={handlePageChange}
                    onToggleTheme={() => setIsPdfDarkMode(!isPdfDarkMode)}
                    onAddNote={handleAddNote}
                    onAddBookmark={handleAddBookmark}
                    jumpToPage={jumpToPage}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="w-full max-w-xl">
                      <Dropzone onFileUploaded={handleFileUploaded} />
                    </div>
                  </div>
                )}
              </div>

              {selectedPdf && (showNotesPanel || showChat) && (
                <div className="flex h-full relative border-l border-[#2A2A2A]">
                  {/* Global Toggle Button for Right Sidebars when all are collapsed */}
                  {!showNotesPanel && !showChat && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setShowNotesPanel(true); setShowChat(true); }}
                      className="absolute -left-10 top-2 h-8 w-8 bg-[#1a1a1a] border border-[#2A2A2A] rounded-md z-20 hover:bg-[#222] text-zinc-500"
                      title="Show panels"
                    >
                      <CaretLeft className="w-4 h-4" />
                    </Button>
                  )}

                  <AnimatePresence mode="popLayout" initial={false}>
                    {/* Notes Panel */}
                    {showNotesPanel && (
                      <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 320, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="h-full overflow-hidden border-r border-[#2A2A2A] shrink-0"
                      >
                        <NotesPanel
                          key={notesPanelKey}
                          pdfId={selectedPdf.id!}
                          currentPage={currentPage}
                          onJumpToPage={handleJumpToPage}
                          onAskAI={handleAskAI}
                        />
                      </motion.div>
                    )}

                    {/* AI Chat */}
                    {showChat && (
                      <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 380, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="h-full overflow-hidden bg-[#1a1a1a] shrink-0"
                      >
                        <AIChat
                          messages={messages}
                          onSendMessage={handleSendMessage}
                          onClearChat={() => setMessages([])}
                          isStreaming={isStreaming}
                          isModelLoaded={modelStatus.isLoaded}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="h-screen w-full bg-[#161616]" />
      )}
      <Toaster theme="dark" position="bottom-right" />
    </main>
  );
}