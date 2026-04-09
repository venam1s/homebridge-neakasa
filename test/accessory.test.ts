import { NeakasaAccessory } from '../src/accessory';
import { DeviceData, NeakasaPlatformConfig, BucketStatus, SandLevel } from '../src/types';

// --- Mocks ---

function createMockCharacteristic() {
  return {
    value: undefined as any,
    onSet: jest.fn().mockReturnThis(),
    onGet: jest.fn().mockReturnThis(),
  };
}

function createMockService(subtype?: string): any {
  const chars = new Map<string, ReturnType<typeof createMockCharacteristic>>();
  const service: any = {
    subtype,
    setCharacteristic: jest.fn().mockReturnThis(),
    getCharacteristic: jest.fn((char: string) => {
      if (!chars.has(char)) {
        chars.set(char, createMockCharacteristic());
      }
      return chars.get(char)!;
    }),
    updateCharacteristic: jest.fn((char: string, value: any) => {
      const c = chars.get(char);
      if (c) {
        c.value = value;
      }
      return service;
    }),
    _chars: chars,
  };
  return service;
}

function createMockPlatform(configOverrides: Partial<NeakasaPlatformConfig> = {}) {
  const Characteristic = {
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
  };

  const Service = {
    AccessoryInformation: 'AccessoryInformation',
    Switch: 'Switch',
    ContactSensor: 'ContactSensor',
    OccupancySensor: 'OccupancySensor',
    FilterMaintenance: 'FilterMaintenance',
    LeakSensor: 'LeakSensor',
    HumiditySensor: 'HumiditySensor',
    MotionSensor: 'MotionSensor',
    LockMechanism: 'LockMechanism',
  };

  return {
    Characteristic,
    Service,
    log: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
    neakasaApi: {
      setDeviceProperties: jest.fn().mockResolvedValue(undefined),
      cleanNow: jest.fn().mockResolvedValue(undefined),
      sandLeveling: jest.fn().mockResolvedValue(undefined),
      emptyBin: jest.fn().mockResolvedValue(undefined),
      getDeviceProperties: jest.fn().mockResolvedValue({ bucketStatus: { value: 0 } }),
    },
    api: {
      hap: {
        HapStatusError: class extends Error {},
        HAPStatus: { SERVICE_COMMUNICATION_FAILURE: -70402 },
      },
    },
  };
}

function createMockAccessory() {
  const serviceMap = new Map<string, any>();
  const servicesArray: any[] = [];

  const infoService = createMockService('AccessoryInformation');
  serviceMap.set('AccessoryInformation', infoService);
  servicesArray.push(infoService);

  return {
    services: servicesArray,
    // Expose map for test assertions
    _serviceMap: serviceMap,
    get context() { return { device: {} }; },
    getService: jest.fn((nameOrSubtype: string) => serviceMap.get(nameOrSubtype)),
    addService: jest.fn((_type: string, _name: string, subtype: string) => {
      const svc = createMockService(subtype);
      serviceMap.set(subtype, svc);
      servicesArray.push(svc);
      return svc;
    }),
    removeService: jest.fn((svc: any) => {
      if (svc.subtype) {
        serviceMap.delete(svc.subtype);
      }
      const idx = servicesArray.indexOf(svc);
      if (idx > -1) {
        servicesArray.splice(idx, 1);
      }
    }),
  };
}

function createDefaultConfig(overrides: Partial<NeakasaPlatformConfig> = {}): NeakasaPlatformConfig {
  return {
    platform: 'Neakasa',
    name: 'Neakasa',
    username: 'test@test.com',
    password: 'test',
    pollInterval: 60,
    recordDays: 7,
    catPresentLatchSeconds: 240,
    catVisitLatchSeconds: 90,
    recentlyUsedMinutes: 15,
    showAutoLevelClean: false,
    showChildLock: false,
    showEmptyBin: false,
    showAutoBury: false,
    showAutoLevel: false,
    showSilentMode: false,
    showUnstoppableCycle: false,
    showAutoRecovery: false,
    showYoungCatMode: false,
    showBinStateSensor: false,
    showWifiSensor: false,
    showCatSensors: false,
    showCatVisitSensor: false,
    showRecentlyUsedSensor: false,
    showSandLevelSensor: false,
    showFaultSensor: false,
    useImperialUnits: false,
    ...overrides,
  } as NeakasaPlatformConfig;
}

