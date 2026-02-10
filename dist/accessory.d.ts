import { PlatformAccessory, CharacteristicValue } from 'homebridge';
import { NeakasaPlatform } from './platform';
import { DeviceData, NeakasaPlatformConfig } from './types';
export declare class NeakasaAccessory {
    private readonly platform;
    private readonly accessory;
    private readonly iotId;
    private readonly deviceName;
    private services;
    private deviceData?;
    private readonly config;
    constructor(platform: NeakasaPlatform, accessory: PlatformAccessory, iotId: string, deviceName: string, config: NeakasaPlatformConfig);
    private setupServices;
    private addSwitch;
    private removeServiceIfExists;
    private rssiToPercent;
    updateData(data: DeviceData): Promise<void>;
    private updateCatSensors;
    setAutoClean(value: CharacteristicValue): Promise<void>;
    getAutoClean(): Promise<CharacteristicValue>;
    setChildLock(value: CharacteristicValue): Promise<void>;
    getChildLock(): Promise<CharacteristicValue>;
    setAutoBury(value: CharacteristicValue): Promise<void>;
    getAutoBury(): Promise<CharacteristicValue>;
    setAutoLevel(value: CharacteristicValue): Promise<void>;
    getAutoLevel(): Promise<CharacteristicValue>;
    setSilentMode(value: CharacteristicValue): Promise<void>;
    getSilentMode(): Promise<CharacteristicValue>;
    setUnstoppableCycle(value: CharacteristicValue): Promise<void>;
    getUnstoppableCycle(): Promise<CharacteristicValue>;
    setAutoRecovery(value: CharacteristicValue): Promise<void>;
    getAutoRecovery(): Promise<CharacteristicValue>;
    setYoungCatMode(value: CharacteristicValue): Promise<void>;
    getYoungCatMode(): Promise<CharacteristicValue>;
    cleanNow(value: CharacteristicValue): Promise<void>;
    levelNow(value: CharacteristicValue): Promise<void>;
}
//# sourceMappingURL=accessory.d.ts.map