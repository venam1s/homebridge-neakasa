import { PlatformConfig } from 'homebridge';
export interface NeakasaPlatformConfig extends PlatformConfig {
    username: string;
    password: string;
    pollInterval?: number;
    debug?: boolean;
}
export interface NeakasaDevice {
    iotId: string;
    deviceName: string;
    productKey: string;
    deviceSecret: string;
    gmtCreate: number;
    gmtModified: number;
    status: string;
}
export interface DeviceProperties {
    binFullWaitReset: PropertyValue<number>;
    cleanCfg: PropertyValue<CleanConfig>;
    youngCatMode: PropertyValue<number>;
    childLockOnOff: PropertyValue<number>;
    autoBury: PropertyValue<number>;
    autoLevel: PropertyValue<number>;
    silentMode: PropertyValue<number>;
    autoForceInit: PropertyValue<number>;
    bIntrptRangeDet: PropertyValue<number>;
    Sand: PropertyValue<SandInfo>;
    NetWorkStatus: PropertyValue<NetworkStatus>;
    bucketStatus: PropertyValue<number>;
    room_of_bin: PropertyValue<number>;
    catLeft: CatLeftInfo;
}
export interface PropertyValue<T> {
    value: T;
    time: number;
}
export interface CleanConfig {
    active: number;
}
export interface SandInfo {
    percent: number;
    level: number;
}
export interface NetworkStatus {
    WiFi_RSSI: number;
}
export interface CatLeftInfo {
    value: {
        stayTime?: number;
    };
    time: number;
}
export interface CatInfo {
    id: string;
    name: string;
}
export interface CatRecord {
    cat_id: string;
    weight: number;
    start_time: number;
    end_time: number;
}
export interface RecordsResponse {
    cat_list: CatInfo[];
    record_list: CatRecord[];
}
export interface DeviceData {
    binFullWaitReset: boolean;
    cleanCfg: CleanConfig;
    youngCatMode: boolean;
    childLockOnOff: boolean;
    autoBury: boolean;
    autoLevel: boolean;
    silentMode: boolean;
    autoForceInit: boolean;
    bIntrptRangeDet: boolean;
    sandLevelPercent: number;
    wifiRssi: number;
    bucketStatus: number;
    room_of_bin: number;
    sandLevelState: number;
    stayTime: number;
    lastUse: number;
    cat_list: CatInfo[];
    record_list: CatRecord[];
}
export declare const BucketStatus: {
    readonly IDLE: 0;
    readonly CLEANING_1: 1;
    readonly CLEANING_2: 2;
    readonly LEVELING: 3;
    readonly FLIPOVER: 4;
    readonly CAT_PRESENT: 5;
    readonly PAUSED: 6;
    readonly SIDE_BIN_MISSING: 7;
    readonly UNKNOWN: 8;
    readonly CLEANING_INTERRUPTED: 9;
};
export declare const SandLevel: {
    readonly INSUFFICIENT: 0;
    readonly MODERATE: 1;
    readonly SUFFICIENT: 2;
    readonly OVERFILLED: 3;
};
export declare const BinState: {
    readonly NORMAL: 0;
    readonly FULL: 1;
    readonly MISSING: 2;
};
//# sourceMappingURL=types.d.ts.map