function createDeviceData(overrides: Partial<DeviceData> = {}): DeviceData {
  return {
    binFullWaitReset: false,
    cleanCfg: { active: 0 },
    youngCatMode: false,
    childLockOnOff: false,
    autoBury: false,
    autoLevel: false,
    silentMode: false,
    autoForceInit: false,
    bIntrptRangeDet: false,
    sandLevelPercent: 50,
    wifiRssi: -65,
    bucketStatus: 0,
    room_of_bin: 0,
    sandLevelState: 2,
    stayTime: 0,
    lastUse: 0,
    cat_list: [],
    record_list: [],
    ...overrides,
  };
}

function createAccessory(configOverrides: Partial<NeakasaPlatformConfig> = {}) {
  const platform = createMockPlatform(configOverrides);
  const accessory = createMockAccessory();
  const config = createDefaultConfig(configOverrides);
  const neakasaAccessory = new NeakasaAccessory(
    platform as any,
    accessory as any,
    'test-iot-id',
    'Test Litter Box',
    config,
  );
  // Shorthand to the Characteristic mock objects for assertions
  const C = platform.Characteristic;
  return { neakasaAccessory, platform, accessory, C };
}

// --- Tests ---

describe('NeakasaAccessory', () => {
  describe('service creation', () => {
    it('should create core services with default config', () => {
      const { accessory } = createAccessory();
      const serviceNames = Array.from(accessory._serviceMap.keys());

      // Core services always present
      expect(serviceNames).toContain('bin-full');
      expect(serviceNames).toContain('auto-clean');
      expect(serviceNames).toContain('clean-now');
      expect(serviceNames).toContain('level-now');
      expect(serviceNames).toContain('device-status');
      expect(serviceNames).toContain('last-action');
      expect(serviceNames).toContain('cat-present');
      expect(serviceNames).toContain('sand-level');
    });

    it('should NOT create optional services when flags are false', () => {
      const { accessory } = createAccessory();
      const serviceNames = Array.from(accessory._serviceMap.keys());

      expect(serviceNames).not.toContain('child-lock');
      expect(serviceNames).not.toContain('empty-bin');
      expect(serviceNames).not.toContain('auto-bury');
      expect(serviceNames).not.toContain('auto-level');
      expect(serviceNames).not.toContain('silent-mode');
      expect(serviceNames).not.toContain('unstoppable-cycle');
      expect(serviceNames).not.toContain('auto-recovery');
      expect(serviceNames).not.toContain('young-cat-mode');
      expect(serviceNames).not.toContain('bin-state');
      expect(serviceNames).not.toContain('wifi-signal');
      expect(serviceNames).not.toContain('sand-level-state');
      expect(serviceNames).not.toContain('fault-alert');
      expect(serviceNames).not.toContain('cat-visit');
      expect(serviceNames).not.toContain('recently-used');
      expect(serviceNames).not.toContain('auto-level-clean');
    });

    it('should create child lock service when enabled', () => {
      const { accessory } = createAccessory({ showChildLock: true });
      expect(accessory._serviceMap.has('child-lock')).toBe(true);
    });

    it('should create empty bin service when enabled', () => {
      const { accessory } = createAccessory({ showEmptyBin: true });
      expect(accessory._serviceMap.has('empty-bin')).toBe(true);
    });

    it('should create all optional switches when enabled', () => {
      const { accessory } = createAccessory({
        showAutoBury: true,
        showAutoLevel: true,
        showSilentMode: true,
        showUnstoppableCycle: true,
        showAutoRecovery: true,
        showYoungCatMode: true,
        showAutoLevelClean: true,
      });
      expect(accessory._serviceMap.has('auto-bury')).toBe(true);
      expect(accessory._serviceMap.has('auto-level')).toBe(true);
      expect(accessory._serviceMap.has('silent-mode')).toBe(true);
      expect(accessory._serviceMap.has('unstoppable-cycle')).toBe(true);
      expect(accessory._serviceMap.has('auto-recovery')).toBe(true);
      expect(accessory._serviceMap.has('young-cat-mode')).toBe(true);
      expect(accessory._serviceMap.has('auto-level-clean')).toBe(true);
    });

    it('should create all optional sensors when enabled', () => {
      const { accessory } = createAccessory({
        showBinStateSensor: true,
        showWifiSensor: true,
        showSandLevelSensor: true,
        showFaultSensor: true,
        showCatVisitSensor: true,
        showRecentlyUsedSensor: true,
      });
      expect(accessory._serviceMap.has('bin-state')).toBe(true);
      expect(accessory._serviceMap.has('wifi-signal')).toBe(true);
      expect(accessory._serviceMap.has('sand-level-state')).toBe(true);
      expect(accessory._serviceMap.has('fault-alert')).toBe(true);
      expect(accessory._serviceMap.has('cat-visit')).toBe(true);
      expect(accessory._serviceMap.has('recently-used')).toBe(true);
    });
  });

  describe('updateData', () => {
    it('should update bin full sensor', async () => {
      const { neakasaAccessory, accessory, C } = createAccessory();
      const data = createDeviceData({ binFullWaitReset: true });

      await neakasaAccessory.updateData(data);

      const binSensor = accessory._serviceMap.get('bin-full')!;
      expect(binSensor.updateCharacteristic).toHaveBeenCalledWith(
        C.OccupancyDetected,
        C.OccupancyDetected.OCCUPANCY_DETECTED,
      );
    });

    it('should update litter level', async () => {
      const { neakasaAccessory, accessory } = createAccessory();
      const data = createDeviceData({ sandLevelPercent: 75, sandLevelState: SandLevel.SUFFICIENT });

      await neakasaAccessory.updateData(data);

      const filterService = accessory._serviceMap.get('sand-level')!;
      expect(filterService.updateCharacteristic).toHaveBeenCalledWith('FilterLifeLevel', 75);
    });

    it('should indicate filter change when sand is insufficient', async () => {
      const { neakasaAccessory, accessory, C } = createAccessory();
      const data = createDeviceData({ sandLevelState: SandLevel.INSUFFICIENT });

      await neakasaAccessory.updateData(data);

      const filterService = accessory._serviceMap.get('sand-level')!;
      expect(filterService.updateCharacteristic).toHaveBeenCalledWith(
        C.FilterChangeIndication,
        C.FilterChangeIndication.CHANGE_FILTER,
      );
    });

    it('should set status to active during cleaning', async () => {
      const { neakasaAccessory, accessory } = createAccessory();
      const data = createDeviceData({ bucketStatus: 1 }); // Cleaning

      await neakasaAccessory.updateData(data);

      const statusSensor = accessory._serviceMap.get('device-status')!;
      expect(statusSensor.updateCharacteristic).toHaveBeenCalledWith('Name', 'Cleaning');
    });

    it('should detect cat present via bucketStatus', async () => {
      const { neakasaAccessory, accessory, C } = createAccessory();
      const data = createDeviceData({ bucketStatus: 4 }); // Cat Present

      await neakasaAccessory.updateData(data);

      const catSensor = accessory._serviceMap.get('cat-present')!;
      expect(catSensor.updateCharacteristic).toHaveBeenCalledWith(
        C.OccupancyDetected,
        C.OccupancyDetected.OCCUPANCY_DETECTED,
      );
    });

    it('should detect cat present via latch window', async () => {
      const { neakasaAccessory, accessory, C } = createAccessory({ catPresentLatchSeconds: 300 });
      const recentLastUse = Math.floor(Date.now() / 1000) - 30; // 30s ago
      const data = createDeviceData({ bucketStatus: 0, lastUse: recentLastUse });

      await neakasaAccessory.updateData(data);

      const catSensor = accessory._serviceMap.get('cat-present')!;
      expect(catSensor.updateCharacteristic).toHaveBeenCalledWith(
        C.OccupancyDetected,
        C.OccupancyDetected.OCCUPANCY_DETECTED,
      );
    });

    it('should NOT detect cat present when latch expired', async () => {
      const { neakasaAccessory, accessory, C } = createAccessory({ catPresentLatchSeconds: 60 });
      const oldLastUse = Math.floor(Date.now() / 1000) - 120; // 2min ago, latch is 60s
      const data = createDeviceData({ bucketStatus: 0, lastUse: oldLastUse });

      await neakasaAccessory.updateData(data);

      const catSensor = accessory._serviceMap.get('cat-present')!;
      expect(catSensor.updateCharacteristic).toHaveBeenCalledWith(
        C.OccupancyDetected,
        C.OccupancyDetected.OCCUPANCY_NOT_DETECTED,
      );
    });

    it('should update optional switch states when enabled', async () => {
      const { neakasaAccessory, accessory, C } = createAccessory({
        showChildLock: true,
        showAutoBury: true,
        showAutoLevel: true,
        showSilentMode: true,
      });
      const data = createDeviceData({
        childLockOnOff: true,
        autoBury: true,
        autoLevel: true,
        silentMode: false,
      });

      await neakasaAccessory.updateData(data);

      const childLock = accessory._serviceMap.get('child-lock')!;
      expect(childLock.updateCharacteristic).toHaveBeenCalledWith(C.LockCurrentState, C.LockCurrentState.SECURED);

      const autoBury = accessory._serviceMap.get('auto-bury')!;
      expect(autoBury.updateCharacteristic).toHaveBeenCalledWith('On', true);

      const autoLevel = accessory._serviceMap.get('auto-level')!;
      expect(autoLevel.updateCharacteristic).toHaveBeenCalledWith('On', true);

      const silentMode = accessory._serviceMap.get('silent-mode')!;
      expect(silentMode.updateCharacteristic).toHaveBeenCalledWith('On', false);
    });

    it('should update WiFi sensor as humidity percentage', async () => {
      const { neakasaAccessory, accessory } = createAccessory({ showWifiSensor: true });
      const data = createDeviceData({ wifiRssi: -75 }); // should be 50%

      await neakasaAccessory.updateData(data);

      const wifiSensor = accessory._serviceMap.get('wifi-signal')!;
      expect(wifiSensor.updateCharacteristic).toHaveBeenCalledWith('CurrentRelativeHumidity', 50);
    });

    it('should update bin state sensor', async () => {
      const { neakasaAccessory, accessory, C } = createAccessory({ showBinStateSensor: true });
      const data = createDeviceData({ room_of_bin: 1 }); // Full

      await neakasaAccessory.updateData(data);

      const binState = accessory._serviceMap.get('bin-state')!;
      expect(binState.updateCharacteristic).toHaveBeenCalledWith(C.LeakDetected, C.LeakDetected.LEAK_DETECTED);
      expect(binState.updateCharacteristic).toHaveBeenCalledWith(C.Name, 'Full');
    });

    it('should trigger fault alert for fault statuses', async () => {
      const { neakasaAccessory, accessory, platform } = createAccessory({ showFaultSensor: true });
      const data = createDeviceData({ bucketStatus: 6 }); // Panels Missing

      await neakasaAccessory.updateData(data);

      const faultSensor = accessory._serviceMap.get('fault-alert')!;
      expect(faultSensor.updateCharacteristic).toHaveBeenCalledWith('MotionDetected', true);
      expect(platform.log.warn).toHaveBeenCalledWith(expect.stringContaining('fault'));
    });

    it('should NOT trigger fault for normal statuses', async () => {
      const { neakasaAccessory, accessory } = createAccessory({ showFaultSensor: true });
      const data = createDeviceData({ bucketStatus: 0 }); // Idle

      await neakasaAccessory.updateData(data);

      const faultSensor = accessory._serviceMap.get('fault-alert')!;
      expect(faultSensor.updateCharacteristic).toHaveBeenCalledWith('MotionDetected', false);
    });

    it('should update cat visit sensor when recent', async () => {
      const { neakasaAccessory, accessory, C } = createAccessory({
        showCatVisitSensor: true,
        catVisitLatchSeconds: 90,
      });
      const recentLastUse = Math.floor(Date.now() / 1000) - 30;
      const data = createDeviceData({ lastUse: recentLastUse });

      await neakasaAccessory.updateData(data);

      const catVisit = accessory._serviceMap.get('cat-visit')!;
      expect(catVisit.updateCharacteristic).toHaveBeenCalledWith(
        C.ContactSensorState,
        C.ContactSensorState.CONTACT_NOT_DETECTED,
      );
    });

    it('should update recently used sensor', async () => {
      const { neakasaAccessory, accessory, C } = createAccessory({
        showRecentlyUsedSensor: true,
        recentlyUsedMinutes: 15,
      });
      const recentLastUse = Math.floor(Date.now() / 1000) - 60; // 1 min ago
      const data = createDeviceData({ lastUse: recentLastUse });

      await neakasaAccessory.updateData(data);

      const recentlyUsed = accessory._serviceMap.get('recently-used')!;
      expect(recentlyUsed.updateCharacteristic).toHaveBeenCalledWith(
        C.OccupancyDetected,
        C.OccupancyDetected.OCCUPANCY_DETECTED,
      );
    });

    it('should create cat weight sensors dynamically', async () => {
      const { neakasaAccessory, accessory } = createAccessory({ showCatSensors: true });
      const data = createDeviceData({
        cat_list: [
          { id: 'cat1', name: 'Whiskers' },
          { id: 'cat2', name: 'Mittens' },
        ],
        record_list: [
          { cat_id: 'cat1', weight: 4.5, start_time: 1000, end_time: 2000 },
          { cat_id: 'cat2', weight: 3.2, start_time: 1000, end_time: 2000 },
        ],
      });

      await neakasaAccessory.updateData(data);

      expect(accessory._serviceMap.has('cat-cat1')).toBe(true);
      expect(accessory._serviceMap.has('cat-cat2')).toBe(true);
    });

    it('should display cat weight in imperial when enabled', async () => {
      const { neakasaAccessory, accessory } = createAccessory({
        showCatSensors: true,
        useImperialUnits: true,
      });
      const data = createDeviceData({
        cat_list: [{ id: 'cat1', name: 'Whiskers' }],
        record_list: [{ cat_id: 'cat1', weight: 4.5, start_time: 1000, end_time: 2000 }],
      });

      await neakasaAccessory.updateData(data);

      const catSensor = accessory._serviceMap.get('cat-cat1')!;
      // 4.5 kg * 2.20462 ≈ 9.92 → rounds to 10
      expect(catSensor.updateCharacteristic).toHaveBeenCalledWith('CurrentRelativeHumidity', 10);
    });

    it('should remove cat sensors when showCatSensors disabled', async () => {
      const { neakasaAccessory, accessory } = createAccessory({ showCatSensors: true });

      // First update with cats
      await neakasaAccessory.updateData(createDeviceData({
        cat_list: [{ id: 'cat1', name: 'Whiskers' }],
        record_list: [{ cat_id: 'cat1', weight: 4.5, start_time: 1000, end_time: 2000 }],
      }));
      expect(accessory._serviceMap.has('cat-cat1')).toBe(true);

      // Second update with empty cat list removes them
      await neakasaAccessory.updateData(createDeviceData({
        cat_list: [],
        record_list: [],
      }));
      expect(accessory._serviceMap.has('cat-cat1')).toBe(false);
    });

    it('should update sand level state sensor name', async () => {
      const { neakasaAccessory, accessory } = createAccessory({ showSandLevelSensor: true });
      const data = createDeviceData({ sandLevelState: SandLevel.OVERFILLED });

      await neakasaAccessory.updateData(data);

      const sandSensor = accessory._serviceMap.get('sand-level-state')!;
      expect(sandSensor.updateCharacteristic).toHaveBeenCalledWith('Name', 'Overfilled');
    });
  });

  describe('switch handlers', () => {
    it('should set auto clean via API', async () => {
      const { neakasaAccessory, platform } = createAccessory();

      await neakasaAccessory.updateData(createDeviceData({ cleanCfg: { active: 0 } }));
      await (neakasaAccessory as any).setAutoClean(true);

      expect(platform.neakasaApi.setDeviceProperties).toHaveBeenCalledWith(
        'test-iot-id',
        { cleanCfg: expect.objectContaining({ active: 1 }) },
      );
    });

    it('should trigger clean now via API', async () => {
      const { neakasaAccessory, platform } = createAccessory();

      await (neakasaAccessory as any).cleanNow(true);

      expect(platform.neakasaApi.cleanNow).toHaveBeenCalledWith('test-iot-id');
    });

    it('should not trigger clean now when value is false', async () => {
      const { neakasaAccessory, platform } = createAccessory();

      await (neakasaAccessory as any).cleanNow(false);

      expect(platform.neakasaApi.cleanNow).not.toHaveBeenCalled();
    });

    it('should trigger leveling via API', async () => {
      const { neakasaAccessory, platform } = createAccessory();

      await (neakasaAccessory as any).levelNow(true);

      expect(platform.neakasaApi.sandLeveling).toHaveBeenCalledWith('test-iot-id');
    });

    it('should block clean when cat is present', async () => {
      const { neakasaAccessory, platform } = createAccessory();
      platform.neakasaApi.getDeviceProperties.mockResolvedValue({
        bucketStatus: { value: 4 }, // Cat Present
      });

      await (neakasaAccessory as any).cleanNow(true);

      expect(platform.neakasaApi.cleanNow).not.toHaveBeenCalled();
      expect(platform.log.warn).toHaveBeenCalledWith(expect.stringContaining('Blocked'));
    });

    it('should block leveling when cat is present', async () => {
      const { neakasaAccessory, platform } = createAccessory();
      platform.neakasaApi.getDeviceProperties.mockResolvedValue({
        bucketStatus: { value: 4 },
      });

      await (neakasaAccessory as any).levelNow(true);

      expect(platform.neakasaApi.sandLeveling).not.toHaveBeenCalled();
      expect(platform.log.warn).toHaveBeenCalledWith(expect.stringContaining('Blocked'));
    });
  });

  describe('auto level and clean sync', () => {
    it('should set both autoLevel and cleanCfg together', async () => {
      const { neakasaAccessory, platform } = createAccessory({ showAutoLevelClean: true });
      await neakasaAccessory.updateData(createDeviceData());

      await (neakasaAccessory as any).setAutoLevelAndClean(true);

      expect(platform.neakasaApi.setDeviceProperties).toHaveBeenCalledWith(
        'test-iot-id',
        expect.objectContaining({
          cleanCfg: expect.objectContaining({ active: 1 }),
          autoLevel: 1,
        }),
      );
    });
  });

  describe('empty bin confirmation', () => {
    it('should require double-tap to confirm empty bin', async () => {
      const { neakasaAccessory, platform } = createAccessory({ showEmptyBin: true });

      // First tap arms confirmation
      await (neakasaAccessory as any).emptyBin(true);
      expect(platform.neakasaApi.setDeviceProperties).not.toHaveBeenCalled();
      expect(platform.log.warn).toHaveBeenCalledWith(expect.stringContaining('confirmation armed'));

      // Second tap within window confirms
      await (neakasaAccessory as any).emptyBin(true);
      expect(platform.neakasaApi.emptyBin).toHaveBeenCalledWith('test-iot-id');
    });
  });

  describe('all bucket statuses', () => {
    const statuses = [
      [0, 'Idle'],
      [1, 'Cleaning'],
      [2, 'Leveling'],
      [3, 'Flipover'],
      [4, 'Cat Present'],
      [5, 'Paused'],
      [6, 'Panels Missing'],
      [7, 'Interrupted'],
    ] as const;

    it.each(statuses)('should display status %i as "%s"', async (status, name) => {
      const { neakasaAccessory, accessory } = createAccessory();
      await neakasaAccessory.updateData(createDeviceData({ bucketStatus: status }));

      const statusSensor = accessory._serviceMap.get('device-status')!;
      expect(statusSensor.updateCharacteristic).toHaveBeenCalledWith('Name', name);
    });
  });
});
