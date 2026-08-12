import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { TtsService } from './tts.service';
import { SpeakSchema } from './tts.schema';

const API_KEY = 'sk_elevenlabs';
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

const audioOk = (bytes: number[]) => ({
  ok: true,
  arrayBuffer: () => Promise.resolve(Uint8Array.from(bytes).buffer),
});

const httpErr = (status: number) => ({
  ok: false,
  status,
  text: () => Promise.resolve('{"detail":"quota_exceeded"}'),
});

const timeoutError = () =>
  Object.assign(new Error('The operation was aborted'), {
    name: 'TimeoutError',
  });

describe('TtsService', () => {
  let fetchMock: jest.Mock;

  const build = async (env: Record<string, string | undefined>) => {
    const config = {
      get: jest.fn((key: string, fallback?: string) => env[key] ?? fallback),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [TtsService, { provide: ConfigService, useValue: config }],
    }).compile();

    return module.get(TtsService);
  };

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('CT-16.1 sinaliza 503 sem chave configurada, sem chamar a ElevenLabs', async () => {
    const service = await build({ ELEVENLABS_API_KEY: undefined });

    await expect(service.synthesize('olá')).rejects.toThrow(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('CT-16.2 devolve o áudio como Buffer', async () => {
    const service = await build({ ELEVENLABS_API_KEY: API_KEY });
    fetchMock.mockResolvedValue(audioOk([1, 2, 3]));

    const audio = await service.synthesize('olá');

    expect(Buffer.isBuffer(audio)).toBe(true);
    expect([...audio]).toEqual([1, 2, 3]);
  });

  it('CT-16.3 autentica com xi-api-key e usa a voz configurada', async () => {
    const service = await build({ ELEVENLABS_API_KEY: API_KEY, ELEVENLABS_VOICE_ID: 'voz-custom' });
    fetchMock.mockResolvedValue(audioOk([1]));

    await service.synthesize('texto da pergunta');

    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { headers: Record<string, string>; body: string; method: string },
    ];
    expect(url).toBe('https://api.elevenlabs.io/v1/text-to-speech/voz-custom');
    expect(init.method).toBe('POST');
    expect(init.headers['xi-api-key']).toBe(API_KEY);
    expect(JSON.parse(init.body)).toMatchObject({
      text: 'texto da pergunta',
      model_id: 'eleven_multilingual_v2',
    });
  });

  it('CT-16.4 cai para a voz padrão sem ELEVENLABS_VOICE_ID', async () => {
    const service = await build({ ELEVENLABS_API_KEY: API_KEY });
    fetchMock.mockResolvedValue(audioOk([1]));

    await service.synthesize('olá');

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain(DEFAULT_VOICE_ID);
  });

  it.each([
    ['erro direto', timeoutError()],
    [
      'erro embrulhado em cause',
      Object.assign(new Error('fetch failed'), { cause: timeoutError() }),
    ],
  ])('CT-16.5 traduz timeout (%s) em 503', async (_caso, erro) => {
    const service = await build({ ELEVENLABS_API_KEY: API_KEY });
    fetchMock.mockRejectedValue(erro);

    await expect(service.synthesize('olá')).rejects.toThrow(ServiceUnavailableException);
  });

  it('CT-16.6 traduz erro de rede em 503', async () => {
    const service = await build({ ELEVENLABS_API_KEY: API_KEY });
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.synthesize('olá')).rejects.toThrow(ServiceUnavailableException);
  });

  it.each([401, 429, 500])(
    'CT-16.7 traduz %s em 503 sem repassar o corpo da ElevenLabs',
    async (status) => {
      const service = await build({ ELEVENLABS_API_KEY: API_KEY });
      fetchMock.mockResolvedValue(httpErr(status));

      const err = await service.synthesize('olá').catch((e: unknown) => e);

      expect(err).toBeInstanceOf(ServiceUnavailableException);
      expect((err as Error).message).toBe('Não foi possível gerar áudio agora.');
      expect((err as Error).message).not.toContain('quota_exceeded');
    },
  );

  it('CT-16.7b tolera corpo de erro ilegível', async () => {
    const service = await build({ ELEVENLABS_API_KEY: API_KEY });
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.reject(new Error('stream quebrado')),
    });

    await expect(service.synthesize('olá')).rejects.toThrow(ServiceUnavailableException);
  });

  describe('SpeakSchema', () => {
    it.each([
      ['texto vazio', ''],
      ['só espaços', '   '],
      ['acima de 500 caracteres', 'a'.repeat(501)],
    ])('CT-16.8 rejeita %s', (_caso, text) => {
      expect(SpeakSchema.safeParse({ text }).success).toBe(false);
    });

    it('CT-16.9 apara espaços do texto aceito', () => {
      const result = SpeakSchema.parse({ text: '  qual sua experiência?  ' });

      expect(result.text).toBe('qual sua experiência?');
    });
  });
});
