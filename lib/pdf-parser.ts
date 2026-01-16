import * as pdfjs from 'pdfjs-dist';

// Set worker path for pdfjs
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export async function extractTextFromPDF(blob: Blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const chunks: { text: string; pageIndex: number }[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    
    // Chunking: For now, we take each page as a chunk. 
    // In advanced RAG, we might split by paragraph.
    if (pageText.trim()) {
      chunks.push({
        text: pageText,
        pageIndex: i - 1, // 0-based index
      });
    }
  }

  return chunks;
}
