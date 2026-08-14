import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { TtsService, TtsUnavailableError } from './tts.service';
import { SpeakSchema } from './tts.schema';

const API_KEY = 'azure_key';
const REGION = 'brazilsouth';
const DEFAULT_VOICE = 'pt-BR-FranciscaNeural';

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
  let cache: { get: jest.Mock; set: jest.Mock };

  const build = async (env: Record<string, string | undefined>) => {
    const config = {
      get: jest.fn((key: string, fallback?: string) => env[key] ?? fallback),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TtsService,
        { provide: ConfigService, useValue: config },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    return module.get(TtsService);
  };

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    cache = { get: jest.fn().mockResolvedValue(undefined), set: jest.fn() };
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('CT-16.1 sinaliza not_configured sem chave, sem chamar o Azure Speech', async () => {
    const service = await build({ AZURE_SPEECH_KEY: undefined, AZURE_SPEECH_REGION: REGION });

    const err = await service.synthesize('olá').catch((e: unknown) => e);

    expect(err).toBeInstanceOf(TtsUnavailableError);
    expect((err as TtsUnavailableError).reason).toBe('not_configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('CT-16.1b sinaliza not_configured sem região, mesmo com chave', async () => {
    const service = await build({ AZURE_SPEECH_KEY: API_KEY, AZURE_SPEECH_REGION: undefined });

    const err = await service.synthesize('olá').catch((e: unknown) => e);

    expect(err).toBeInstanceOf(TtsUnavailableError);
    expect((err as TtsUnavailableError).reason).toBe('not_configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('CT-16.2 devolve o áudio como Buffer', async () => {
    const service = await build({ AZURE_SPEECH_KEY: API_KEY, AZURE_SPEECH_REGION: REGION });
    fetchMock.mockResolvedValue(audioOk([1, 2, 3]));

    const audio = await service.synthesize('olá');

    expect(Buffer.isBuffer(audio)).toBe(true);
    expect([...audio]).toEqual([1, 2, 3]);
  });

  it('CT-16.2b guarda o áudio sintetizado no cache', async () => {
    const service = await build({ AZURE_SPEECH_KEY: API_KEY, AZURE_SPEECH_REGION: REGION });
    fetchMock.mockResolvedValue(audioOk([1, 2, 3]));

    const audio = await service.synthesize('olá');

    expect(cache.set).toHaveBeenCalledTimes(1);
    const [key, cachedValue] = cache.set.mock.calls[0] as [string, Buffer];
    expect(key).toMatch(/^tts_audio_/);
    expect(cachedValue).toBe(audio);
  });

  it('CT-16.2c com o áudio em cache, devolve direto e não chama a Azure nem exige configuração', async () => {
    const service = await build({ AZURE_SPEECH_KEY: undefined, AZURE_SPEECH_REGION: undefined });
    const cachedAudio = Buffer.from([9, 9, 9]);
    cache.get.mockResolvedValue(cachedAudio);

    const audio = await service.synthesize('já falado antes');

    expect(audio).toBe(cachedAudio);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('CT-16.2d textos diferentes geram chaves de cache diferentes', async () => {
    const service = await build({ AZURE_SPEECH_KEY: API_KEY, AZURE_SPEECH_REGION: REGION });
    fetchMock.mockResolvedValue(audioOk([1]));

    await service.synthesize('primeiro texto');
    await service.synthesize('segundo texto');

    const [firstKey] = cache.set.mock.calls[0] as [string];
    const [secondKey] = cache.set.mock.calls[1] as [string];
    expect(firstKey).not.toBe(secondKey);
  });

  it('CT-16.3 autentica com Ocp-Apim-Subscription-Key e usa a voz configurada', async () => {
    const service = await build({
      AZURE_SPEECH_KEY: API_KEY,
      AZURE_SPEECH_REGION: REGION,
      AZURE_SPEECH_VOICE: 'pt-BR-AntonioNeural',
    });
    fetchMock.mockResolvedValue(audioOk([1]));

    await service.synthesize('texto da pergunta');

    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { headers: Record<string, string>; body: string; method: string },
    ];
    expect(url).toBe(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`);
    expect(init.method).toBe('POST');
    expect(init.headers['Ocp-Apim-Subscription-Key']).toBe(API_KEY);
    expect(init.body).toContain('texto da pergunta');
    expect(init.body).toContain('pt-BR-AntonioNeural');
  });

  it('CT-16.4 cai para a voz padrão sem AZURE_SPEECH_VOICE', async () => {
    const service = await build({ AZURE_SPEECH_KEY: API_KEY, AZURE_SPEECH_REGION: REGION });
    fetchMock.mockResolvedValue(audioOk([1]));

    await service.synthesize('olá');

    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(init.body).toContain(DEFAULT_VOICE);
  });

  it('CT-16.4b escapa caracteres especiais de SSML no texto', async () => {
    const service = await build({ AZURE_SPEECH_KEY: API_KEY, AZURE_SPEECH_REGION: REGION });
    fetchMock.mockResolvedValue(audioOk([1]));

    await service.synthesize('<b>"João" & Cia</b>');

    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(init.body).not.toContain('<b>');
    expect(init.body).toContain('&amp;');
  });

  it.each([
    ['erro direto', timeoutError()],
    [
      'erro embrulhado em cause',
      Object.assign(new Error('fetch failed'), { cause: timeoutError() }),
    ],
  ])('CT-16.5 traduz timeout (%s) em unavailable', async (_caso, erro) => {
    const service = await build({ AZURE_SPEECH_KEY: API_KEY, AZURE_SPEECH_REGION: REGION });
    fetchMock.mockRejectedValue(erro);

    const err = await service.synthesize('olá').catch((e: unknown) => e);

    expect(err).toBeInstanceOf(TtsUnavailableError);
    expect((err as TtsUnavailableError).reason).toBe('unavailable');
  });

  it('CT-16.6 traduz erro de rede em unavailable', async () => {
    const service = await build({ AZURE_SPEECH_KEY: API_KEY, AZURE_SPEECH_REGION: REGION });
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const err = await service.synthesize('olá').catch((e: unknown) => e);

    expect(err).toBeInstanceOf(TtsUnavailableError);
    expect((err as TtsUnavailableError).reason).toBe('unavailable');
  });

  it('CT-16.7 traduz 429 em rate_limited (limite de concorrência do tier F0)', async () => {
    const service = await build({ AZURE_SPEECH_KEY: API_KEY, AZURE_SPEECH_REGION: REGION });
    fetchMock.mockResolvedValue(httpErr(429));

    const err = await service.synthesize('olá').catch((e: unknown) => e);

    expect(err).toBeInstanceOf(TtsUnavailableError);
    expect((err as TtsUnavailableError).reason).toBe('rate_limited');
  });

  it.each([401, 500])(
    'CT-16.7b traduz %s em unavailable sem repassar o corpo do Azure',
    async (status) => {
      const service = await build({ AZURE_SPEECH_KEY: API_KEY, AZURE_SPEECH_REGION: REGION });
      fetchMock.mockResolvedValue(httpErr(status));

      const err = await service.synthesize('olá').catch((e: unknown) => e);

      expect(err).toBeInstanceOf(TtsUnavailableError);
      expect((err as TtsUnavailableError).reason).toBe('unavailable');
      expect((err as Error).message).not.toContain('quota_exceeded');
    },
  );

  it('CT-16.7c tolera corpo de erro ilegível', async () => {
    const service = await build({ AZURE_SPEECH_KEY: API_KEY, AZURE_SPEECH_REGION: REGION });
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.reject(new Error('stream quebrado')),
    });

    await expect(service.synthesize('olá')).rejects.toBeInstanceOf(TtsUnavailableError);
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
