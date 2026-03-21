import { NeakasaAPI, NeakasaAPIError } from '../src/api';

function createMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
    success: jest.fn(),
    prefix: 'test',
  } as any;
}

describe('NeakasaAPI', () => {
  describe('auth state guards', () => {
    it('getDevices should throw NeakasaAPIError when not connected', async () => {
      const api = new NeakasaAPI(createMockLogger());
      await expect(api.getDevices()).rejects.toThrow(NeakasaAPIError);
      await expect(api.getDevices()).rejects.toThrow('not connected');
    });

    it('getDeviceProperties should throw NeakasaAPIError when not connected', async () => {
      const api = new NeakasaAPI(createMockLogger());
      await expect(api.getDeviceProperties('test-id')).rejects.toThrow(NeakasaAPIError);
      await expect(api.getDeviceProperties('test-id')).rejects.toThrow('not connected');
    });

    it('setDeviceProperties should throw NeakasaAPIError when not connected', async () => {
      const api = new NeakasaAPI(createMockLogger());
      await expect(api.setDeviceProperties('test-id', {})).rejects.toThrow(NeakasaAPIError);
      await expect(api.setDeviceProperties('test-id', {})).rejects.toThrow('not connected');
    });

    it('cleanNow should throw NeakasaAPIError when not connected', async () => {
      const api = new NeakasaAPI(createMockLogger());
      await expect(api.cleanNow('test-id')).rejects.toThrow(NeakasaAPIError);
    });

    it('sandLeveling should throw NeakasaAPIError when not connected', async () => {
      const api = new NeakasaAPI(createMockLogger());
      await expect(api.sandLeveling('test-id')).rejects.toThrow(NeakasaAPIError);
    });

    it('emptyBin should throw NeakasaAPIError when not connected', async () => {
      const api = new NeakasaAPI(createMockLogger());
      await expect(api.emptyBin('test-id')).rejects.toThrow(NeakasaAPIError);
    });
  });

  describe('connected flag', () => {
    it('should start as false', () => {
      const api = new NeakasaAPI(createMockLogger());
      expect(api.connected).toBe(false);
    });
  });
});
