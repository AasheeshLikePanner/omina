import * as webllm from "@mlc-ai/web-llm";

export const APP_MODELS = [
  {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    name: "Qwen 2.5 1.5B (Fast)",
    vram: "1.6GB",
    description: "Lightweight and efficient, perfect for quick summaries."
  },
  {
    id: "Qwen3-4B-q4f16_1-MLC",
    name: "Qwen 3 4B",
    vram: "3.4GB",
    description: "Powerful and smart, best for complex analysis."
  },
  {
    id: "gemma-2-2b-it-q4f16_1-MLC",
    name: "Gemma 2 2B",
    vram: "1.9GB",
    description: "Balanced performance from Google."
  }
];

export type ModelStatus = {
  progress: number;
  text: string;
  isLoaded: boolean;
};

export class WebLLMService {
  private engine: webllm.MLCEngine | null = null;
  private onStatusUpdate: (status: ModelStatus) => void;

  constructor(onStatusUpdate: (status: ModelStatus) => void) {
    this.onStatusUpdate = onStatusUpdate;
  }

  async loadModel(modelId: string) {
    this.onStatusUpdate({ progress: 0, text: "Initializing...", isLoaded: false });
    
    try {
      this.engine = await webllm.CreateMLCEngine(modelId, {
        appConfig: webllm.prebuiltAppConfig,
        initProgressCallback: (report) => {
          this.onStatusUpdate({
            progress: report.progress,
            text: report.text,
            isLoaded: report.progress === 1
          });
        }
      });
    } catch (error) {
      console.error("Failed to load model:", error);
      this.onStatusUpdate({ progress: 0, text: "Error loading model", isLoaded: false });
    }
  }

  async chat(messages: webllm.ChatCompletionMessageParam[]) {
    if (!this.engine) throw new Error("Model not loaded");
    
    const chunks = await this.engine.chat.completions.create({
      messages,
      stream: true
    });

    return chunks;
  }
}
