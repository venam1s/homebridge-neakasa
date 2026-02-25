import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { NeakasaAccessory } from './accessory';
import { NeakasaAPI } from './api';
import {
  NeakasaPlatformConfig,
  NeakasaDevice,
  DeviceData,
  DeviceOverrideConfig,
  FeatureVisibilityConfig,
  StartupBehavior,
} from './types';

const MIN_POLL_INTERVAL_SECONDS = 30;
const DEFAULT_POLL_INTERVAL_SECONDS = 60;
const DEFAULT_STARTUP_BEHAVIOR: StartupBehavior = 'immediate';

const FEATURE_KEYS: Array<keyof FeatureVisibilityConfig> = [
  'showChildLock',
  'showEmptyBin',
  'showAutoBury',
  'showAutoLevel',
  'showSilentMode',
  'showUnstoppableCycle',
  'showAutoRecovery',
  'showYoungCatMode',
  'showBinStateSensor',
  'showWifiSensor',
  'showCatSensors',
  'showSandLevelSensor',
  'showFaultSensor',
  'useImperialUnits',
];

const FEATURE_LABELS: Record<keyof FeatureVisibilityConfig, string> = {
  showChildLock: 'Child Lock',
  showEmptyBin: 'Empty Bin',
  showAutoBury: 'Auto Bury',
  showAutoLevel: 'Auto Level',
  showSilentMode: 'Silent Mode',
  showUnstoppableCycle: 'Unstoppable Cycle',
  showAutoRecovery: 'Auto Recovery',
  showYoungCatMode: 'Young Cat Mode',
  showBinStateSensor: 'Bin State Sensor',
  showWifiSensor: 'WiFi Signal Sensor',
  showCatSensors: 'Cat Weight Sensors',
  showSandLevelSensor: 'Sand Level Sensor',
  showFaultSensor: 'Fault Sensor',
  useImperialUnits: 'Imperial Units',
};

