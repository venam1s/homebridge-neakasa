import * as crypto from 'crypto';

const AES_KEY_DEFAULT = Buffer.from('3J74PRUE5TKPJP32', 'utf-8');
const AES_IV_DEFAULT = Buffer.from('QB8GC2X6WK39FF93', 'utf-8');

export class APIEncryption {
  private aesKey: Buffer = AES_KEY_DEFAULT;
  private aesIv: Buffer = AES_IV_DEFAULT;
  private token: string = '';
  public userid?: string;
  public uid?: string;

  constructor() {
    this.resetEncryption();
  }

  resetEncryption(): void {
    this.aesKey = AES_KEY_DEFAULT;
    this.aesIv = AES_IV_DEFAULT;
    this.token = '';
  }

  private pad(data: Buffer): Buffer {
    const blockSize = 16;
    const padLen = blockSize - (data.length % blockSize);
    if (padLen === 0 || padLen === blockSize) {
      return data;
    }
    return Buffer.concat([data, Buffer.alloc(padLen, 0)]);
  }

  private unpad(data: Buffer): Buffer {
    // Remove trailing null bytes
    let i = data.length - 1;
    while (i >= 0 && data[i] === 0) {
      i--;
    }
    return data.slice(0, i + 1);
  }

  encrypt(plainText: string): string {
    const cipher = crypto.createCipheriv('aes-128-cbc', this.aesKey, this.aesIv);
    cipher.setAutoPadding(false);
    const padded = this.pad(Buffer.from(plainText, 'utf-8'));
    const encrypted = Buffer.concat([cipher.update(padded), cipher.final()]);
    return encrypted.toString('base64');
  }

  decrypt(encryptedText: string): string {
    const decipher = crypto.createDecipheriv('aes-128-cbc', this.aesKey, this.aesIv);
    decipher.setAutoPadding(false);
    const encrypted = Buffer.from(encryptedText.replace(/ /g, '+'), 'base64');
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const unpadded = this.unpad(decrypted);
    return unpadded.toString('utf-8');
  }

  private getTimestamp(): string {
    return (Date.now() / 1000).toFixed(6);
  }

  getToken(): string {
    return this.encrypt(`${this.token}@${this.getTimestamp()}`);
  }

  decodeLoginToken(loginToken: string): void {
    this.resetEncryption();
    const decrypted = this.decrypt(loginToken);
    const parts = decrypted.split('@');

    if (parts.length >= 1) {
      this.token = parts[0];
    }
    if (parts.length >= 2) {
      this.userid = parts[1];
      this.uid = this.encrypt(parts[1]);
    }
    if (parts.length >= 3) {
      this.aesKey = Buffer.from(parts[2], 'utf-8');
    }
    if (parts.length >= 4) {
      this.aesIv = Buffer.from(parts[3], 'utf-8');
    }
  }
}
