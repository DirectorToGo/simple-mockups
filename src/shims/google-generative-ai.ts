export interface ContentPart {
  text: string;
}

export interface Content {
  role: string;
  parts: ContentPart[];
}

export interface GenerateContentRequest {
  contents: Content[];
  generationConfig?: Record<string, unknown>;
}

interface GenerateContentResult {
  response: {
    text(): string;
  };
}

const INSTALL_HINT = `@google/generative-ai SDK is not available in this environment. Install it with \n  npm install @google/generative-ai\nthen restart the dev server.`;

class StubModel {
  async generateContent(_request: GenerateContentRequest): Promise<GenerateContentResult> {
    throw new Error(INSTALL_HINT);
  }
}

export class GoogleGenerativeAI {
  constructor(private readonly apiKey: string) {
    if (!this.apiKey) {
      throw new Error('API key is required to use Google Generative AI');
    }
  }

  getGenerativeModel(_config: Record<string, unknown>): StubModel {
    console.warn(INSTALL_HINT);
    return new StubModel();
  }
}
