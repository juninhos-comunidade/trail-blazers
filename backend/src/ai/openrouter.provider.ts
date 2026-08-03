import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProviderPort } from '../job-vacancy/vacancy-parser.service';

@Injectable()
export class OpenRouterProvider implements AiProviderPort {
  private readonly logger = new Logger(OpenRouterProvider.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly siteUrl: string;
  private readonly siteTitle: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.getOrThrow<string>('OPENROUTER_API_KEY');
    this.model = this.config.get<string>('AI_MODEL', 'meta-llama/llama-3.1-8b-instruct:free');
    this.siteUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3001');
    this.siteTitle = this.config.get<string>('APP_TITLE', 'Trail Blazers');
  }

  async complete(systemPrompt: string, userMessage: string): Promise<string> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'HTTP-Referer': this.siteUrl,
        'X-Title': this.siteTitle,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        response_format: { type: 'json_object' }, // força JSON — suportado pela maioria dos modelos
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter erro ${response.status}: ${error}`);
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenRouter retornou resposta vazia.');

    return content;
  }
}
