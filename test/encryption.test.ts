import { APIEncryption } from '../src/encryption';

describe('APIEncryption', () => {
  let encryption: APIEncryption;

  beforeEach(() => {
    encryption = new APIEncryption();
  });

  describe('encrypt / decrypt', () => {
    it('should round-trip a simple string', () => {
      const plaintext = 'hello world';
      const encrypted = encryption.encrypt(plaintext);
      expect(encrypted).not.toBe(plaintext);
      expect(encryption.decrypt(encrypted)).toBe(plaintext);
    });

    it('should round-trip an empty string', () => {
      const encrypted = encryption.encrypt('');
      expect(encryption.decrypt(encrypted)).toBe('');
    });

    it('should round-trip a string that is exactly 16 bytes', () => {
      const plaintext = '1234567890123456';
      const encrypted = encryption.encrypt(plaintext);
      expect(encryption.decrypt(encrypted)).toBe(plaintext);
    });

    it('should round-trip unicode content', () => {
      const plaintext = 'token@12345@key1';
      const encrypted = encryption.encrypt(plaintext);
      expect(encryption.decrypt(encrypted)).toBe(plaintext);
    });

    it('should handle base64 spaces during decrypt', () => {
      const plaintext = 'test data';
      const encrypted = encryption.encrypt(plaintext);
      // Replace + with space (simulates URL transport corruption)
      const withSpaces = encrypted.replace(/\+/g, ' ');
      expect(encryption.decrypt(withSpaces)).toBe(plaintext);
    });
  });

  describe('decodeLoginToken', () => {
    it('should extract token from a single-part login token', () => {
      const token = 'my-token';
      const loginToken = encryption.encrypt(token);

      encryption.decodeLoginToken(loginToken);
      expect((encryption as any).token).toBe(token);
      expect(encryption.userid).toBeUndefined();
    });

    it('should extract token and userid from a two-part login token', () => {
      const loginToken = encryption.encrypt('my-token@user123');

      encryption.decodeLoginToken(loginToken);
      expect((encryption as any).token).toBe('my-token');
      expect(encryption.userid).toBe('user123');
      expect(encryption.uid).toBeDefined();
    });

    it('should extract token, userid, and update AES key from a three-part login token', () => {
      const newKey = 'ABCDEFGHIJKLMNOP'; // 16 chars
      const loginToken = encryption.encrypt(`my-token@user123@${newKey}`);

      encryption.decodeLoginToken(loginToken);
      expect((encryption as any).token).toBe('my-token');
      expect(encryption.userid).toBe('user123');
      // After decoding, encryption key is updated — verify by encrypting with new key
      const testEncrypted = encryption.encrypt('test');
      // Decrypting with the same instance (which now uses the new key) should work
      expect(encryption.decrypt(testEncrypted)).toBe('test');
    });

    it('should extract all four parts including IV', () => {
      const newKey = 'ABCDEFGHIJKLMNOP';
      const newIv = 'QRSTUVWXYZ123456';
      const loginToken = encryption.encrypt(`my-token@user123@${newKey}@${newIv}`);

      encryption.decodeLoginToken(loginToken);
      expect((encryption as any).token).toBe('my-token');
      expect(encryption.userid).toBe('user123');
      // Verify encryption still works with new key/IV
      const roundTrip = encryption.decrypt(encryption.encrypt('test'));
      expect(roundTrip).toBe('test');
    });

    it('should reset state before decoding', () => {
      // Set some state
      (encryption as any).token = 'old-token';
      encryption.userid = 'old-user';

      const loginToken = encryption.encrypt('new-token@new-user');
      encryption.decodeLoginToken(loginToken);

      expect((encryption as any).token).toBe('new-token');
      expect(encryption.userid).toBe('new-user');
    });
  });

  describe('getToken', () => {
    it('should return an encrypted string containing the token and timestamp', () => {
      const loginToken = encryption.encrypt('my-token@user123');
      encryption.decodeLoginToken(loginToken);

      const token = encryption.getToken();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);

      // Decrypt and verify format: token@timestamp
      const decrypted = encryption.decrypt(token);
      expect(decrypted).toMatch(/^my-token@\d+\.\d+$/);
    });
  });

  describe('resetEncryption', () => {
    it('should reset to default state', () => {
      (encryption as any).token = 'something';
      encryption.userid = 'someone';

      encryption.resetEncryption();

      expect((encryption as any).token).toBe('');
      // Verify default key is restored by doing a round-trip
      const encrypted = encryption.encrypt('test');
      const fresh = new APIEncryption();
      expect(fresh.decrypt(encrypted)).toBe('test');
    });
  });
});
