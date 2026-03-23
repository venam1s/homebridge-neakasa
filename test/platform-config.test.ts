import { NeakasaPlatform } from '../src/platform';
import { NeakasaPlatformConfig } from '../src/types';

// Minimal Homebridge mocks
function createMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
    success: jest.fn(),
    prefix: 'test',
  };
}

function createMockApi() {
  return {
    hap: {
      uuid: { generate: jest.fn((id: string) => `uuid-${id}`) },
      Service: {
        AccessoryInformation: 'AccessoryInformation',
        Switch: 'Switch',
        ContactSensor: 'ContactSensor',
        OccupancySensor: 'OccupancySensor',
        FilterMaintenance: 'FilterMaintenance',
        LeakSensor: 'LeakSensor',
        HumiditySensor: 'HumiditySensor',
        MotionSensor: 'MotionSensor',
        LockMechanism: 'LockMechanism',
      },
      Characteristic: {
        Name: 'Name',
        ConfiguredName: 'ConfiguredName',
        On: 'On',
        ContactSensorState: { CONTACT_DETECTED: 0, CONTACT_NOT_DETECTED: 1 },
        OccupancyDetected: { OCCUPANCY_DETECTED: 1, OCCUPANCY_NOT_DETECTED: 0 },
        FilterChangeIndication: { FILTER_OK: 0, CHANGE_FILTER: 1 },
        FilterLifeLevel: 'FilterLifeLevel',
        Manufacturer: 'Manufacturer',
        Model: 'Model',
        SerialNumber: 'SerialNumber',
        LeakDetected: { LEAK_DETECTED: 1, LEAK_NOT_DETECTED: 0 },
        CurrentRelativeHumidity: 'CurrentRelativeHumidity',
        MotionDetected: 'MotionDetected',
        LockCurrentState: { SECURED: 1, UNSECURED: 0 },
        LockTargetState: { SECURED: 1, UNSECURED: 0 },
      },
      HapStatusError: class extends Error {},
      HAPStatus: { SERVICE_COMMUNICATION_FAILURE: -70402 },
    },
    on: jest.fn(),
    platformAccessory: jest.fn(),
    registerPlatformAccessories: jest.fn(),
    unregisterPlatformAccessories: jest.fn(),
    updatePlatformAccessories: jest.fn(),
  };
}

function createPlatform(configOverrides: Partial<NeakasaPlatformConfig> = {}) {
  const log = createMockLogger();
  const api = createMockApi();
  const config = {
    platform: 'Neakasa',
    name: 'Neakasa',
    username: 'test@example.com',
    password: 'testpassword',
    ...configOverrides,
  } as NeakasaPlatformConfig;

  const platform = new NeakasaPlatform(log as any, config as any, api as any);
  return { platform, log, api, config };
}

function getConfig(platform: NeakasaPlatform): NeakasaPlatformConfig {
  return (platform as any).config;
}

