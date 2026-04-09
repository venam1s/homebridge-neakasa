import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { NeakasaAccessory } from './accessory';
import { NeakasaAPI, NeakasaAPIError, NeakasaAuthError } from './api';
import {
  NeakasaPlatformConfig,
  NeakasaDevice,
  DeviceData,
  DeviceOverrideConfig,
  DeviceSettingsConfig,
  FeatureVisibilityConfig,
  StartupBehavior,
} from './types';

const MIN_POLL_INTERVAL_SECONDS = 30;
const DEFAULT_POLL_INTERVAL_SECONDS = 60;
const MIN_RECORD_DAYS = 1;
const MAX_RECORD_DAYS = 30;
const DEFAULT_RECORD_DAYS = 7;
const DEFAULT_CAT_PRESENT_LATCH_SECONDS = 240;
const DEFAULT_CAT_VISIT_LATCH_SECONDS = 90;
const DEFAULT_RECENTLY_USED_MINUTES = 15;
const DEFAULT_STARTUP_BEHAVIOR: StartupBehavior = 'immediate';
const MAX_CONSECUTIVE_FAILURES = 5;
const BACKOFF_BASE_MULTIPLIER = 2;
const MAX_BACKOFF_SECONDS = 600;

const FEATURE_KEYS: Array<keyof FeatureVisibilityConfig> = [
  'showAutoLevelClean',
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
  'showCatVisitSensor',
  'showRecentlyUsedSensor',
  'showSandLevelSensor',
  'showFaultSensor',
  'useImperialUnits',
];

const FEATURE_LABELS: Record<keyof FeatureVisibilityConfig, string> = {
  showAutoLevelClean: 'Sync Auto Level With Auto Clean',
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
  showCatVisitSensor: 'Cat Visit Sensor',
  showRecentlyUsedSensor: 'Recently Used Sensor',
  showSandLevelSensor: 'Sand Level Sensor',
  showFaultSensor: 'Fault Sensor',
  useImperialUnits: 'Imperial Units',
};

interface ResolvedDeviceConfig {
  pollInterval: number;
  recordDays: number;
  catPresentLatchSeconds: number;
  catVisitLatchSeconds: number;
  recentlyUsedMinutes: number;
  features: FeatureVisibilityConfig;
}

