"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { db, type Note, type Bookmark, getNotesByPdf, getBookmarksByPdf, addNote, updateNote, deleteNote, addBookmark, deleteBookmark } from '@/lib/db';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    ChatCircleDots,
    BookmarkSimple as BookmarkIcon,
    Trash,
    NotePencil,
    Check,
    X,
    FileText,
    CaretDown,
    CaretRight,
    Plus,
    Sparkle,
    Clock
} from '@phosphor-icons/react';

interface NotesPanelProps {
    pdfId: number;
    currentPage: number;
    onJumpToPage: (page: number) => void;
    onAskAI?: (text: string) => void;
}

export function NotesPanel({ pdfId, currentPage, onJumpToPage, onAskAI }: NotesPanelProps) {
    const [notes, setNotes] = useState<Note[]>([]);
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editContent, setEditContent] = useState('');
    const [newNoteContent, setNewNoteContent] = useState('');
    const [showAddNote, setShowAddNote] = useState(false);
    const [notesExpanded, setNotesExpanded] = useState(true);
    const [bookmarksExpanded, setBookmarksExpanded] = useState(true);
    const [viewNote, setViewNote] = useState<Note | null>(null);

    // Load notes and bookmarks
    const loadData = useCallback(async () => {
        if (!pdfId) return;
        const [loadedNotes, loadedBookmarks] = await Promise.all([
            getNotesByPdf(pdfId),
            getBookmarksByPdf(pdfId)
        ]);
        setNotes(loadedNotes);
        setBookmarks(loadedBookmarks);
    }, [pdfId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Add a new note
    const handleAddNote = async () => {
        if (!newNoteContent.trim()) return;
        await addNote({
            pdfId,
            pageIndex: currentPage,
            content: newNoteContent.trim(),
            createdAt: Date.now(),
            updatedAt: Date.now()
        });
        setNewNoteContent('');
        setShowAddNote(false);
        loadData();
    };

    // Update an existing note
    const handleUpdateNote = async (id: number, content: string) => {
        if (!content.trim()) return;
        await updateNote(id, content.trim());
        setEditingId(null);
        setEditContent('');
        if (viewNote?.id === id) {
            setViewNote(curr => curr ? { ...curr, content } : null);
        }
        loadData();
    };

    // Delete a note
    const handleDeleteNote = async (id: number) => {
        await deleteNote(id);
        if (viewNote?.id === id) setViewNote(null);
        loadData();
    };

    // Add a bookmark for current page
    const handleAddBookmark = async () => {
        const existingBookmark = bookmarks.find(b => b.pageIndex === currentPage);
        if (existingBookmark) return; // Already bookmarked
        await addBookmark(pdfId, currentPage, `Page ${currentPage + 1}`);
        loadData();
    };

    // Delete a bookmark
    const handleDeleteBookmark = async (id: number) => {
        await deleteBookmark(id);
        loadData();
    };

    const isCurrentPageBookmarked = bookmarks.some(b => b.pageIndex === currentPage);

    return (
        <div className="h-full flex flex-col bg-[#1a1a1a] border-l border-[#2A2A2A]">
            {/* Header */}
            <div className="p-4 border-b border-[#2A2A2A] flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-200">Notes & Bookmarks</h3>
                <div className="flex gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleAddBookmark}
                        disabled={isCurrentPageBookmarked}
                        className={cn(
                            "h-7 w-7 p-0",
                            isCurrentPageBookmarked ? "text-yellow-500" : "text-zinc-400 hover:text-yellow-500"
                        )}
                        title={isCurrentPageBookmarked ? "Page bookmarked" : "Bookmark this page"}
                    >
                        <BookmarkIcon className="w-4 h-4" fill={isCurrentPageBookmarked ? "currentColor" : "none"} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAddNote(true)}
                        className="h-7 w-7 p-0 text-zinc-400 hover:text-primary"
                        title="Add note for this page"
                    >
                        <ChatCircleDots weight="bold" className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                    {/* Add Note Area */}
                    {!showAddNote ? (
                        <button
                            onClick={() => setShowAddNote(true)}
                            className="w-full py-3 px-4 rounded-xl bg-[#1c1c1c] border border-zinc-800 text-zinc-500 text-sm flex items-center gap-3 hover:border-primary/50 hover:text-zinc-300 transition-all group"
                        >
                            <NotePencil weight="bold" className="w-4 h-4 text-primary" />
                            <span>Add a note here...</span>
                            <Plus className="ml-auto w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                    ) : (
                        <div className="bg-[#1c1c1c] rounded-xl p-4 border border-zinc-800 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">New Note</span>
                                <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 bg-black/40 px-2 py-0.5 rounded-full border border-white/5">
                                    <FileText weight="bold" size={10} />
                                    PAGE {currentPage + 1}
                                </div>
                            </div>
                            <Textarea
                                value={newNoteContent}
                                onChange={(e) => setNewNoteContent(e.target.value)}
                                placeholder="Thoughts on this page..."
                                className="min-h-[100px] bg-black/20 border-none text-sm resize-none mb-4 focus-visible:ring-0 placeholder:text-zinc-700"
                                autoFocus
                            />
                            <div className="flex gap-2 justify-end">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setShowAddNote(false); setNewNoteContent(''); }}
                                    className="h-8 text-xs font-semibold hover:bg-zinc-800"
                                >
                                    Discard
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleAddNote}
                                    disabled={!newNoteContent.trim()}
                                    className="h-8 text-xs font-bold"
                                >
                                    Save Note
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Bookmarks Section */}
                    <div>
                        <button
                            onClick={() => setBookmarksExpanded(!bookmarksExpanded)}
                            className="flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 w-full mb-2 uppercase tracking-wider"
                        >
                            {bookmarksExpanded ? <CaretDown weight="bold" className="w-3 h-3" /> : <CaretRight weight="bold" className="w-3 h-3" />}
                            <BookmarkIcon weight="bold" className="w-3.5 h-3.5" />
                            Bookmarks ({bookmarks.length})
                        </button>
                        {bookmarksExpanded && (
                            <div className="space-y-1 pl-2">
                                {bookmarks.length === 0 ? (
                                    <p className="text-xs text-zinc-600 pl-4 py-2 italic">No bookmarks yet</p>
                                ) : (
                                    bookmarks.map((bookmark) => (
                                        <div
                                            key={bookmark.id}
                                            className={cn(
                                                "flex items-center justify-between p-2 rounded-md cursor-pointer group transition-all",
                                                bookmark.pageIndex === currentPage
                                                    ? "bg-primary/10 text-primary border border-primary/20"
                                                    : "hover:bg-[#212121] text-zinc-300 border border-transparent"
                                            )}
                                            onClick={() => onJumpToPage(bookmark.pageIndex)}
                                        >
                                            <span className="text-xs font-medium">{bookmark.title}</span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteBookmark(bookmark.id!); }}
                                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
                                            >
                                                <Trash weight="bold" className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    {/* Notes Section */}
                    <div>
                        <button
                            onClick={() => setNotesExpanded(!notesExpanded)}
                            className="flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-zinc-200 w-full mb-2 uppercase tracking-widest"
                        >
                            {notesExpanded ? <CaretDown weight="bold" className="w-3 h-3" /> : <CaretRight weight="bold" className="w-3 h-3" />}
                            <ChatCircleDots weight="bold" className="w-3.5 h-3.5" />
                            Notes ({notes.length})
                        </button>
                        {notesExpanded && (
                            <div className="space-y-2 pl-2">
                                {notes.length === 0 ? (
                                    <p className="text-xs text-zinc-600 pl-4 py-2 italic">No notes created yet</p>
                                ) : (
                                    notes.map((note) => (
                                        <div
                                            key={note.id}
                                            onClick={() => setViewNote(note)}
                                            className={cn(
                                                "bg-[#1c1c1c] rounded-xl p-4 border transition-all cursor-pointer hover:bg-[#222] hover:border-zinc-700 group relative",
                                                note.pageIndex === currentPage
                                                    ? "border-primary/20 bg-primary/5"
                                                    : "border-transparent"
                                            )}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onJumpToPage(note.pageIndex); }}
                                                        className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 hover:text-primary transition-colors bg-black/40 px-2 py-0.5 rounded-full border border-white/5"
                                                    >
                                                        PAGE {note.pageIndex + 1}
                                                    </button>
                                                    <div className="flex items-center gap-1 text-[10px] text-zinc-600">
                                                        <Clock size={10} />
                                                        {new Date(note.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                    </div>
                                                </div>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const query = `Regarding the note from page ${note.pageIndex + 1}: "${note.content}"\n\nContext from PDF: "${note.selectedText || 'None'}"\n\nCan you explain or help me with this?`;
                                                            onAskAI?.(query);
                                                        }}
                                                        className="p-1.5 text-zinc-500 hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                                                        title="Ask AI about this note"
                                                    >
                                                        <Sparkle weight="fill" className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setViewNote(note); }}
                                                        className="p-1.5 text-zinc-500 hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                                                    >
                                                        <NotePencil weight="bold" className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id!); }}
                                                        className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                                                    >
                                                        <Trash weight="bold" className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>

                                            {note.selectedText && (
                                                <div className="text-[11px] text-zinc-500 italic mb-3 pl-3 border-l-2 border-primary/30 py-1 line-clamp-2 bg-white/5 rounded-r-md mr-1">
                                                    "{note.selectedText}"
                                                </div>
                                            )}

                                            <p className="text-sm text-zinc-200 line-clamp-4 leading-relaxed font-medium">{note.content}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </ScrollArea>

            {/* Note View/Edit Dialog */}
            <Dialog open={!!viewNote} onOpenChange={(open) => !open && setViewNote(null)}>
                <DialogContent className="bg-[#1c1c1c] border-[#2A2A2A] text-zinc-100 sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center justify-between">
                            <span className="text-base font-semibold">Note Details</span>
                            {viewNote && (
                                <span className="text-[10px] font-bold text-zinc-500 font-mono px-2 py-1 bg-[#252525] rounded uppercase tracking-wider">
                                    PAGE {viewNote.pageIndex + 1}
                                </span>
                            )}
                        </DialogTitle>
                    </DialogHeader>

                    {viewNote && (
                        <div className="space-y-4 pt-2">
                            {viewNote.selectedText && (
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
                                        <FileText weight="bold" className="w-3 h-3" />
                                        Context
                                    </div>
                                    <div className="bg-[#111] p-3 rounded-xl border border-zinc-800/50 max-h-[150px] overflow-y-auto custom-scrollbar group hover:border-zinc-700 transition-colors">
                                        <p className="text-sm text-zinc-300 italic leading-relaxed border-l-2 border-primary/20 pl-3 py-1">
                                            "{viewNote.selectedText}"
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-xs text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-2 pl-1">
                                    <NotePencil className="w-3 h-3" /> Your Note
                                </label>
                                <Textarea
                                    defaultValue={viewNote.content}
                                    className="min-h-[200px] bg-transparent border-none focus-visible:ring-0 text-base p-0 text-zinc-200 resize-none leading-relaxed"
                                    placeholder="Empty note..."
                                    onChange={(e) => setEditContent(e.target.value)}
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <Button
                                    variant="ghost"
                                    onClick={() => setViewNote(null)}
                                    className="text-zinc-400 hover:text-zinc-200"
                                >
                                    Close
                                </Button>
                                <Button
                                    onClick={() => {
                                        if (editContent) {
                                            handleUpdateNote(viewNote.id!, editContent);
                                            setViewNote(null);
                                        }
                                    }}
                                >
                                    Save Changes
                                </Button>
                            </div>

                            <div className="border-t border-[#2A2A2A] pt-4 mt-2 flex justify-between items-center gap-2">
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-red-900/30 text-red-500 hover:bg-red-950/30 hover:text-red-400 h-8 px-2"
                                        onClick={() => {
                                            handleDeleteNote(viewNote.id!);
                                            setViewNote(null);
                                        }}
                                    >
                                        <Trash weight="bold" className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="h-8 px-3 text-[11px] font-bold"
                                        onClick={() => {
                                            onJumpToPage(viewNote.pageIndex);
                                            setViewNote(null);
                                        }}
                                    >
                                        Jump to Page
                                    </Button>
                                </div>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-3 text-[11px] border-primary/30 text-primary hover:bg-primary/10 font-bold gap-2 flex"
                                    onClick={() => {
                                        const query = `Regarding the note from page ${viewNote.pageIndex + 1}: "${viewNote.content}"\n\nContext from PDF: "${viewNote.selectedText || 'None'}"\n\nCan you explain or help me with this?`;
                                        onAskAI?.(query);
                                        setViewNote(null);
                                    }}
                                >
                                    <Sparkle weight="fill" className="w-3.5 h-3.5" />
                                    Ask AI
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div >
    );
}