describe('NeakasaPlatform config sanitization', () => {
  describe('pollInterval', () => {
    it('should use default (60) when not specified', () => {
      const { platform } = createPlatform();
      expect(getConfig(platform).pollInterval).toBe(60);
    });

    it('should accept valid pollInterval', () => {
      const { platform } = createPlatform({ pollInterval: 120 });
      expect(getConfig(platform).pollInterval).toBe(120);
    });

    it('should warn and use default for pollInterval below minimum', () => {
      const { platform, log } = createPlatform({ pollInterval: 10 });
      expect(getConfig(platform).pollInterval).toBe(60);
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('pollInterval'));
    });

    it('should warn and use default for non-integer pollInterval', () => {
      const { platform, log } = createPlatform({ pollInterval: 45.5 as any });
      expect(getConfig(platform).pollInterval).toBe(60);
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('pollInterval'));
    });

    it('should accept minimum pollInterval of 30', () => {
      const { platform } = createPlatform({ pollInterval: 30 });
      expect(getConfig(platform).pollInterval).toBe(30);
    });
  });

  describe('recordDays', () => {
    it('should use default (7) when not specified', () => {
      const { platform } = createPlatform();
      expect(getConfig(platform).recordDays).toBe(7);
    });

    it('should accept valid recordDays', () => {
      const { platform } = createPlatform({ recordDays: 14 });
      expect(getConfig(platform).recordDays).toBe(14);
    });

    it('should warn and use default for recordDays above max (30)', () => {
      const { platform, log } = createPlatform({ recordDays: 31 });
      expect(getConfig(platform).recordDays).toBe(7);
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('recordDays'));
    });

    it('should warn and use default for recordDays below min (1)', () => {
      const { platform, log } = createPlatform({ recordDays: 0 });
      expect(getConfig(platform).recordDays).toBe(7);
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('recordDays'));
    });
  });

  describe('catPresentLatchSeconds', () => {
    it('should use default (240) when not specified', () => {
      const { platform } = createPlatform();
      expect(getConfig(platform).catPresentLatchSeconds).toBe(240);
    });

    it('should accept 0 to disable latching', () => {
      const { platform } = createPlatform({ catPresentLatchSeconds: 0 });
      expect(getConfig(platform).catPresentLatchSeconds).toBe(0);
    });

    it('should warn and use default for negative values', () => {
      const { platform, log } = createPlatform({ catPresentLatchSeconds: -5 });
      expect(getConfig(platform).catPresentLatchSeconds).toBe(240);
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('catPresentLatchSeconds'));
    });
  });

  describe('startupBehavior', () => {
    it('should default to "immediate"', () => {
      const { platform } = createPlatform();
      expect(getConfig(platform).startupBehavior).toBe('immediate');
    });

    it('should accept "skipInitialUpdate"', () => {
      const { platform } = createPlatform({ startupBehavior: 'skipInitialUpdate' });
      expect(getConfig(platform).startupBehavior).toBe('skipInitialUpdate');
    });

    it('should warn and use default for invalid value', () => {
      const { platform, log } = createPlatform({ startupBehavior: 'bogus' as any });
      expect(getConfig(platform).startupBehavior).toBe('immediate');
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('startupBehavior'));
    });
  });

  describe('feature flags', () => {
    it('should default all features to false', () => {
      const { platform } = createPlatform();
      const config = getConfig(platform);
      expect(config.showChildLock).toBe(false);
      expect(config.showEmptyBin).toBe(false);
      expect(config.showCatSensors).toBe(false);
      expect(config.showFaultSensor).toBe(false);
      expect(config.useImperialUnits).toBe(false);
    });

    it('should respect explicitly enabled features', () => {
      const { platform } = createPlatform({
        showChildLock: true,
        showCatSensors: true,
      });
      const config = getConfig(platform);
      expect(config.showChildLock).toBe(true);
      expect(config.showCatSensors).toBe(true);
      expect(config.showEmptyBin).toBe(false);
    });
  });

  describe('username trimming', () => {
    it('should trim whitespace from username', () => {
      const { platform } = createPlatform({ username: '  test@example.com  ' });
      expect(getConfig(platform).username).toBe('test@example.com');
    });
  });

  describe('startupDelaySeconds', () => {
    it('should default to 0', () => {
      const { platform } = createPlatform();
      expect(getConfig(platform).startupDelaySeconds).toBe(0);
    });

    it('should accept valid delay', () => {
      const { platform } = createPlatform({ startupDelaySeconds: 10 });
      expect(getConfig(platform).startupDelaySeconds).toBe(10);
    });

    it('should warn and use 0 for negative values', () => {
      const { platform, log } = createPlatform({ startupDelaySeconds: -3 });
      expect(getConfig(platform).startupDelaySeconds).toBe(0);
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('startupDelaySeconds'));
    });
  });
});

