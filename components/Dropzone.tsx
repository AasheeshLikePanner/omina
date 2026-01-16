"use client";

import React, { useCallback, useState } from 'react';
import { UploadSimple as Upload, FileArrowUp as FileUp, X } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { db } from '@/lib/db';

interface DropzoneProps {
  onFileUploaded: (pdfId: number) => void;
}

export function Dropzone({ onFileUploaded }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file');
      return;
    }

    const pdfId = await db.pdfs.add({
      name: file.name,
      blob: file,
      type: file.type,
      size: file.size,
      lastRead: Date.now(),
      currentPage: 1
    });

    onFileUploaded(pdfId as number);
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) await processFile(file);
  }, []);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "relative group cursor-pointer transition-all duration-300",
        "flex flex-col items-center justify-center p-16 rounded-lg border border-[#2A2A2A]",
        isDragging
          ? "border-primary bg-primary/5"
          : "bg-[#1c1c1c]/50 hover:bg-[#1c1c1c] hover:border-zinc-700"
      )}
    >
      <input
        type="file"
        accept="application/pdf"
        onChange={handleFileInput}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />

      <div className="mb-6">
        <Upload className={cn(
          "w-10 h-10 transition-colors",
          isDragging ? "text-primary" : "text-zinc-700 group-hover:text-zinc-400"
        )} />
      </div>

      <div className="text-center space-y-1">
        <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-[0.2em]">
          {isDragging ? "Drop Document" : "Import PDF"}
        </h3>
        <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
          Local Storage only
        </p>
      </div>

      <div className="mt-8">
        <div className="flex items-center gap-2 px-3 py-1 bg-black/40 text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-500 border border-white/5 rounded">
          Ready for processing
        </div>
      </div>
    </div>
  );
}
