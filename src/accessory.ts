import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { NeakasaPlatform } from './platform';
import { DeviceData, SandLevel, SandLevelName, BucketStatus, BinState, NeakasaPlatformConfig } from './types';

export class NeakasaAccessory {
  private services: Map<string, Service> = new Map();
  private deviceData?: DeviceData;
  private readonly config: NeakasaPlatformConfig;

  constructor(
    private readonly platform: NeakasaPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly iotId: string,
    private readonly deviceName: string,
    config: NeakasaPlatformConfig,
  ) {
    this.config = config;

    // Set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Neakasa')
      .setCharacteristic(this.platform.Characteristic.Model, 'M1')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, iotId);

    this.setupServices();
  }

  private setServiceName(service: Service, name: string): void {
    service.setCharacteristic(this.platform.Characteristic.Name, name);
    service.setCharacteristic(this.platform.Characteristic.ConfiguredName, name);
  }

  private setupServices(): void {
    // === CORE SERVICES (always shown) ===

    // Occupancy Sensor (bin full)
    const binSensor = this.accessory.getService('bin-full') ||
      this.accessory.addService(this.platform.Service.OccupancySensor, 'Waste Bin Full', 'bin-full');
    this.setServiceName(binSensor, 'Waste Bin Full');
    this.services.set('binFull', binSensor);

    // Switch: Auto Clean
    this.addSwitch('autoClean', 'Auto Clean', 'auto-clean', this.setAutoClean, this.getAutoClean);

    // Button: Clean Now (stateless)
    const cleanSwitch = this.accessory.getService('clean-now') ||
      this.accessory.addService(this.platform.Service.Switch, 'Clean Now', 'clean-now');
    this.setServiceName(cleanSwitch, 'Clean Now');
    cleanSwitch.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.cleanNow.bind(this))
      .onGet(() => false);
    this.services.set('clean', cleanSwitch);

    // Button: Level Now (stateless)
    const levelSwitch = this.accessory.getService('level-now') ||
      this.accessory.addService(this.platform.Service.Switch, 'Level Now', 'level-now');
    this.setServiceName(levelSwitch, 'Level Now');
    levelSwitch.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.levelNow.bind(this))
      .onGet(() => false);
    this.services.set('level', levelSwitch);

    // Status sensor (ContactSensor)
    const statusSensor = this.accessory.getService('device-status') ||
      this.accessory.addService(this.platform.Service.ContactSensor, 'Status', 'device-status');
    this.setServiceName(statusSensor, 'Status');
    this.services.set('status', statusSensor);

    // Cat Present (OccupancySensor)
    const catPresentSensor = this.accessory.getService('cat-present') ||
      this.accessory.addService(this.platform.Service.OccupancySensor, 'Cat Present', 'cat-present');
    this.setServiceName(catPresentSensor, 'Cat Present');
    this.services.set('catPresent', catPresentSensor);

    // Litter Level (FilterMaintenance)
    const filterService = this.accessory.getService(this.platform.Service.FilterMaintenance) ||
      this.accessory.addService(this.platform.Service.FilterMaintenance, 'Litter Level', 'sand-level');
    this.setServiceName(filterService, 'Litter Level');
    this.services.set('filter', filterService);

    // === OPTIONAL SWITCHES (off by default) ===

    if (this.config.showChildLock === true) {
      const lockService = this.accessory.getService('child-lock') ||
        this.accessory.addService(this.platform.Service.LockMechanism, 'Child Lock', 'child-lock');
      this.setServiceName(lockService, 'Child Lock');
      lockService.getCharacteristic(this.platform.Characteristic.LockCurrentState)
        .onGet(this.getChildLockState.bind(this));
      lockService.getCharacteristic(this.platform.Characteristic.LockTargetState)
        .onSet(this.setChildLock.bind(this))
        .onGet(this.getChildLockState.bind(this));
      this.services.set('childLock', lockService);
    } else {
      this.removeServiceIfExists('child-lock');
    }

    this.addOptionalSwitch('autoBury', 'Auto Bury', 'auto-bury',
      this.config.showAutoBury, this.setAutoBury, this.getAutoBury);

    this.addOptionalSwitch('autoLevel', 'Auto Level', 'auto-level',
      this.config.showAutoLevel, this.setAutoLevel, this.getAutoLevel);

    this.addOptionalSwitch('silentMode', 'Silent Mode', 'silent-mode',
      this.config.showSilentMode, this.setSilentMode, this.getSilentMode);

    this.addOptionalSwitch('unstoppable', 'Unstoppable Cycle', 'unstoppable-cycle',
      this.config.showUnstoppableCycle, this.setUnstoppableCycle, this.getUnstoppableCycle);

    this.addOptionalSwitch('autoRecovery', 'Auto Recovery', 'auto-recovery',
      this.config.showAutoRecovery, this.setAutoRecovery, this.getAutoRecovery);

    this.addOptionalSwitch('youngCatMode', 'Young Cat Mode', 'young-cat-mode',
      this.config.showYoungCatMode, this.setYoungCatMode, this.getYoungCatMode);

    // === OPTIONAL SENSORS (off by default) ===

    if (this.config.showBinStateSensor === true) {
      const binStateSensor = this.accessory.getService('bin-state') ||
        this.accessory.addService(this.platform.Service.LeakSensor, 'Bin State', 'bin-state');
      this.setServiceName(binStateSensor, 'Bin State');
      this.services.set('binState', binStateSensor);
    } else {
      this.removeServiceIfExists('bin-state');
    }

    if (this.config.showWifiSensor === true) {
      const wifiSensor = this.accessory.getService('wifi-signal') ||
        this.accessory.addService(this.platform.Service.HumiditySensor, 'WiFi Signal', 'wifi-signal');
      this.setServiceName(wifiSensor, 'WiFi Signal');
      this.services.set('wifi', wifiSensor);
    } else {
      this.removeServiceIfExists('wifi-signal');
    }

    if (this.config.showSandLevelSensor === true) {
      const sandSensor = this.accessory.getService('sand-level-state') ||
        this.accessory.addService(this.platform.Service.ContactSensor, 'Sand Level State', 'sand-level-state');
      this.setServiceName(sandSensor, 'Sand Level State');
      this.services.set('sandLevelState', sandSensor);
    } else {
      this.removeServiceIfExists('sand-level-state');
    }
  }

  private addSwitch(
    key: string,
    name: string,
    subType: string,
    setter: (value: CharacteristicValue) => Promise<void>,
    getter: () => Promise<CharacteristicValue>,
  ): void {
    const service = this.accessory.getService(subType) ||
      this.accessory.addService(this.platform.Service.Switch, name, subType);
    this.setServiceName(service, name);
    service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(setter.bind(this))
      .onGet(getter.bind(this));
    this.services.set(key, service);
  }

  private addOptionalSwitch(
    key: string,
    name: string,
    subType: string,
    enabled: boolean | undefined,
    setter: (value: CharacteristicValue) => Promise<void>,
    getter: () => Promise<CharacteristicValue>,
  ): void {
    if (enabled === true) {
      this.addSwitch(key, name, subType, setter, getter);
    } else {
      this.removeServiceIfExists(subType);
    }
  }

  private removeServiceIfExists(subType: string): void {
    const existing = this.accessory.getService(subType);
    if (existing) {
      this.accessory.removeService(existing);
    }
  }

  private rssiToPercent(rssi: number): number {
    if (rssi >= -50) {
      return 100;
    }
    if (rssi <= -100) {
      return 0;
    }
    return 2 * (rssi + 100);
  }

  async updateData(data: DeviceData): Promise<void> {
    this.deviceData = data;

    // Core: Litter Level
    const filterService = this.services.get('filter')!;
    const changeIndication = data.sandLevelState === SandLevel.INSUFFICIENT ?
      this.platform.Characteristic.FilterChangeIndication.CHANGE_FILTER :
      this.platform.Characteristic.FilterChangeIndication.FILTER_OK;
    filterService.updateCharacteristic(this.platform.Characteristic.FilterChangeIndication, changeIndication);
    filterService.updateCharacteristic(this.platform.Characteristic.FilterLifeLevel, data.sandLevelPercent);

    // Core: Waste Bin Full
    const binSensor = this.services.get('binFull')!;
    binSensor.updateCharacteristic(
      this.platform.Characteristic.OccupancyDetected,
      data.binFullWaitReset ?
        this.platform.Characteristic.OccupancyDetected.OCCUPANCY_DETECTED :
        this.platform.Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED,
    );

    // Core: Auto Clean
    this.services.get('autoClean')!.updateCharacteristic(this.platform.Characteristic.On, data.cleanCfg?.active === 1);

    // Core: Status sensor
    const statusSensor = this.services.get('status')!;
    const isActive = data.bucketStatus !== 0;
    statusSensor.updateCharacteristic(
      this.platform.Characteristic.ContactSensorState,
      isActive ?
        this.platform.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED :
        this.platform.Characteristic.ContactSensorState.CONTACT_DETECTED,
    );
    const statusName = BucketStatus[data.bucketStatus] || `Unknown (${data.bucketStatus})`;
    statusSensor.updateCharacteristic(this.platform.Characteristic.Name, statusName);

    // Core: Cat Present
    const catPresentSensor = this.services.get('catPresent')!;
    catPresentSensor.updateCharacteristic(
      this.platform.Characteristic.OccupancyDetected,
      data.bucketStatus === 4 ?
        this.platform.Characteristic.OccupancyDetected.OCCUPANCY_DETECTED :
        this.platform.Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED,
    );

    // Optional switches (only update if service exists)
    const childLockService = this.services.get('childLock');
    if (childLockService) {
      const lockState = data.childLockOnOff ?
        this.platform.Characteristic.LockCurrentState.SECURED :
        this.platform.Characteristic.LockCurrentState.UNSECURED;
      childLockService.updateCharacteristic(this.platform.Characteristic.LockCurrentState, lockState);
      childLockService.updateCharacteristic(this.platform.Characteristic.LockTargetState, lockState);
    }
    this.services.get('autoBury')?.updateCharacteristic(this.platform.Characteristic.On, data.autoBury);
    this.services.get('autoLevel')?.updateCharacteristic(this.platform.Characteristic.On, data.autoLevel);
    this.services.get('silentMode')?.updateCharacteristic(this.platform.Characteristic.On, data.silentMode);
    this.services.get('unstoppable')?.updateCharacteristic(this.platform.Characteristic.On, data.bIntrptRangeDet);
    this.services.get('autoRecovery')?.updateCharacteristic(this.platform.Characteristic.On, data.autoForceInit);
    this.services.get('youngCatMode')?.updateCharacteristic(this.platform.Characteristic.On, data.youngCatMode);

    // Optional: Bin State sensor
    const binStateSensor = this.services.get('binState');
    if (binStateSensor) {
      const leakDetected = data.room_of_bin !== 0;
      binStateSensor.updateCharacteristic(
        this.platform.Characteristic.LeakDetected,
        leakDetected ?
          this.platform.Characteristic.LeakDetected.LEAK_DETECTED :
          this.platform.Characteristic.LeakDetected.LEAK_NOT_DETECTED,
      );
      const binStateName = BinState[data.room_of_bin] || `Unknown (${data.room_of_bin})`;
      binStateSensor.updateCharacteristic(this.platform.Characteristic.Name, binStateName);
    }

    // Optional: WiFi Signal sensor
    const wifiSensor = this.services.get('wifi');
    if (wifiSensor) {
      const signalPercent = this.rssiToPercent(data.wifiRssi);
      wifiSensor.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, signalPercent);
    }

    // Optional: Sand Level State sensor
    const sandSensor = this.services.get('sandLevelState');
    if (sandSensor) {
      const isInsufficient = data.sandLevelState === SandLevel.INSUFFICIENT;
      sandSensor.updateCharacteristic(
        this.platform.Characteristic.ContactSensorState,
        isInsufficient ?
          this.platform.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED :
          this.platform.Characteristic.ContactSensorState.CONTACT_DETECTED,
      );
      const sandStateName = SandLevelName[data.sandLevelState] || `Unknown (${data.sandLevelState})`;
      sandSensor.updateCharacteristic(this.platform.Characteristic.Name, sandStateName);
    }

    // Optional: Cat Weight sensors
    if (this.config.showCatSensors === true && data.cat_list && data.cat_list.length > 0) {
      this.updateCatSensors(data);
    }

    this.platform.log.debug(
      `Updated ${this.deviceName}: Status=${BucketStatus[data.bucketStatus] || data.bucketStatus}, ` +
      `Sand=${data.sandLevelPercent}%, Bin=${BinState[data.room_of_bin] || data.room_of_bin}`,
    );
  }

  private updateCatSensors(data: DeviceData): void {
    for (const cat of data.cat_list) {
      const subType = `cat-${cat.id}`;
      let catSensor = this.services.get(subType);

      if (!catSensor) {
        const existingService = this.accessory.getService(subType);
        if (existingService) {
          catSensor = existingService;
        } else {
          catSensor = this.accessory.addService(
            this.platform.Service.HumiditySensor,
            cat.name,
            subType,
          );
        }
        this.setServiceName(catSensor, cat.name);
        this.services.set(subType, catSensor);
      }

      const catRecords = data.record_list
        .filter(r => r.cat_id === cat.id)
        .sort((a, b) => b.end_time - a.end_time);

      if (catRecords.length > 0) {
        const latestRecord = catRecords[0];
        let weight = latestRecord.weight; // weight in kg from API

        // Convert to lbs if imperial units are enabled
        if (this.config.useImperialUnits === true) {
          weight = weight * 2.20462; // Convert kg to lbs
        }

        // Cap at 0-100 for HomeKit humidity sensor display
        const displayWeight = Math.min(100, Math.max(0, Math.round(weight)));
        catSensor.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, displayWeight);
      }
    }
  }

  // Switch handlers
  async setAutoClean(value: CharacteristicValue): Promise<void> {
    const newValue = value as boolean;
    try {
      const cleanCfg = this.deviceData?.cleanCfg || { active: 0 };
      cleanCfg.active = newValue ? 1 : 0;
      await this.platform.neakasaApi.setDeviceProperties(this.iotId, { cleanCfg });
      this.platform.log.info(`Set Auto Clean to ${newValue}`);
    } catch (error) {
      this.platform.log.error(`Failed to set Auto Clean: ${error}`);
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  async getAutoClean(): Promise<CharacteristicValue> {
    return this.deviceData?.cleanCfg?.active === 1;
  }

  async setChildLock(value: CharacteristicValue): Promise<void> {
    const locked = value === this.platform.Characteristic.LockTargetState.SECURED;
    try {
      await this.platform.neakasaApi.setDeviceProperties(this.iotId, { childLockOnOff: locked ? 1 : 0 });
      this.platform.log.info(`Set Child Lock to ${locked ? 'Locked' : 'Unlocked'}`);
      // Update current state to match target
      this.services.get('childLock')?.updateCharacteristic(
        this.platform.Characteristic.LockCurrentState,
        locked ?
          this.platform.Characteristic.LockCurrentState.SECURED :
          this.platform.Characteristic.LockCurrentState.UNSECURED,
      );
    } catch (error) {
      this.platform.log.error(`Failed to set Child Lock: ${error}`);
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  async getChildLockState(): Promise<CharacteristicValue> {
    return this.deviceData?.childLockOnOff ?
      this.platform.Characteristic.LockCurrentState.SECURED :
      this.platform.Characteristic.LockCurrentState.UNSECURED;
  }

  async setAutoBury(value: CharacteristicValue): Promise<void> {
    const newValue = value as boolean;
    try {
      await this.platform.neakasaApi.setDeviceProperties(this.iotId, { autoBury: newValue ? 1 : 0 });
      this.platform.log.info(`Set Auto Bury to ${newValue}`);
    } catch (error) {
      this.platform.log.error(`Failed to set Auto Bury: ${error}`);
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  async getAutoBury(): Promise<CharacteristicValue> {
    return this.deviceData?.autoBury || false;
  }

  async setAutoLevel(value: CharacteristicValue): Promise<void> {
    const newValue = value as boolean;
    try {
      await this.platform.neakasaApi.setDeviceProperties(this.iotId, { autoLevel: newValue ? 1 : 0 });
      this.platform.log.info(`Set Auto Level to ${newValue}`);
    } catch (error) {
      this.platform.log.error(`Failed to set Auto Level: ${error}`);
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  async getAutoLevel(): Promise<CharacteristicValue> {
    return this.deviceData?.autoLevel || false;
  }

  async setSilentMode(value: CharacteristicValue): Promise<void> {
    const newValue = value as boolean;
    try {
      await this.platform.neakasaApi.setDeviceProperties(this.iotId, { silentMode: newValue ? 1 : 0 });
      this.platform.log.info(`Set Silent Mode to ${newValue}`);
    } catch (error) {
      this.platform.log.error(`Failed to set Silent Mode: ${error}`);
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  async getSilentMode(): Promise<CharacteristicValue> {
    return this.deviceData?.silentMode || false;
  }

  async setUnstoppableCycle(value: CharacteristicValue): Promise<void> {
    const newValue = value as boolean;
    try {
      await this.platform.neakasaApi.setDeviceProperties(this.iotId, { bIntrptRangeDet: newValue ? 1 : 0 });
      this.platform.log.info(`Set Unstoppable Cycle to ${newValue}`);
    } catch (error) {
      this.platform.log.error(`Failed to set Unstoppable Cycle: ${error}`);
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  async getUnstoppableCycle(): Promise<CharacteristicValue> {
    return this.deviceData?.bIntrptRangeDet || false;
  }

  async setAutoRecovery(value: CharacteristicValue): Promise<void> {
    const newValue = value as boolean;
    try {
      await this.platform.neakasaApi.setDeviceProperties(this.iotId, { autoForceInit: newValue ? 1 : 0 });
      this.platform.log.info(`Set Auto Recovery to ${newValue}`);
    } catch (error) {
      this.platform.log.error(`Failed to set Auto Recovery: ${error}`);
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  async getAutoRecovery(): Promise<CharacteristicValue> {
    return this.deviceData?.autoForceInit || false;
  }

  async setYoungCatMode(value: CharacteristicValue): Promise<void> {
    const newValue = value as boolean;
    try {
      await this.platform.neakasaApi.setDeviceProperties(this.iotId, { youngCatMode: newValue ? 1 : 0 });
      this.platform.log.info(`Set Young Cat Mode to ${newValue}`);
    } catch (error) {
      this.platform.log.error(`Failed to set Young Cat Mode: ${error}`);
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  async getYoungCatMode(): Promise<CharacteristicValue> {
    return this.deviceData?.youngCatMode || false;
  }

  async cleanNow(value: CharacteristicValue): Promise<void> {
    if (value) {
      try {
        await this.platform.neakasaApi.cleanNow(this.iotId);
        this.platform.log.info(`Triggered clean for ${this.deviceName}`);
        setTimeout(() => {
          this.services.get('clean')!.updateCharacteristic(this.platform.Characteristic.On, false);
        }, 1000);
      } catch (error) {
        this.platform.log.error(`Failed to trigger clean: ${error}`);
        throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
      }
    }
  }

  async levelNow(value: CharacteristicValue): Promise<void> {
    if (value) {
      try {
        await this.platform.neakasaApi.sandLeveling(this.iotId);
        this.platform.log.info(`Triggered leveling for ${this.deviceName}`);
        setTimeout(() => {
          this.services.get('level')!.updateCharacteristic(this.platform.Characteristic.On, false);
        }, 1000);
      } catch (error) {
        this.platform.log.error(`Failed to trigger leveling: ${error}`);
        throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
      }
    }
  }
}