describe('NeakasaPlatform defaults and profiles', () => {
  describe('defaults layer', () => {
    it('should merge defaults into top-level config', () => {
      const { platform } = createPlatform({
        pollInterval: 60,
        defaults: {
          pollInterval: 90,
          showChildLock: true,
        },
      });
      const config = getConfig(platform);
      // defaults layer overrides top-level
      expect(config.pollInterval).toBe(90);
      expect(config.showChildLock).toBe(true);
    });

    it('should ignore invalid defaults', () => {
      const { platform, log } = createPlatform({
        defaults: 'not-an-object' as any,
      });
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('defaults'));
    });
  });

  describe('profiles', () => {
    it('should validate and store profiles', () => {
      const { platform } = createPlatform({
        profiles: {
          'quiet': { showSilentMode: true, pollInterval: 120 },
          'full': { showCatSensors: true, showFaultSensor: true },
        },
      });
      const config = getConfig(platform);
      expect(config.profiles).toBeDefined();
      expect(Object.keys(config.profiles!)).toEqual(['quiet', 'full']);
    });

    it('should warn on empty profile name', () => {
      const { log } = createPlatform({
        profiles: {
          '': { showSilentMode: true },
          'valid': { showCatSensors: true },
        },
      });
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('empty profile name'));
    });

    it('should ignore invalid profiles object', () => {
      const { platform, log } = createPlatform({
        profiles: 'bad' as any,
      });
      expect(getConfig(platform).profiles).toEqual({});
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('profiles'));
    });
  });

  describe('deviceOverrides', () => {
    it('should validate device overrides', () => {
      const { platform } = createPlatform({
        deviceOverrides: [
          { iotId: 'device-1', name: 'Kitchen Litter Box', showChildLock: true },
          { iotId: 'device-2', hidden: true },
        ],
      });
      const config = getConfig(platform);
      expect(config.deviceOverrides).toHaveLength(2);
      expect(config.deviceOverrides![0].iotId).toBe('device-1');
      expect(config.deviceOverrides![0].name).toBe('Kitchen Litter Box');
      expect(config.deviceOverrides![1].hidden).toBe(true);
    });

    it('should warn on missing iotId', () => {
      const { log } = createPlatform({
        deviceOverrides: [
          { iotId: '', name: 'Bad' } as any,
        ],
      });
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('iotId'));
    });

    it('should warn on duplicate iotId', () => {
      const { log } = createPlatform({
        deviceOverrides: [
          { iotId: 'device-1' },
          { iotId: 'device-1' },
        ],
      });
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('duplicate'));
    });

    it('should warn when override references unknown profile', () => {
      const { log } = createPlatform({
        profiles: { 'known': { showChildLock: true } },
        deviceOverrides: [
          { iotId: 'device-1', profile: 'unknown' },
        ],
      });
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('unknown'));
    });

    it('should accept valid profile reference', () => {
      const { platform } = createPlatform({
        profiles: { 'quiet': { showSilentMode: true } },
        deviceOverrides: [
          { iotId: 'device-1', profile: 'quiet' },
        ],
      });
      const overrides = getConfig(platform).deviceOverrides!;
      expect(overrides[0].profile).toBe('quiet');
    });
  });
});

describe('NeakasaPlatform config merging', () => {
  it('should resolve device config with profile and override layers', () => {
    const { platform } = createPlatform({
      pollInterval: 60,
      showChildLock: false,
      profiles: {
        'custom': {
          pollInterval: 90,
          showChildLock: true,
          showCatSensors: true,
        },
      },
      deviceOverrides: [
        {
          iotId: 'device-1',
          profile: 'custom',
          pollInterval: 120,
        },
      ],
    });

    // Access private method through any cast
    const resolved = (platform as any).getResolvedDeviceConfig('device-1');

    // Device override pollInterval (120) wins over profile (90) and top-level (60)
    expect(resolved.pollInterval).toBe(120);
    // Profile's showChildLock (true) should apply since device override doesn't override it
    expect(resolved.features.showChildLock).toBe(true);
    // Profile's showCatSensors (true) should apply
    expect(resolved.features.showCatSensors).toBe(true);
    // Unset features remain false
    expect(resolved.features.showFaultSensor).toBe(false);
  });

  it('should fall back to top-level config when no override exists', () => {
    const { platform } = createPlatform({
      pollInterval: 45,
      showChildLock: true,
    });

    const resolved = (platform as any).getResolvedDeviceConfig('nonexistent-device');
    expect(resolved.pollInterval).toBe(45);
    expect(resolved.features.showChildLock).toBe(true);
  });

  it('should use defaults layer between top-level and profile', () => {
    const { platform } = createPlatform({
      pollInterval: 60,
      defaults: {
        showFaultSensor: true,
        recordDays: 14,
      },
      profiles: {
        'fast': { pollInterval: 30 },
      },
      deviceOverrides: [
        { iotId: 'device-1', profile: 'fast' },
      ],
    });

    const resolved = (platform as any).getResolvedDeviceConfig('device-1');
    // Profile overrides pollInterval
    expect(resolved.pollInterval).toBe(30);
    // defaults layer set showFaultSensor
    expect(resolved.features.showFaultSensor).toBe(true);
    // defaults layer set recordDays
    expect(resolved.recordDays).toBe(14);
  });
});

describe('NeakasaPlatform missing credentials', () => {
  it('should log error when username is missing', () => {
    const { log } = createPlatform({ username: '' });
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('Username and password'));
  });

  it('should log error when password is missing', () => {
    const { log } = createPlatform({ password: '' });
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('Username and password'));
  });
});