export class NeakasaPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  public readonly accessories: PlatformAccessory[] = [];
  public readonly neakasaApi: NeakasaAPI;

  private readonly deviceAccessories: Map<string, NeakasaAccessory> = new Map();
  private readonly devicePollIntervals: Map<string, number> = new Map();
  private readonly lastPolledAt: Map<string, number> = new Map();
  private pollInterval?: NodeJS.Timeout;
  private startupTimeout?: NodeJS.Timeout;
  private readonly config: NeakasaPlatformConfig;

  constructor(
    public readonly log: Logger,
    config: PlatformConfig,
    public readonly api: API,
  ) {
    this.config = this.sanitizeConfig(config as NeakasaPlatformConfig);
    this.neakasaApi = new NeakasaAPI(this.log);

    if (!this.config.username || !this.config.password) {
      this.log.error('Username and password are required in config');
      return;
    }

    this.log.debug('Finished initializing platform:', this.config.name);

    this.api.on('didFinishLaunching', () => {
      this.log.debug('Executed didFinishLaunching callback');
      this.logConfigStartupChecks();
      this.discoverDevices();
    });

    this.api.on('shutdown', () => {
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
      }

      if (this.startupTimeout) {
        clearTimeout(this.startupTimeout);
      }
    });
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  async discoverDevices(): Promise<void> {
    try {
      this.log.info('Connecting to Neakasa API...');
      await this.neakasaApi.connect(this.config.username, this.config.password);
      this.log.info('Successfully connected to Neakasa API');

      const devices = await this.neakasaApi.getDevices();
      this.log.info(`Found ${devices.length} device(s)`);

      const activeIotIds = new Set<string>();
      const defaultDisplayName = this.config.deviceName || 'Neakasa M1';

      for (const device of devices) {
        const override = this.getDeviceOverride(device.iotId);

        if (override?.hidden === true) {
          this.log.info(`Skipping hidden device ${device.deviceName} (${device.iotId})`);
          this.removeAccessoryByIotId(device.iotId);
          continue;
        }

        activeIotIds.add(device.iotId);
        this.devicePollIntervals.set(device.iotId, override?.pollInterval || this.config.pollInterval || DEFAULT_POLL_INTERVAL_SECONDS);

        const displayName = override?.name || device.deviceName || defaultDisplayName;
        const accessoryConfig = this.buildAccessoryConfig(device.iotId);

        const uuid = this.api.hap.uuid.generate(device.iotId);
        const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

        if (existingAccessory) {
          this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
          existingAccessory.context.device = device;
          this.api.updatePlatformAccessories([existingAccessory]);

          const accessory = new NeakasaAccessory(this, existingAccessory, device.iotId, displayName, accessoryConfig);
          this.deviceAccessories.set(device.iotId, accessory);
        } else {
          this.log.info('Adding new accessory:', displayName);
          const accessory = new this.api.platformAccessory(displayName, uuid);
          accessory.context.device = device;

          const neakasaAccessory = new NeakasaAccessory(this, accessory, device.iotId, displayName, accessoryConfig);
          this.deviceAccessories.set(device.iotId, neakasaAccessory);

          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          this.accessories.push(accessory);
        }
      }

      // Remove devices that no longer exist or are hidden by config.
      const accessoriesToRemove = this.accessories.filter(accessory => {
        const iotId = accessory.context.device?.iotId;
        return iotId && !activeIotIds.has(iotId);
      });

      if (accessoriesToRemove.length > 0) {
        this.log.info(`Removing ${accessoriesToRemove.length} obsolete accessory(ies)`);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, accessoriesToRemove);

        for (const accessory of accessoriesToRemove) {
          const iotId = accessory.context.device?.iotId;
          if (iotId) {
            this.deviceAccessories.delete(iotId);
            this.devicePollIntervals.delete(iotId);
            this.lastPolledAt.delete(iotId);
          }

          const index = this.accessories.indexOf(accessory);
          if (index > -1) {
            this.accessories.splice(index, 1);
          }
        }
      }

      this.logDetectedDeviceSummary(devices);

      // Start polling for updates.
      this.startPolling();
    } catch (error) {
      this.log.error('Failed to discover devices:', error);
    }
  }

  private startPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    const tickerSeconds = this.getSchedulerTickSeconds();
    this.log.info(`Starting polling scheduler every ${tickerSeconds} seconds`);

    if (this.config.startupBehavior === 'skipInitialUpdate') {
      this.log.info('Startup behavior: skipping initial refresh, waiting for normal poll schedule');
    } else {
      const delaySeconds = this.config.startupDelaySeconds || 0;
      if (delaySeconds > 0) {
        this.log.info(`Startup behavior: initial refresh delayed by ${delaySeconds} seconds`);
        this.startupTimeout = setTimeout(() => {
          this.updateAllDueDevices(true);
        }, delaySeconds * 1000);
      } else {
        this.updateAllDueDevices(true);
      }
    }

    this.pollInterval = setInterval(() => {
      this.updateAllDueDevices(false);
    }, tickerSeconds * 1000);
  }

  private async updateAllDueDevices(forceAll: boolean): Promise<void> {
    const now = Date.now();

    for (const [iotId, accessory] of this.deviceAccessories.entries()) {
      const intervalSeconds = this.devicePollIntervals.get(iotId) || this.config.pollInterval || DEFAULT_POLL_INTERVAL_SECONDS;
      const lastPolledAt = this.lastPolledAt.get(iotId) || 0;

      if (!forceAll && now - lastPolledAt < intervalSeconds * 1000) {
        continue;
      }

      this.lastPolledAt.set(iotId, now);

      try {
        await this.updateDevice(iotId, accessory);
      } catch (error) {
        this.log.error(`Failed to update device ${iotId}:`, error);

        // Try to reconnect if it's an auth error.
        if (error instanceof Error && error.message.includes('not connected')) {
          this.log.warn('Attempting to reconnect to Neakasa API...');
          try {
            await this.neakasaApi.connect(this.config.username, this.config.password);
            this.log.info('Reconnected successfully, retrying device update...');
            await this.updateDevice(iotId, accessory);
          } catch (reconnectError) {
            this.log.error('Failed to reconnect:', reconnectError);
          }
        }
      }
    }
  }

  private async updateDevice(iotId: string, accessory: NeakasaAccessory): Promise<void> {
    const properties = await this.neakasaApi.getDeviceProperties(iotId);

    // Get records for cat data.
    const deviceContext = this.accessories.find(acc => acc.context.device?.iotId === iotId)?.context.device;
    let catList: any[] = [];
    let recordList: any[] = [];

    if (deviceContext) {
      try {
        const records = await this.neakasaApi.getRecords(deviceContext.deviceName);
        catList = records.cat_list || [];
        recordList = records.record_list || [];
      } catch (recordError) {
        this.log.debug(`Could not fetch records for ${deviceContext.deviceName}: ${recordError}`);
      }
    }

    const deviceData: DeviceData = {
      binFullWaitReset: properties.binFullWaitReset?.value === 1,
      cleanCfg: properties.cleanCfg?.value,
      youngCatMode: properties.youngCatMode?.value === 1,
      childLockOnOff: properties.childLockOnOff?.value === 1,
      autoBury: properties.autoBury?.value === 1,
      autoLevel: properties.autoLevel?.value === 1,
      silentMode: properties.silentMode?.value === 1,
      autoForceInit: properties.autoForceInit?.value === 1,
      bIntrptRangeDet: properties.bIntrptRangeDet?.value === 1,
      sandLevelPercent: properties.Sand?.value?.percent || 0,
      wifiRssi: properties.NetWorkStatus?.value?.WiFi_RSSI || 0,
      bucketStatus: properties.bucketStatus?.value || 0,
      room_of_bin: properties.room_of_bin?.value || 0,
      sandLevelState: properties.Sand?.value?.level || 0,
      stayTime: properties.catLeft?.value?.stayTime || 0,
      lastUse: properties.catLeft?.time || 0,
      cat_list: catList,
      record_list: recordList,
    };

    await accessory.updateData(deviceData);
  }

  private sanitizeConfig(rawConfig: NeakasaPlatformConfig): NeakasaPlatformConfig {
    const config: NeakasaPlatformConfig = {
      ...rawConfig,
      username: typeof rawConfig.username === 'string' ? rawConfig.username.trim() : rawConfig.username,
      password: typeof rawConfig.password === 'string' ? rawConfig.password : rawConfig.password,
      pollInterval: this.validatePollInterval(rawConfig.pollInterval, 'pollInterval') || DEFAULT_POLL_INTERVAL_SECONDS,
      startupBehavior: this.validateStartupBehavior(rawConfig.startupBehavior),
      startupDelaySeconds: this.validateStartupDelay(rawConfig.startupDelaySeconds),
      deviceOverrides: this.validateDeviceOverrides(rawConfig.deviceOverrides, rawConfig.pollInterval),
    };

    return config;
  }

  private validatePollInterval(value: number | undefined, context: string): number | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (!Number.isInteger(value) || value < MIN_POLL_INTERVAL_SECONDS) {
      this.log.warn(`${context} must be an integer >= ${MIN_POLL_INTERVAL_SECONDS}; using default`);
      return undefined;
    }

    return value;
  }

  private validateStartupBehavior(value: StartupBehavior | undefined): StartupBehavior {
    if (value === undefined || value === null) {
      return DEFAULT_STARTUP_BEHAVIOR;
    }

    if (value !== 'immediate' && value !== 'skipInitialUpdate') {
      this.log.warn(`startupBehavior must be "immediate" or "skipInitialUpdate"; using "${DEFAULT_STARTUP_BEHAVIOR}"`);
      return DEFAULT_STARTUP_BEHAVIOR;
    }

    return value;
  }

  private validateStartupDelay(value: number | undefined): number {
    if (value === undefined || value === null) {
      return 0;
    }

    if (!Number.isInteger(value) || value < 0) {
      this.log.warn('startupDelaySeconds must be an integer >= 0; using 0');
      return 0;
    }

    return value;
  }

  private validateDeviceOverrides(
    overrides: DeviceOverrideConfig[] | undefined,
    globalPollInterval: number | undefined,
  ): DeviceOverrideConfig[] {
    if (!Array.isArray(overrides)) {
      return [];
    }

    const seenIotIds = new Set<string>();
    const validated: DeviceOverrideConfig[] = [];

    for (let i = 0; i < overrides.length; i++) {
      const override = overrides[i];
      if (!override || typeof override !== 'object') {
        this.log.warn(`deviceOverrides[${i}] is invalid and was ignored`);
        continue;
      }

      const iotId = typeof override.iotId === 'string' ? override.iotId.trim() : '';
      if (!iotId) {
        this.log.warn(`deviceOverrides[${i}].iotId is required and was ignored`);
        continue;
      }

      if (seenIotIds.has(iotId)) {
        this.log.warn(`deviceOverrides has duplicate iotId "${iotId}"; later entry ignored`);
        continue;
      }
      seenIotIds.add(iotId);

      const pollInterval = this.validatePollInterval(override.pollInterval, `deviceOverrides[${i}].pollInterval`) ||
        (this.validatePollInterval(globalPollInterval, 'pollInterval') || DEFAULT_POLL_INTERVAL_SECONDS);

      const features: Partial<FeatureVisibilityConfig> = {};
      for (const key of FEATURE_KEYS) {
        const flatValue = override[key];
        if (typeof flatValue === 'boolean') {
          features[key] = flatValue;
          continue;
        }

        const nestedValue = override.features && typeof override.features === 'object'
          ? override.features[key]
          : undefined;
        if (typeof nestedValue === 'boolean') {
          features[key] = nestedValue;
        }
      }

      validated.push({
        iotId,
        name: typeof override.name === 'string' ? override.name.trim() : undefined,
        hidden: override.hidden === true,
        pollInterval,
        features,
      });
    }

    return validated;
  }

  private getDeviceOverride(iotId: string): DeviceOverrideConfig | undefined {
    return this.config.deviceOverrides?.find(override => override.iotId === iotId);
  }

  private getSchedulerTickSeconds(): number {
    const intervals = Array.from(this.devicePollIntervals.values());
    if (intervals.length === 0) {
      return this.config.pollInterval || DEFAULT_POLL_INTERVAL_SECONDS;
    }

    return Math.min(...intervals);
  }

  private buildAccessoryConfig(iotId: string): NeakasaPlatformConfig {
    const featureConfig = this.getFeatureConfig(iotId);

    return {
      ...this.config,
      ...featureConfig,
    };
  }

  private getFeatureConfig(iotId: string): FeatureVisibilityConfig {
    const base: FeatureVisibilityConfig = {
      showChildLock: this.config.showChildLock === true,
      showEmptyBin: this.config.showEmptyBin === true,
      showAutoBury: this.config.showAutoBury === true,
      showAutoLevel: this.config.showAutoLevel === true,
      showSilentMode: this.config.showSilentMode === true,
      showUnstoppableCycle: this.config.showUnstoppableCycle === true,
      showAutoRecovery: this.config.showAutoRecovery === true,
      showYoungCatMode: this.config.showYoungCatMode === true,
      showBinStateSensor: this.config.showBinStateSensor === true,
      showWifiSensor: this.config.showWifiSensor === true,
      showCatSensors: this.config.showCatSensors === true,
      showSandLevelSensor: this.config.showSandLevelSensor === true,
      showFaultSensor: this.config.showFaultSensor === true,
      useImperialUnits: this.config.useImperialUnits === true,
    };

    const override = this.getDeviceOverride(iotId);
    if (!override?.features) {
      return base;
    }

    for (const key of FEATURE_KEYS) {
      const overrideValue = override.features[key];
      if (typeof overrideValue === 'boolean') {
        base[key] = overrideValue;
      }
    }

    return base;
  }

  private removeAccessoryByIotId(iotId: string): void {
    const accessory = this.accessories.find(current => current.context.device?.iotId === iotId);
    if (!accessory) {
      this.deviceAccessories.delete(iotId);
      this.devicePollIntervals.delete(iotId);
      this.lastPolledAt.delete(iotId);
      return;
    }

    this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    this.deviceAccessories.delete(iotId);
    this.devicePollIntervals.delete(iotId);
    this.lastPolledAt.delete(iotId);

    const index = this.accessories.indexOf(accessory);
    if (index > -1) {
      this.accessories.splice(index, 1);
    }
  }

  private logConfigStartupChecks(): void {
    this.log.info(
      `Startup checks: pollInterval=${this.config.pollInterval}s, ` +
      `startupBehavior=${this.config.startupBehavior}, startupDelaySeconds=${this.config.startupDelaySeconds}`,
    );

    if ((this.config.deviceOverrides?.length || 0) > 0) {
      this.log.info(`Startup checks: loaded ${this.config.deviceOverrides?.length} device override(s)`);
    }
  }

  private logDetectedDeviceSummary(devices: NeakasaDevice[]): void {
    if (devices.length === 0) {
      this.log.warn('Detected devices summary: no devices returned by Neakasa API');
      return;
    }

    this.log.info('Detected devices + mapped features summary:');

    const discoveredIds = new Set(devices.map(device => device.iotId));

    for (const device of devices) {
      const override = this.getDeviceOverride(device.iotId);
      const hidden = override?.hidden === true;
      const displayName = override?.name || device.deviceName || this.config.deviceName || 'Neakasa M1';
      const pollInterval = override?.pollInterval || this.config.pollInterval || DEFAULT_POLL_INTERVAL_SECONDS;
      const enabledFeatures = FEATURE_KEYS
        .filter(key => this.getFeatureConfig(device.iotId)[key])
        .map(key => FEATURE_LABELS[key]);

      this.log.info(
        `- ${displayName} [${device.iotId}] hidden=${hidden} poll=${pollInterval}s ` +
        `features=${enabledFeatures.length > 0 ? enabledFeatures.join(', ') : 'core-only'}`,
      );
    }

    for (const override of this.config.deviceOverrides || []) {
      if (!discoveredIds.has(override.iotId)) {
        this.log.warn(`deviceOverrides entry for unknown iotId "${override.iotId}" did not match any detected device`);
      }
    }
  }
}