export class NeakasaPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  public readonly accessories: PlatformAccessory[] = [];
  public readonly neakasaApi: NeakasaAPI;

  private readonly deviceAccessories: Map<string, NeakasaAccessory> = new Map();
  private readonly devicePollIntervals: Map<string, number> = new Map();
  private readonly lastPolledAt: Map<string, number> = new Map();
  private readonly consecutiveFailures: Map<string, number> = new Map();
  private pollRunInProgress = false;
  private pollRunQueued = false;
  private queuedPollForceAll = false;
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
        const resolvedConfig = this.getResolvedDeviceConfig(device.iotId);

        if (override?.hidden === true) {
          this.log.info(`Skipping hidden device ${device.deviceName} (${device.iotId})`);
          this.removeAccessoryByIotId(device.iotId);
          continue;
        }

        activeIotIds.add(device.iotId);
        this.devicePollIntervals.set(device.iotId, resolvedConfig.pollInterval);

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
            this.consecutiveFailures.delete(iotId);
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
          this.enqueuePollRun(true);
        }, delaySeconds * 1000);
      } else {
        this.enqueuePollRun(true);
      }
    }

    this.pollInterval = setInterval(() => {
      this.enqueuePollRun(false);
    }, tickerSeconds * 1000);
  }

  private enqueuePollRun(forceAll: boolean): void {
    this.pollRunQueued = true;
    this.queuedPollForceAll = this.queuedPollForceAll || forceAll;

    if (this.pollRunInProgress) {
      return;
    }

    this.pollRunInProgress = true;
    void this.flushQueuedPollRuns();
  }

  private async flushQueuedPollRuns(): Promise<void> {
    try {
      while (this.pollRunQueued) {
        const forceAll = this.queuedPollForceAll;
        this.pollRunQueued = false;
        this.queuedPollForceAll = false;
        await this.updateAllDueDevices(forceAll);
      }
    } finally {
      this.pollRunInProgress = false;
    }
  }

  private async updateAllDueDevices(forceAll: boolean): Promise<void> {
    const now = Date.now();
    let reconnectAttempted = false;

    for (const [iotId, accessory] of this.deviceAccessories.entries()) {
      const intervalSeconds = this.devicePollIntervals.get(iotId) ?? this.config.pollInterval ?? DEFAULT_POLL_INTERVAL_SECONDS;
      const lastPolledAt = this.lastPolledAt.get(iotId) ?? 0;

      if (!forceAll && now - lastPolledAt < intervalSeconds * 1000) {
        continue;
      }

      let updatedSuccessfully = false;

      try {
        await this.updateDevice(iotId, accessory);
        updatedSuccessfully = true;
        this.consecutiveFailures.set(iotId, 0);
      } catch (error) {
        this.log.error(`Failed to update device ${iotId}:`, error);

        const failures = (this.consecutiveFailures.get(iotId) ?? 0) + 1;
        this.consecutiveFailures.set(iotId, failures);

        if (failures >= MAX_CONSECUTIVE_FAILURES) {
          const backoffSeconds = Math.min(intervalSeconds * BACKOFF_BASE_MULTIPLIER, MAX_BACKOFF_SECONDS);
          const backoffMs = (backoffSeconds - intervalSeconds) * 1000;
          this.log.warn(
            `Device ${iotId} has failed ${failures} consecutive polls; ` +
            `backing off ${backoffSeconds}s before next attempt`,
          );
          this.lastPolledAt.set(iotId, Date.now() + backoffMs);
        }

        // Try to reconnect if it's an auth error.
        if (this.isNotConnectedError(error)) {
          if (reconnectAttempted) {
            this.log.warn('Reconnect already attempted in this poll run; skipping additional reconnect attempts');
            continue;
          }

          reconnectAttempted = true;
          this.log.warn('Attempting to reconnect to Neakasa API...');
          try {
            await this.neakasaApi.connect(this.config.username, this.config.password);
            this.log.info('Reconnected successfully, retrying device update...');
            await this.updateDevice(iotId, accessory);
            updatedSuccessfully = true;
            this.consecutiveFailures.set(iotId, 0);
          } catch (reconnectError) {
            this.log.error('Failed to reconnect:', reconnectError);
            continue;
          }
        }
      } finally {
        if (updatedSuccessfully) {
          this.lastPolledAt.set(iotId, Date.now());
        }
      }
    }
  }

  private isNotConnectedError(error: unknown): boolean {
    if (error instanceof NeakasaAuthError) {
      return true;
    }
    if (error instanceof NeakasaAPIError && !this.neakasaApi.connected) {
      return true;
    }
    return false;
  }

  private async updateDevice(iotId: string, accessory: NeakasaAccessory): Promise<void> {
    const properties = await this.neakasaApi.getDeviceProperties(iotId);

    const featureConfig = this.getFeatureConfig(iotId);
    const shouldFetchRecords = featureConfig.showCatSensors === true;
    const deviceContext = this.accessories.find(acc => acc.context.device?.iotId === iotId)?.context.device;
    let catList: any[] = [];
    let recordList: any[] = [];

    if (shouldFetchRecords && deviceContext) {
      try {
        const records = await this.neakasaApi.getRecords(deviceContext.deviceName, this.getRecordDays(iotId));
        catList = records.cat_list ?? [];
        recordList = records.record_list ?? [];
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
      sandLevelPercent: properties.Sand?.value?.percent ?? 0,
      wifiRssi: properties.NetWorkStatus?.value?.WiFi_RSSI ?? 0,
      bucketStatus: properties.bucketStatus?.value ?? 0,
      room_of_bin: properties.room_of_bin?.value ?? 0,
      sandLevelState: properties.Sand?.value?.level ?? 0,
      stayTime: properties.catLeft?.value?.stayTime ?? 0,
      lastUse: properties.catLeft?.time ?? 0,
      cat_list: catList,
      record_list: recordList,
    };

    await accessory.updateData(deviceData);
  }

  private sanitizeConfig(rawConfig: NeakasaPlatformConfig): NeakasaPlatformConfig {
    const topLevelDefaults: ResolvedDeviceConfig = {
      pollInterval: this.validatePollInterval(rawConfig.pollInterval, 'pollInterval') ?? DEFAULT_POLL_INTERVAL_SECONDS,
      recordDays: this.validateRecordDays(rawConfig.recordDays, 'recordDays') ?? DEFAULT_RECORD_DAYS,
      catPresentLatchSeconds:
        this.validateCatPresentLatchSeconds(rawConfig.catPresentLatchSeconds, 'catPresentLatchSeconds') ??
        DEFAULT_CAT_PRESENT_LATCH_SECONDS,
      catVisitLatchSeconds:
        this.validateNonNegativeInt(rawConfig.catVisitLatchSeconds, 'catVisitLatchSeconds') ??
        DEFAULT_CAT_VISIT_LATCH_SECONDS,
      recentlyUsedMinutes:
        this.validateNonNegativeInt(rawConfig.recentlyUsedMinutes, 'recentlyUsedMinutes') ??
        DEFAULT_RECENTLY_USED_MINUTES,
      features: this.mergeFeatureConfig(this.createDefaultFeatureConfig(), rawConfig),
    };

    const defaultsLayer = this.normalizeDeviceSettingsLayer(rawConfig.defaults, 'defaults');
    const effectiveDefaults = this.mergeResolvedDeviceConfig(topLevelDefaults, defaultsLayer);
    const profiles = this.validateProfiles(rawConfig.profiles);

    const config: NeakasaPlatformConfig = {
      ...rawConfig,
      username: typeof rawConfig.username === 'string' ? rawConfig.username.trim() : rawConfig.username,
      password: typeof rawConfig.password === 'string' ? rawConfig.password : rawConfig.password,
      pollInterval: effectiveDefaults.pollInterval,
      recordDays: effectiveDefaults.recordDays,
      catPresentLatchSeconds: effectiveDefaults.catPresentLatchSeconds,
      catVisitLatchSeconds: effectiveDefaults.catVisitLatchSeconds,
      recentlyUsedMinutes: effectiveDefaults.recentlyUsedMinutes,
      startupBehavior: this.validateStartupBehavior(rawConfig.startupBehavior),
      startupDelaySeconds: this.validateStartupDelay(rawConfig.startupDelaySeconds),
      showAutoLevelClean: effectiveDefaults.features.showAutoLevelClean,
      showChildLock: effectiveDefaults.features.showChildLock,
      showEmptyBin: effectiveDefaults.features.showEmptyBin,
      showAutoBury: effectiveDefaults.features.showAutoBury,
      showAutoLevel: effectiveDefaults.features.showAutoLevel,
      showSilentMode: effectiveDefaults.features.showSilentMode,
      showUnstoppableCycle: effectiveDefaults.features.showUnstoppableCycle,
      showAutoRecovery: effectiveDefaults.features.showAutoRecovery,
      showYoungCatMode: effectiveDefaults.features.showYoungCatMode,
      showBinStateSensor: effectiveDefaults.features.showBinStateSensor,
      showWifiSensor: effectiveDefaults.features.showWifiSensor,
      showCatSensors: effectiveDefaults.features.showCatSensors,
      showCatVisitSensor: effectiveDefaults.features.showCatVisitSensor,
      showRecentlyUsedSensor: effectiveDefaults.features.showRecentlyUsedSensor,
      showSandLevelSensor: effectiveDefaults.features.showSandLevelSensor,
      showFaultSensor: effectiveDefaults.features.showFaultSensor,
      useImperialUnits: effectiveDefaults.features.useImperialUnits,
      defaults: defaultsLayer,
      profiles,
      deviceOverrides: this.validateDeviceOverrides(rawConfig.deviceOverrides, Object.keys(profiles)),
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

  private validateCatPresentLatchSeconds(value: number | undefined, context: string): number | undefined {
    return this.validateNonNegativeInt(value, context);
  }

  private validateNonNegativeInt(value: number | undefined, context: string): number | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (!Number.isInteger(value) || value < 0) {
      this.log.warn(`${context} must be an integer >= 0; using default`);
      return undefined;
    }

    return value;
  }

  private validateRecordDays(value: number | undefined, context: string): number | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (!Number.isInteger(value) || value < MIN_RECORD_DAYS || value > MAX_RECORD_DAYS) {
      this.log.warn(`${context} must be an integer between ${MIN_RECORD_DAYS} and ${MAX_RECORD_DAYS}; using default`);
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

  private createDefaultFeatureConfig(): FeatureVisibilityConfig {
    return {
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
    };
  }

  private mergeFeatureConfig(
    base: FeatureVisibilityConfig,
    source: (Partial<FeatureVisibilityConfig> & { features?: Partial<FeatureVisibilityConfig> }) | undefined,
  ): FeatureVisibilityConfig {
    if (!source || typeof source !== 'object') {
      return base;
    }

    const merged = { ...base };
    const nestedFeatures = source.features && typeof source.features === 'object' ? source.features : undefined;

    for (const key of FEATURE_KEYS) {
      const flatValue = source[key];
      if (typeof flatValue === 'boolean') {
        merged[key] = flatValue;
      }

      const nestedValue = nestedFeatures?.[key];
      if (typeof nestedValue === 'boolean') {
        merged[key] = nestedValue;
      }
    }

    return merged;
  }

  private normalizeDeviceSettingsLayer(
    layer: DeviceSettingsConfig | undefined,
    context: string,
  ): DeviceSettingsConfig {
    if (layer === undefined || layer === null) {
      return {};
    }

    if (typeof layer !== 'object' || Array.isArray(layer)) {
      this.log.warn(`${context} is invalid and was ignored`);
      return {};
    }

    const normalized: DeviceSettingsConfig = {};
    const pollInterval = this.validatePollInterval(layer.pollInterval, `${context}.pollInterval`);
    const recordDays = this.validateRecordDays(layer.recordDays, `${context}.recordDays`);
    const catPresentLatchSeconds = this.validateCatPresentLatchSeconds(
      layer.catPresentLatchSeconds,
      `${context}.catPresentLatchSeconds`,
    );
    const catVisitLatchSeconds = this.validateNonNegativeInt(layer.catVisitLatchSeconds, `${context}.catVisitLatchSeconds`);
    const recentlyUsedMinutes = this.validateNonNegativeInt(layer.recentlyUsedMinutes, `${context}.recentlyUsedMinutes`);

    if (pollInterval !== undefined) {
      normalized.pollInterval = pollInterval;
    }
    if (recordDays !== undefined) {
      normalized.recordDays = recordDays;
    }
    if (catPresentLatchSeconds !== undefined) {
      normalized.catPresentLatchSeconds = catPresentLatchSeconds;
    }
    if (catVisitLatchSeconds !== undefined) {
      normalized.catVisitLatchSeconds = catVisitLatchSeconds;
    }
    if (recentlyUsedMinutes !== undefined) {
      normalized.recentlyUsedMinutes = recentlyUsedMinutes;
    }

    const features = this.extractFeatureOverrides(layer);
    if (Object.keys(features).length > 0) {
      normalized.features = features;
    }

    return normalized;
  }

  private validateProfiles(
    profiles: Record<string, DeviceSettingsConfig> | undefined,
  ): Record<string, DeviceSettingsConfig> {
    if (profiles === undefined || profiles === null) {
      return {};
    }

    if (typeof profiles !== 'object' || Array.isArray(profiles)) {
      this.log.warn('profiles is invalid and was ignored');
      return {};
    }

    const validated: Record<string, DeviceSettingsConfig> = {};
    for (const [name, layer] of Object.entries(profiles)) {
      const trimmedName = typeof name === 'string' ? name.trim() : '';
      if (!trimmedName) {
        this.log.warn('profiles contains an empty profile name; entry ignored');
        continue;
      }

      validated[trimmedName] = this.normalizeDeviceSettingsLayer(layer, `profiles.${trimmedName}`);
    }

    return validated;
  }

  private validateDeviceOverrides(
    overrides: DeviceOverrideConfig[] | undefined,
    profileNames: string[],
  ): DeviceOverrideConfig[] {
    if (!Array.isArray(overrides)) {
      return [];
    }

    const knownProfiles = new Set(profileNames);
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

      const pollInterval = this.validatePollInterval(override.pollInterval, `deviceOverrides[${i}].pollInterval`);
      const recordDays = this.validateRecordDays(
        override.recordDays,
        `deviceOverrides[${i}].recordDays`,
      );
      const catPresentLatchSeconds = this.validateCatPresentLatchSeconds(
        override.catPresentLatchSeconds,
        `deviceOverrides[${i}].catPresentLatchSeconds`,
      );
      const catVisitLatchSeconds = this.validateNonNegativeInt(
        override.catVisitLatchSeconds,
        `deviceOverrides[${i}].catVisitLatchSeconds`,
      );
      const recentlyUsedMinutes = this.validateNonNegativeInt(
        override.recentlyUsedMinutes,
        `deviceOverrides[${i}].recentlyUsedMinutes`,
      );
      const profile = typeof override.profile === 'string' ? override.profile.trim() : '';
      if (profile && !knownProfiles.has(profile)) {
        this.log.warn(`deviceOverrides[${i}].profile "${profile}" was not found in profiles; using inherited defaults`);
      }

      const features = this.extractFeatureOverrides(override);

      validated.push({
        iotId,
        name: typeof override.name === 'string' ? override.name.trim() : undefined,
        hidden: override.hidden === true,
        profile: profile && knownProfiles.has(profile) ? profile : undefined,
        ...(pollInterval !== undefined ? { pollInterval } : {}),
        ...(recordDays !== undefined ? { recordDays } : {}),
        ...(catPresentLatchSeconds !== undefined ? { catPresentLatchSeconds } : {}),
        ...(catVisitLatchSeconds !== undefined ? { catVisitLatchSeconds } : {}),
        ...(recentlyUsedMinutes !== undefined ? { recentlyUsedMinutes } : {}),
        ...(Object.keys(features).length > 0 ? { features } : {}),
      });
    }

    return validated;
  }

  private extractFeatureOverrides(
    source: (Partial<FeatureVisibilityConfig> & { features?: Partial<FeatureVisibilityConfig> }) | undefined,
  ): Partial<FeatureVisibilityConfig> {
    if (!source || typeof source !== 'object') {
      return {};
    }

    const features: Partial<FeatureVisibilityConfig> = {};
    const nestedFeatures = source.features && typeof source.features === 'object' ? source.features : undefined;

    for (const key of FEATURE_KEYS) {
      const flatValue = source[key];
      if (typeof flatValue === 'boolean') {
        features[key] = flatValue;
        continue;
      }

      const nestedValue = nestedFeatures?.[key];
      if (typeof nestedValue === 'boolean') {
        features[key] = nestedValue;
      }
    }

    return features;
  }

  private getDeviceOverride(iotId: string): DeviceOverrideConfig | undefined {
    return this.config.deviceOverrides?.find(override => override.iotId === iotId);
  }

  private mergeResolvedDeviceConfig(base: ResolvedDeviceConfig, layer: DeviceSettingsConfig | undefined): ResolvedDeviceConfig {
    if (!layer) {
      return base;
    }

    return {
      pollInterval: layer.pollInterval ?? base.pollInterval,
      recordDays: layer.recordDays ?? base.recordDays,
      catPresentLatchSeconds: layer.catPresentLatchSeconds ?? base.catPresentLatchSeconds,
      catVisitLatchSeconds: layer.catVisitLatchSeconds ?? base.catVisitLatchSeconds,
      recentlyUsedMinutes: layer.recentlyUsedMinutes ?? base.recentlyUsedMinutes,
      features: this.mergeFeatureConfig(base.features, layer),
    };
  }

  private getResolvedDeviceConfig(iotId: string): ResolvedDeviceConfig {
    const base: ResolvedDeviceConfig = {
      pollInterval: this.config.pollInterval ?? DEFAULT_POLL_INTERVAL_SECONDS,
      recordDays: this.config.recordDays ?? DEFAULT_RECORD_DAYS,
      catPresentLatchSeconds: this.config.catPresentLatchSeconds ?? DEFAULT_CAT_PRESENT_LATCH_SECONDS,
      catVisitLatchSeconds: this.config.catVisitLatchSeconds ?? DEFAULT_CAT_VISIT_LATCH_SECONDS,
      recentlyUsedMinutes: this.config.recentlyUsedMinutes ?? DEFAULT_RECENTLY_USED_MINUTES,
      features: this.mergeFeatureConfig(this.createDefaultFeatureConfig(), this.config),
    };

    const override = this.getDeviceOverride(iotId);
    const profile = override?.profile ? this.config.profiles?.[override.profile] : undefined;

    return this.mergeResolvedDeviceConfig(
      this.mergeResolvedDeviceConfig(base, profile),
      override,
    );
  }

  private getSchedulerTickSeconds(): number {
    const intervals = Array.from(this.devicePollIntervals.values());
    if (intervals.length === 0) {
      return this.config.pollInterval ?? DEFAULT_POLL_INTERVAL_SECONDS;
    }

    return Math.min(...intervals);
  }

  private buildAccessoryConfig(iotId: string): NeakasaPlatformConfig {
    const resolvedConfig = this.getResolvedDeviceConfig(iotId);

    return {
      ...this.config,
      ...resolvedConfig.features,
      pollInterval: resolvedConfig.pollInterval,
      recordDays: resolvedConfig.recordDays,
      catPresentLatchSeconds: resolvedConfig.catPresentLatchSeconds,
      catVisitLatchSeconds: resolvedConfig.catVisitLatchSeconds,
      recentlyUsedMinutes: resolvedConfig.recentlyUsedMinutes,
    };
  }

  private getFeatureConfig(iotId: string): FeatureVisibilityConfig {
    return this.getResolvedDeviceConfig(iotId).features;
  }

  private getRecordDays(iotId: string): number {
    return this.getResolvedDeviceConfig(iotId).recordDays;
  }

  private removeAccessoryByIotId(iotId: string): void {
    const accessory = this.accessories.find(current => current.context.device?.iotId === iotId);
    if (!accessory) {
      this.deviceAccessories.delete(iotId);
      this.devicePollIntervals.delete(iotId);
      this.lastPolledAt.delete(iotId);
      this.consecutiveFailures.delete(iotId);
      return;
    }

    this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    this.deviceAccessories.delete(iotId);
    this.devicePollIntervals.delete(iotId);
    this.lastPolledAt.delete(iotId);
    this.consecutiveFailures.delete(iotId);

    const index = this.accessories.indexOf(accessory);
    if (index > -1) {
      this.accessories.splice(index, 1);
    }
  }

  private logConfigStartupChecks(): void {
    this.log.info(
      `Startup checks: pollInterval=${this.config.pollInterval}s, recordDays=${this.config.recordDays}, ` +
      `catPresentLatchSeconds=${this.config.catPresentLatchSeconds}s, catVisitLatchSeconds=${this.config.catVisitLatchSeconds}s, ` +
      `recentlyUsedMinutes=${this.config.recentlyUsedMinutes}, ` +
      `startupBehavior=${this.config.startupBehavior}, startupDelaySeconds=${this.config.startupDelaySeconds}`,
    );

    if ((this.config.deviceOverrides?.length || 0) > 0) {
      this.log.info(`Startup checks: loaded ${this.config.deviceOverrides?.length} device override(s)`);
    }

    if (this.config.profiles && Object.keys(this.config.profiles).length > 0) {
      this.log.info(`Startup checks: loaded ${Object.keys(this.config.profiles).length} profile(s)`);
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
      const resolved = this.getResolvedDeviceConfig(device.iotId);
      const hidden = override?.hidden === true;
      const displayName = override?.name || device.deviceName || this.config.deviceName || 'Neakasa M1';
      const enabledFeatures = FEATURE_KEYS
        .filter(key => resolved.features[key])
        .map(key => FEATURE_LABELS[key]);

      this.log.info(
        `- ${displayName} [${device.iotId}] hidden=${hidden} profile=${override?.profile || 'none'} ` +
        `poll=${resolved.pollInterval}s recordDays=${resolved.recordDays} ` +
        `catPresentLatch=${resolved.catPresentLatchSeconds}s catVisitLatch=${resolved.catVisitLatchSeconds}s ` +
        `recentlyUsed=${resolved.recentlyUsedMinutes}m ` +
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
