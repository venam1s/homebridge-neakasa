import { IoTClient, IoTClientError } from '../src/client';
import axios from 'axios';

jest.mock('axios');

const mockPost = jest.fn();
(axios.create as jest.Mock).mockReturnValue({ post: mockPost });

function newClient() {
  return new IoTClient({ appKey: 'testKey', appSecret: 'testSecret', domain: 'test.example.com' });
}

describe('IoTClient', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });
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

  describe('doRequest', () => {
    const body = { version: '1.0', params: { foo: 'bar' }, request: { apiVer: '1.0.0', language: 'en-US' } };

    it('should POST to the domain path and return response.data on success', async () => {
      const client = newClient();
      mockPost.mockResolvedValue({ data: { code: 200, data: { ok: true } } });

      const result = await client.doRequest('/thing/properties/get', { ...body });

      expect(result).toEqual({ code: 200, data: { ok: true } });
      const [url, sentBody, opts] = mockPost.mock.calls[0];
      expect(url).toBe('https://test.example.com/thing/properties/get');
      expect(opts.headers).toHaveProperty('x-ca-signature');
      expect(opts.headers).toHaveProperty('x-ca-signature-headers');
      expect(opts.headers['content-md5']).toBeDefined();
      // body is stringified with an injected id (nonce)
      const parsed = JSON.parse(sentBody);
      expect(parsed.id).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should reuse a caller-supplied id instead of generating a nonce', async () => {
      const client = newClient();
      mockPost.mockResolvedValue({ data: { code: 200, data: {} } });

      await client.doRequest('/p', { ...body, id: 'caller-id' });

      const parsed = JSON.parse(mockPost.mock.calls[0][1]);
      expect(parsed.id).toBe('caller-id');
    });

    it('should wrap transport failures in IoTClientError', async () => {
      const client = newClient();
      mockPost.mockRejectedValue(new Error('boom'));

      await expect(client.doRequest('/p', { ...body })).rejects.toThrow(IoTClientError);
      await expect(client.doRequest('/p', { ...body })).rejects.toThrow('API request failed: boom');
    });
  });

  describe('doRequestRaw', () => {
    it('should form-encode the body, sign it, merge extra headers, and return response.data', async () => {
      const client = newClient();
      mockPost.mockResolvedValue({ data: { success: 'true', data: { vid: 'v1' } } });

      const result = await client.doRequestRaw('/api/prd/loginbyoauth.json', { req: { a: 1 } }, { Vid: 'v1' });

      expect(result).toEqual({ success: 'true', data: { vid: 'v1' } });
      const [url, sentBody, opts] = mockPost.mock.calls[0];
      expect(url).toBe('https://test.example.com/api/prd/loginbyoauth.json');
      expect(opts.headers['content-type']).toBe('application/x-www-form-urlencoded');
      expect(opts.headers.Vid).toBe('v1');
      expect(opts.headers['x-ca-signature']).toBeDefined();
      expect(sentBody).toContain('req=');
    });

    it('should wrap transport failures in IoTClientError', async () => {
      const client = newClient();
      mockPost.mockRejectedValue(new Error('network down'));

      await expect(client.doRequestRaw('/p', {})).rejects.toThrow(IoTClientError);
      await expect(client.doRequestRaw('/p', {})).rejects.toThrow('API request failed: network down');
    });
  });

  describe('IoTClientError', () => {
    it('should carry the name and message', () => {
      const err = new IoTClientError('nope');
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('IoTClientError');
      expect(err.message).toBe('nope');
    });
  });
});
