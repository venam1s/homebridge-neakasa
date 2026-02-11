import { PlatformConfig } from 'homebridge';

export interface NeakasaPlatformConfig extends PlatformConfig {
  username: string;
  password: string;
  pollInterval?: number;
  debug?: boolean;
  deviceName?: string;
  // Optional switches (all default false)
  showChildLock?: boolean;
  showAutoBury?: boolean;
  showAutoLevel?: boolean;
  showSilentMode?: boolean;
  showUnstoppableCycle?: boolean;
  showAutoRecovery?: boolean;
  showYoungCatMode?: boolean;
  // Optional sensors (all default false)
  showBinStateSensor?: boolean;
  showWifiSensor?: boolean;
  showCatSensors?: boolean;
  showSandLevelSensor?: boolean;
  // Unit preference
  useImperialUnits?: boolean;
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
  // Add other properties as needed
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

export const SandLevel = {
  INSUFFICIENT: 0,
  MODERATE: 1,
  SUFFICIENT: 2,
  OVERFILLED: 3,
} as const;

export const SandLevelName: Record<number, string> = {
  0: 'Insufficient',
  1: 'Moderate',
  2: 'Sufficient',
  3: 'Overfilled',
};

export const BucketStatus: Record<number, string> = {
  0: 'Idle',
  1: 'Cleaning',
  2: 'Leveling',
  3: 'Flipover',
  4: 'Cat Present',
  5: 'Paused',
  6: 'Panels Missing',
  7: 'Interrupted',
};

export const BinState: Record<number, string> = {
  0: 'Normal',
  1: 'Full',
  2: 'Missing',
};

