import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recomendado para GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Criptografia simétrica autenticada (AES-256-GCM) para segredos que precisam
 * ser lidos de volta em texto puro — hoje, o access token do GitHub.
 *
 * O formato persistido é `iv:authTag:ciphertext`, tudo em base64.
 */
@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(configService: ConfigService) {
    // 32 bytes em hexadecimal (64 caracteres) — validado no schema do Joi
    this.key = Buffer.from(configService.getOrThrow<string>('ENCRYPTION_KEY'), 'hex');
  }

  encrypt(plainText: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);

    const cipherText = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [iv, authTag, cipherText].map((part) => part.toString('base64')).join(':');
  }

  decrypt(payload: string): string {
    const parts = payload.split(':');

    // checa a quantidade de partes, e não se cada uma é vazia: o ciphertext de
    // uma string vazia é legitimamente vazio
    if (parts.length !== 3) {
      throw new Error('Conteúdo criptografado em formato inválido');
    }

    const [ivPart, authTagPart, cipherTextPart] = parts;

    const iv = Buffer.from(ivPart, 'base64');
    const authTag = Buffer.from(authTagPart, 'base64');

    if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error('Conteúdo criptografado em formato inválido');
    }

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);

    // `final()` lança se o authTag não bater, ou seja, se o dado foi adulterado
    return Buffer.concat([
      decipher.update(Buffer.from(cipherTextPart, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
