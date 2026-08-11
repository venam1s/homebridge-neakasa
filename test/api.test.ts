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

  // Build an API instance in a "connected" state with a stubbed IoT client.
  // getOrCreateClient() returns the pre-seeded apiClient because its domain matches.
  function connectedApi() {
    const api = new NeakasaAPI(createMockLogger());
    const doRequest = jest.fn();
    (api as any).connected = true;
    (api as any).apiGatewayEndpoint = 'gw.example.com';
    (api as any).iotToken = 'tok';
    (api as any).apiClient = { domain: 'gw.example.com', doRequest };
    return { api, doRequest };
  }

  describe('getDevices', () => {
    it('should return devices from a single page', async () => {
      const { api, doRequest } = connectedApi();
      doRequest.mockResolvedValue({ code: 200, data: { data: [{ iotId: 'a' }, { iotId: 'b' }] } });

      const devices = await api.getDevices();

      expect(devices).toHaveLength(2);
      expect(doRequest).toHaveBeenCalledTimes(1);
      expect(doRequest).toHaveBeenCalledWith('/uc/listBindingByAccount', expect.objectContaining({
        params: expect.objectContaining({ pageNo: 1, pageSize: 100 }),
      }));
    });

    it('should paginate until a page returns fewer than pageSize devices', async () => {
      const { api, doRequest } = connectedApi();
      const fullPage = Array.from({ length: 100 }, (_, i) => ({ iotId: `d${i}` }));
      doRequest
        .mockResolvedValueOnce({ code: 200, data: { data: fullPage } })
        .mockResolvedValueOnce({ code: 200, data: { data: [{ iotId: 'last' }] } });

      const devices = await api.getDevices();

      expect(devices).toHaveLength(101);
      expect(doRequest).toHaveBeenCalledTimes(2);
    });

    it('should throw NeakasaAPIError when the response code is not 200', async () => {
      const { api, doRequest } = connectedApi();
      doRequest.mockResolvedValue({ code: 500, message: 'server error' });

      await expect(api.getDevices()).rejects.toThrow(NeakasaAPIError);
      await expect(api.getDevices()).rejects.toThrow('server error');
    });

    it('should wrap transport errors in NeakasaAPIError', async () => {
      const { api, doRequest } = connectedApi();
      doRequest.mockRejectedValue(new Error('socket hang up'));

      await expect(api.getDevices()).rejects.toThrow(NeakasaAPIError);
      await expect(api.getDevices()).rejects.toThrow('socket hang up');
    });
  });

  describe('getDeviceProperties', () => {
    it('should return response data on success', async () => {
      const { api, doRequest } = connectedApi();
      doRequest.mockResolvedValue({ code: 200, data: { bucketStatus: 3 } });

      await expect(api.getDeviceProperties('iot-1')).resolves.toEqual({ bucketStatus: 3 });
    });

    it('should mark the session disconnected when identityId is blank', async () => {
      const { api, doRequest } = connectedApi();
      doRequest.mockResolvedValue({ code: 401, message: 'identityId is blank' });

      await expect(api.getDeviceProperties('iot-1')).rejects.toThrow(NeakasaAPIError);
      expect(api.connected).toBe(false);
    });

    it('should stay connected on unrelated errors', async () => {
      const { api, doRequest } = connectedApi();
      doRequest.mockResolvedValue({ code: 500, message: 'boom' });

      await expect(api.getDeviceProperties('iot-1')).rejects.toThrow('boom');
      expect(api.connected).toBe(true);
    });
  });

  describe('setDeviceProperties', () => {
    it('should send items and iotId and resolve on success', async () => {
      const { api, doRequest } = connectedApi();
      doRequest.mockResolvedValue({ code: 200 });

      await api.setDeviceProperties('iot-1', { childLock: 1 });

      expect(doRequest).toHaveBeenCalledWith('/thing/properties/set', expect.objectContaining({
        params: { items: { childLock: 1 }, iotId: 'iot-1' },
      }));
    });

    it('should throw NeakasaAPIError when the response code is not 200', async () => {
      const { api, doRequest } = connectedApi();
      doRequest.mockResolvedValue({ code: 500 });

      await expect(api.setDeviceProperties('iot-1', {})).rejects.toThrow('Failed to set device properties');
    });
  });

  describe('service invocations', () => {
    it('cleanNow should invoke the cleanNow service', async () => {
      const { api, doRequest } = connectedApi();
      doRequest.mockResolvedValue({ code: 200 });

      await api.cleanNow('iot-1');

      expect(doRequest).toHaveBeenCalledWith('/thing/service/invoke', expect.objectContaining({
        params: { args: { bStartClean: 1 }, identifier: 'cleanNow', iotId: 'iot-1' },
      }));
    });

    it('sandLeveling should invoke the sandLeveling service', async () => {
      const { api, doRequest } = connectedApi();
      doRequest.mockResolvedValue({ code: 200 });

      await api.sandLeveling('iot-1');

      expect(doRequest).toHaveBeenCalledWith('/thing/service/invoke', expect.objectContaining({
        params: { args: { bStartLeveling: 1 }, identifier: 'sandLeveling', iotId: 'iot-1' },
      }));
    });

    it('should throw NeakasaAPIError when the service call fails', async () => {
      const { api, doRequest } = connectedApi();
      doRequest.mockResolvedValue({ code: 500 });

      await expect(api.cleanNow('iot-1')).rejects.toThrow('Failed to invoke service');
    });

    it('emptyBin should clear binFullWaitReset via setDeviceProperties', async () => {
      const { api, doRequest } = connectedApi();
      doRequest.mockResolvedValue({ code: 200 });

      await api.emptyBin('iot-1');

      expect(doRequest).toHaveBeenCalledWith('/thing/properties/set', expect.objectContaining({
        params: { items: { binFullWaitReset: 0 }, iotId: 'iot-1' },
      }));
    });
  });

  describe('getRecords', () => {
    function withRecords() {
      const { api } = connectedApi();
      const get = jest.fn();
      (api as any).baseUrl = 'https://base.example.com';
      (api as any).axiosInstance = { get };
      (api as any).encryption = { userid: 'u1', uid: 'uid1', getToken: () => 'token1' };
      return { api, get };
    }

    it('should return record data on success', async () => {
      const { api, get } = withRecords();
      get.mockResolvedValue({ data: { code: 0, data: { records: [1, 2] } } });

      await expect(api.getRecords('dev-name')).resolves.toEqual({ records: [1, 2] });
      expect(get).toHaveBeenCalledWith('https://base.example.com/catbox/record', expect.objectContaining({
        params: expect.objectContaining({ device_name: 'dev-name', user_id: 'u1' }),
      }));
    });

    it('should throw NeakasaAPIError when the API returns a non-zero code', async () => {
      const { api, get } = withRecords();
      get.mockResolvedValue({ data: { code: 1, message: 'nope' } });

      await expect(api.getRecords('dev-name')).rejects.toThrow('nope');
    });

    it('should wrap transport errors', async () => {
      const { api, get } = withRecords();
      get.mockRejectedValue(new Error('timeout'));

      await expect(api.getRecords('dev-name')).rejects.toThrow('timeout');
    });
  });

  describe('connect orchestration', () => {
    function stubStages(api: any) {
      jest.spyOn(api, 'loadBaseUrlByAccount').mockResolvedValue(undefined);
      jest.spyOn(api, 'loadAuthTokens').mockResolvedValue(undefined);
      jest.spyOn(api, 'loadRegionData').mockResolvedValue(undefined);
      jest.spyOn(api, 'getVid').mockResolvedValue('vid');
      jest.spyOn(api, 'getSidByVid').mockResolvedValue('sid');
    }

    it('should complete the auth chain and set connected on success', async () => {
      const api = new NeakasaAPI(createMockLogger());
      stubStages(api);
      jest.spyOn(api as any, 'getIotTokenBySid').mockResolvedValue('iot-token');

      await api.connect('user', 'pass');

      expect(api.connected).toBe(true);
      expect((api as any).iotToken).toBe('iot-token');
    });

    it('should re-authenticate once when the first IoT token attempt fails', async () => {
      const api = new NeakasaAPI(createMockLogger());
      const log = (api as any).log;
      stubStages(api);
      jest.spyOn(api as any, 'getIotTokenBySid')
        .mockRejectedValueOnce(new Error('sid expired'))
        .mockResolvedValueOnce('iot-token-2');

      await api.connect('user', 'pass');

      expect(api.connected).toBe(true);
      expect((api as any).iotToken).toBe('iot-token-2');
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('retrying full auth'));
    });

    it('should throw NeakasaAuthError when no SID is obtained', async () => {
      const api = new NeakasaAPI(createMockLogger());
      jest.spyOn(api as any, 'loadBaseUrlByAccount').mockResolvedValue(undefined);
      jest.spyOn(api as any, 'loadAuthTokens').mockResolvedValue(undefined);
      jest.spyOn(api as any, 'loadRegionData').mockResolvedValue(undefined);
      jest.spyOn(api as any, 'getVid').mockResolvedValue('vid');
      jest.spyOn(api as any, 'getSidByVid').mockResolvedValue('');

      await expect(api.connect('user', 'pass')).rejects.toThrow('SID not available');
    });
  });
});
