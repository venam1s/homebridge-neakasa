import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { NeakasaAPI } from './api';
export declare class NeakasaPlatform implements DynamicPlatformPlugin {
    readonly log: Logger;
    readonly api: API;
    readonly Service: typeof Service;
    readonly Characteristic: typeof Characteristic;
    readonly accessories: PlatformAccessory[];
    readonly neakasaApi: NeakasaAPI;
    private readonly deviceAccessories;
    private readonly devicePollIntervals;
    private readonly lastPolledAt;
    private pollInterval?;
    private startupTimeout?;
    private readonly config;
    constructor(log: Logger, config: PlatformConfig, api: API);
    configureAccessory(accessory: PlatformAccessory): void;
    discoverDevices(): Promise<void>;
    private startPolling;
    private updateAllDueDevices;
    private updateDevice;
    private sanitizeConfig;
    private validatePollInterval;
    private validateStartupBehavior;
    private validateStartupDelay;
    private validateDeviceOverrides;
    private getDeviceOverride;
    private getSchedulerTickSeconds;
    private buildAccessoryConfig;
    private getFeatureConfig;
    private removeAccessoryByIotId;
    private logConfigStartupChecks;
    private logDetectedDeviceSummary;
}
//# sourceMappingURL=platform.d.ts.map