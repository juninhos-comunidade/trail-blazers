import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_VOICE = 'pt-BR-FranciscaNeural';

export type TtsFailureReason = 'not_configured' | 'rate_limited' | 'unavailable';

/**
 * Erro de TTS com um `reason` estável que o frontend usa para explicar ao
 * usuário por que caiu para a voz do navegador (em vez de um 503 genérico).
 */
export class TtsUnavailableError extends ServiceUnavailableException {
  constructor(message: string, public readonly reason: TtsFailureReason) {
    super({ message, reason });
  }
}

function isTimeout(err: unknown): boolean {
  const named = err as { name?: string; cause?: { name?: string } } | null;
  return named?.name === 'TimeoutError' || named?.cause?.name === 'TimeoutError';
}

function escapeSsml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Fala em servidor via Azure Speech (tier gratuito F0: 0,5M caracteres/mês,
 * 1 requisição concorrente), para uma voz consistente independente do
 * navegador do usuário. É opcional: sem AZURE_SPEECH_KEY/REGION configuradas,
 * ou se a cota/concorrência do F0 estourar, lança TtsUnavailableError — o
 * frontend usa o `reason` para cair de volta na Web Speech API do navegador
 * e avisar o usuário do motivo.
 */
@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);
  private readonly apiKey?: string;
  private readonly region?: string;
  private readonly voice: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('AZURE_SPEECH_KEY');
    this.region = this.config.get<string>('AZURE_SPEECH_REGION');
    this.voice = this.config.get<string>('AZURE_SPEECH_VOICE', DEFAULT_VOICE);
  }

  async synthesize(text: string): Promise<Buffer> {
    if (!this.apiKey || !this.region) {
      throw new TtsUnavailableError(
        'Síntese de voz no servidor não está configurada.',
        'not_configured',
      );
    }

    const ssml = `<speak version="1.0" xml:lang="pt-BR"><voice name="${this.voice}">${escapeSsml(text)}</voice></speak>`;

    let response: Response;

    try {
      response = await fetch(
        `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`,
        {
          method: 'POST',
          signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
          headers: {
            'Ocp-Apim-Subscription-Key': this.apiKey,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-16khz-64kbitrate-mono-mp3',
          },
          body: ssml,
        },
      );
    } catch (err) {
      const reason = isTimeout(err) ? 'não respondeu a tempo' : 'não pôde ser alcançada';
      this.logger.warn(`Azure Speech ${reason}: ${(err as Error).message}`);
      throw new TtsUnavailableError('Não foi possível gerar áudio agora.', 'unavailable');
    }

    if (response.status === 429) {
      this.logger.warn(
        'Azure Speech respondeu 429: limite de 1 requisição concorrente do tier F0 em uso.',
      );
      throw new TtsUnavailableError(
        'O leitor de voz do servidor está ocupado com outra entrevista agora.',
        'rate_limited',
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.warn(`Azure Speech respondeu ${response.status}: ${body}`);
      throw new TtsUnavailableError('Não foi possível gerar áudio agora.', 'unavailable');
    }

    return Buffer.from(await response.arrayBuffer());
  }
}
