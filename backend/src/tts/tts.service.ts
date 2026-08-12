import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

function isTimeout(err: unknown): boolean {
  const named = err as { name?: string; cause?: { name?: string } } | null;
  return named?.name === 'TimeoutError' || named?.cause?.name === 'TimeoutError';
}

/**
 * Fala em servidor via ElevenLabs, para uma voz consistente independente do
 * navegador do usuário. É opcional: sem ELEVENLABS_API_KEY configurada (ex.
 * cota do tier gratuito esgotada, ou ambiente sem a chave), lança
 * ServiceUnavailableException — o frontend usa isso como sinal para cair de
 * volta na Web Speech API do próprio navegador.
 */
@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);
  private readonly apiKey?: string;
  private readonly voiceId: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('ELEVENLABS_API_KEY');
    this.voiceId = this.config.get<string>('ELEVENLABS_VOICE_ID', DEFAULT_VOICE_ID);
  }

  async synthesize(text: string): Promise<Buffer> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException('Síntese de voz no servidor não está configurada.');
    }

    let response: Response;

    try {
      response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`, {
        method: 'POST',
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      });
    } catch (err) {
      const reason = isTimeout(err) ? 'não respondeu a tempo' : 'não pôde ser alcançada';
      this.logger.warn(`ElevenLabs ${reason}: ${(err as Error).message}`);
      throw new ServiceUnavailableException('Não foi possível gerar áudio agora.');
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.warn(`ElevenLabs respondeu ${response.status}: ${body}`);
      throw new ServiceUnavailableException('Não foi possível gerar áudio agora.');
    }

    return Buffer.from(await response.arrayBuffer());
  }
}
