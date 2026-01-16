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
        "flex flex-col items-center justify-center p-12 rounded-2xl border-2 border-dashed",
        isDragging
          ? "border-primary bg-primary/5 scale-[1.02]"
          : "border-[#2A2A2A] bg-[#1c1c1c] hover:border-zinc-700"
      )}
    >
      <input
        type="file"
        accept="application/pdf"
        onChange={handleFileInput}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />

      <div className="w-16 h-16 rounded-full bg-[#212121] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
        <Upload className={cn(
          "w-8 h-8 transition-colors",
          isDragging ? "text-primary" : "text-zinc-500 group-hover:text-zinc-300"
        )} />
      </div>

      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold text-foreground">
          {isDragging ? "Drop your PDF here" : "Upload your document"}
        </h3>
        <p className="text-sm text-zinc-500 max-w-xs mx-auto">
          Drag and drop your PDF here, or click to browse. Everything stays on your device.
        </p>
      </div>

      <div className="mt-8 flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#212121] text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          <FileUp className="w-3 h-3" />
          Max 100MB
        </div>
      </div>
    </div>
  );
}
