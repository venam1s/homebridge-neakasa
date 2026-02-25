"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NeakasaPlatform = void 0;
const settings_1 = require("./settings");
const accessory_1 = require("./accessory");
const api_1 = require("./api");
const MIN_POLL_INTERVAL_SECONDS = 30;
const DEFAULT_POLL_INTERVAL_SECONDS = 60;
const DEFAULT_STARTUP_BEHAVIOR = 'immediate';
const FEATURE_KEYS = [
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
const FEATURE_LABELS = {
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
class NeakasaPlatform {
    constructor(log, config, api) {
        this.log = log;
        this.api = api;
        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;
        this.accessories = [];
        this.deviceAccessories = new Map();
        this.devicePollIntervals = new Map();
        this.lastPolledAt = new Map();
        this.config = this.sanitizeConfig(config);
        this.neakasaApi = new api_1.NeakasaAPI(this.log);
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
    configureAccessory(accessory) {
        this.log.info('Loading accessory from cache:', accessory.displayName);
        this.accessories.push(accessory);
    }
    async discoverDevices() {
        try {
            this.log.info('Connecting to Neakasa API...');
            await this.neakasaApi.connect(this.config.username, this.config.password);
            this.log.info('Successfully connected to Neakasa API');
            const devices = await this.neakasaApi.getDevices();
            this.log.info(`Found ${devices.length} device(s)`);
            const activeIotIds = new Set();
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
                    const accessory = new accessory_1.NeakasaAccessory(this, existingAccessory, device.iotId, displayName, accessoryConfig);
                    this.deviceAccessories.set(device.iotId, accessory);
                }
                else {
                    this.log.info('Adding new accessory:', displayName);
                    const accessory = new this.api.platformAccessory(displayName, uuid);
                    accessory.context.device = device;
                    const neakasaAccessory = new accessory_1.NeakasaAccessory(this, accessory, device.iotId, displayName, accessoryConfig);
                    this.deviceAccessories.set(device.iotId, neakasaAccessory);
                    this.api.registerPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [accessory]);
                    this.accessories.push(accessory);
                }
            }
            const accessoriesToRemove = this.accessories.filter(accessory => {
                const iotId = accessory.context.device?.iotId;
                return iotId && !activeIotIds.has(iotId);
            });
            if (accessoriesToRemove.length > 0) {
                this.log.info(`Removing ${accessoriesToRemove.length} obsolete accessory(ies)`);
                this.api.unregisterPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, accessoriesToRemove);
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
            this.startPolling();
        }
        catch (error) {
            this.log.error('Failed to discover devices:', error);
        }
    }
    startPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
        const tickerSeconds = this.getSchedulerTickSeconds();
        this.log.info(`Starting polling scheduler every ${tickerSeconds} seconds`);
        if (this.config.startupBehavior === 'skipInitialUpdate') {
            this.log.info('Startup behavior: skipping initial refresh, waiting for normal poll schedule');
        }
        else {
            const delaySeconds = this.config.startupDelaySeconds || 0;
            if (delaySeconds > 0) {
                this.log.info(`Startup behavior: initial refresh delayed by ${delaySeconds} seconds`);
                this.startupTimeout = setTimeout(() => {
                    this.updateAllDueDevices(true);
                }, delaySeconds * 1000);
            }
            else {
                this.updateAllDueDevices(true);
            }
        }
        this.pollInterval = setInterval(() => {
            this.updateAllDueDevices(false);
        }, tickerSeconds * 1000);
    }
    async updateAllDueDevices(forceAll) {
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
            }
            catch (error) {
                this.log.error(`Failed to update device ${iotId}:`, error);
                if (error instanceof Error && error.message.includes('not connected')) {
                    this.log.warn('Attempting to reconnect to Neakasa API...');
                    try {
                        await this.neakasaApi.connect(this.config.username, this.config.password);
                        this.log.info('Reconnected successfully, retrying device update...');
                        await this.updateDevice(iotId, accessory);
                    }
                    catch (reconnectError) {
                        this.log.error('Failed to reconnect:', reconnectError);
                    }
                }
            }
        }
    }
    async updateDevice(iotId, accessory) {
        const properties = await this.neakasaApi.getDeviceProperties(iotId);
        const deviceContext = this.accessories.find(acc => acc.context.device?.iotId === iotId)?.context.device;
        let catList = [];
        let recordList = [];
        if (deviceContext) {
            try {
                const records = await this.neakasaApi.getRecords(deviceContext.deviceName);
                catList = records.cat_list || [];
                recordList = records.record_list || [];
            }
            catch (recordError) {
                this.log.debug(`Could not fetch records for ${deviceContext.deviceName}: ${recordError}`);
            }
        }
        const deviceData = {
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
    sanitizeConfig(rawConfig) {
        const config = {
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
    validatePollInterval(value, context) {
        if (value === undefined || value === null) {
            return undefined;
        }
        if (!Number.isInteger(value) || value < MIN_POLL_INTERVAL_SECONDS) {
            this.log.warn(`${context} must be an integer >= ${MIN_POLL_INTERVAL_SECONDS}; using default`);
            return undefined;
        }
        return value;
    }
    validateStartupBehavior(value) {
        if (value === undefined || value === null) {
            return DEFAULT_STARTUP_BEHAVIOR;
        }
        if (value !== 'immediate' && value !== 'skipInitialUpdate') {
            this.log.warn(`startupBehavior must be "immediate" or "skipInitialUpdate"; using "${DEFAULT_STARTUP_BEHAVIOR}"`);
            return DEFAULT_STARTUP_BEHAVIOR;
        }
        return value;
    }
    validateStartupDelay(value) {
        if (value === undefined || value === null) {
            return 0;
        }
        if (!Number.isInteger(value) || value < 0) {
            this.log.warn('startupDelaySeconds must be an integer >= 0; using 0');
            return 0;
        }
        return value;
    }
    validateDeviceOverrides(overrides, globalPollInterval) {
        if (!Array.isArray(overrides)) {
            return [];
        }
        const seenIotIds = new Set();
        const validated = [];
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
            const features = {};
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
    getDeviceOverride(iotId) {
        return this.config.deviceOverrides?.find(override => override.iotId === iotId);
    }
    getSchedulerTickSeconds() {
        const intervals = Array.from(this.devicePollIntervals.values());
        if (intervals.length === 0) {
            return this.config.pollInterval || DEFAULT_POLL_INTERVAL_SECONDS;
        }
        return Math.min(...intervals);
    }
    buildAccessoryConfig(iotId) {
        const featureConfig = this.getFeatureConfig(iotId);
        return {
            ...this.config,
            ...featureConfig,
        };
    }
    getFeatureConfig(iotId) {
        const base = {
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
    removeAccessoryByIotId(iotId) {
        const accessory = this.accessories.find(current => current.context.device?.iotId === iotId);
        if (!accessory) {
            this.deviceAccessories.delete(iotId);
            this.devicePollIntervals.delete(iotId);
            this.lastPolledAt.delete(iotId);
            return;
        }
        this.api.unregisterPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [accessory]);
        this.deviceAccessories.delete(iotId);
        this.devicePollIntervals.delete(iotId);
        this.lastPolledAt.delete(iotId);
        const index = this.accessories.indexOf(accessory);
        if (index > -1) {
            this.accessories.splice(index, 1);
        }
    }
    logConfigStartupChecks() {
        this.log.info(`Startup checks: pollInterval=${this.config.pollInterval}s, ` +
            `startupBehavior=${this.config.startupBehavior}, startupDelaySeconds=${this.config.startupDelaySeconds}`);
        if ((this.config.deviceOverrides?.length || 0) > 0) {
            this.log.info(`Startup checks: loaded ${this.config.deviceOverrides?.length} device override(s)`);
        }
    }
    logDetectedDeviceSummary(devices) {
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
            this.log.info(`- ${displayName} [${device.iotId}] hidden=${hidden} poll=${pollInterval}s ` +
                `features=${enabledFeatures.length > 0 ? enabledFeatures.join(', ') : 'core-only'}`);
        }
        for (const override of this.config.deviceOverrides || []) {
            if (!discoveredIds.has(override.iotId)) {
                this.log.warn(`deviceOverrides entry for unknown iotId "${override.iotId}" did not match any detected device`);
            }
        }
    }
}
exports.NeakasaPlatform = NeakasaPlatform;
//# sourceMappingURL=platform.js.map