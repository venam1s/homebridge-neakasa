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
    private pollInterval?;
    private readonly config;
    constructor(log: Logger, config: PlatformConfig, api: API);
    configureAccessory(accessory: PlatformAccessory): void;
    discoverDevices(): Promise<void>;
    private startPolling;
    private updateAllDevices;
    private updateDevice;
}
//# sourceMappingURL=platform.d.ts.map