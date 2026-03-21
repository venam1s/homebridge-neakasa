import { IoTClient } from '../src/client';

describe('IoTClient', () => {
  describe('buildSignatureHeaders', () => {
    it('should return x-ca-signature-headers and x-ca-signature without mutating input headers', () => {
      const client = new IoTClient({
        appKey: 'testKey',
        appSecret: 'testSecret',
        domain: 'test.example.com',
      });

      const headers: Record<string, string> = {
        'host': 'test.example.com',
        'date': 'Mon, 01 Jan 2024 00:00:00 GMT',
        'x-ca-nonce': 'abc123',
        'x-ca-key': 'testKey',
        'x-ca-signaturemethod': 'HmacSHA256',
        'accept': 'application/json',
        'content-type': 'application/octet-stream',
        'content-md5': 'abc==',
      };

      const originalKeys = Object.keys(headers).sort();
      const result = client.buildSignatureHeaders('POST', headers, '/test');

      // Should not mutate input
      expect(Object.keys(headers).sort()).toEqual(originalKeys);

      // Should return signature headers
      expect(result).toHaveProperty('x-ca-signature-headers');
      expect(result).toHaveProperty('x-ca-signature');
      expect(typeof result['x-ca-signature']).toBe('string');
      expect(typeof result['x-ca-signature-headers']).toBe('string');
    });

    it('should include only non-excluded headers in signature-headers list', () => {
      const client = new IoTClient({
        appKey: 'testKey',
        appSecret: 'testSecret',
        domain: 'test.example.com',
      });

      const headers: Record<string, string> = {
        'host': 'test.example.com',
        'date': 'Mon, 01 Jan 2024 00:00:00 GMT',
        'x-ca-nonce': 'abc123',
        'x-ca-key': 'testKey',
        'x-ca-signaturemethod': 'HmacSHA256',
        'accept': 'application/json',
        'content-type': 'application/octet-stream',
        'content-md5': 'abc==',
      };

      const result = client.buildSignatureHeaders('POST', headers, '/test');
      const signedHeaders = result['x-ca-signature-headers'].split(',');

      // These should be excluded from the signature headers list
      expect(signedHeaders).not.toContain('accept');
      expect(signedHeaders).not.toContain('content-md5');
      expect(signedHeaders).not.toContain('content-type');
      expect(signedHeaders).not.toContain('date');
      expect(signedHeaders).not.toContain('host');

      // These should be included
      expect(signedHeaders).toContain('x-ca-key');
      expect(signedHeaders).toContain('x-ca-nonce');
      expect(signedHeaders).toContain('x-ca-signaturemethod');
    });

    it('should produce consistent signatures for same input', () => {
      const client = new IoTClient({
        appKey: 'testKey',
        appSecret: 'testSecret',
        domain: 'test.example.com',
      });

      const headers: Record<string, string> = {
        'host': 'test.example.com',
        'date': 'Mon, 01 Jan 2024 00:00:00 GMT',
        'x-ca-nonce': 'abc123',
        'x-ca-key': 'testKey',
        'x-ca-signaturemethod': 'HmacSHA256',
        'accept': 'application/json',
        'content-type': 'application/octet-stream',
        'content-md5': 'abc==',
      };

      const result1 = client.buildSignatureHeaders('POST', { ...headers }, '/test');
      const result2 = client.buildSignatureHeaders('POST', { ...headers }, '/test');

      expect(result1['x-ca-signature']).toBe(result2['x-ca-signature']);
    });
  });

  describe('domain', () => {
    it('should expose domain as readonly property', () => {
      const client = new IoTClient({
        appKey: 'testKey',
        appSecret: 'testSecret',
        domain: 'test.example.com',
      });

      expect(client.domain).toBe('test.example.com');
    });
  });
});
