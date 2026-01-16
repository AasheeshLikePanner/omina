import { create, insert, search, type Orama } from '@orama/orama';

export interface PDFChunk {
  text: string;
  pageIndex: number;
  pdfId: number;
}

export class RAGEngine {
  private db: Orama<any> | null = null;

  async init() {
    if (this.db) return;
    try {
      this.db = await create({
        schema: {
          text: 'string',
          pageIndex: 'number',
          pdfId: 'number',
        },
      });
    } catch (e) {
      console.error("RAG Init Error:", e);
    }
  }

  async indexPDF(pdfId: number, chunks: PDFChunk[]) {
    // Re-initialize to clear old data for this session simplicity
    this.db = await create({
      schema: { text: 'string', pageIndex: 'number', pdfId: 'number' },
    });

    for (const chunk of chunks) {
      await insert(this.db, chunk);
    }
    console.log(`[RAG] Indexed ${chunks.length} pages for PDF ${pdfId}`);
  }

  async searchContext(query: string, pdfId: number) {
    if (!this.db) return [];
    
    // Safety: Orama requires a non-empty string for 'term'
    const safeQuery = String(query || "").trim();
    if (!safeQuery) return [];

    try {
      const results = await search(this.db, {
        term: safeQuery,
        limit: 5,
      });

      if (!results || !results.hits) return [];

      return results.hits
        .filter(hit => hit.document.pdfId === pdfId)
        .map(hit => ({
          text: hit.document.text as string,
          pageIndex: hit.document.pageIndex as number,
        }));
    } catch (e) {
      console.error("[RAG] Search failed:", e);
      return [];
    }
  }
}

export const ragEngine = new RAGEngine();
