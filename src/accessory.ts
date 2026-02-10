import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { NeakasaPlatform } from './platform';
import { DeviceData, SandLevel, BucketStatus, BinState, NeakasaPlatformConfig } from './types';

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

  private setupServices(): void {
    // Filter Maintenance (for sand level)
    const filterService = this.accessory.getService(this.platform.Service.FilterMaintenance) ||
      this.accessory.addService(this.platform.Service.FilterMaintenance, 'Litter Level', 'sand-level');
    filterService.setCharacteristic(this.platform.Characteristic.Name, 'Litter Level');
    this.services.set('filter', filterService);

    // Occupancy Sensor (bin full)
    const binSensor = this.accessory.getService('bin-full') ||
      this.accessory.addService(this.platform.Service.OccupancySensor, 'Waste Bin Full', 'bin-full');
    binSensor.setCharacteristic(this.platform.Characteristic.Name, 'Waste Bin Full');
    this.services.set('binFull', binSensor);

    // Switch: Auto Clean
    this.addSwitch('autoClean', 'Auto Clean', 'auto-clean', this.setAutoClean, this.getAutoClean);

    // Switch: Child Lock
    this.addSwitch('childLock', 'Child Lock', 'child-lock', this.setChildLock, this.getChildLock);

    // Switch: Auto Bury
    this.addSwitch('autoBury', 'Auto Bury', 'auto-bury', this.setAutoBury, this.getAutoBury);

    // Switch: Auto Level
    this.addSwitch('autoLevel', 'Auto Level', 'auto-level', this.setAutoLevel, this.getAutoLevel);

    // Switch: Silent Mode
    this.addSwitch('silentMode', 'Silent Mode', 'silent-mode', this.setSilentMode, this.getSilentMode);

    // Switch: Unstoppable Cycle
    this.addSwitch('unstoppable', 'Unstoppable Cycle', 'unstoppable-cycle', this.setUnstoppableCycle, this.getUnstoppableCycle);

    // Switch: Auto Recovery
    this.addSwitch('autoRecovery', 'Auto Recovery', 'auto-recovery', this.setAutoRecovery, this.getAutoRecovery);

    // Switch: Young Cat Mode
    this.addSwitch('youngCatMode', 'Young Cat Mode', 'young-cat-mode', this.setYoungCatMode, this.getYoungCatMode);

    // Button: Clean Now (stateless)
    const cleanSwitch = this.accessory.getService('clean-now') ||
      this.accessory.addService(this.platform.Service.Switch, 'Clean Now', 'clean-now');
    cleanSwitch.setCharacteristic(this.platform.Characteristic.Name, 'Clean Now');
    cleanSwitch.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.cleanNow.bind(this))
      .onGet(() => false);
    this.services.set('clean', cleanSwitch);

    // Button: Level Now (stateless)
    const levelSwitch = this.accessory.getService('level-now') ||
      this.accessory.addService(this.platform.Service.Switch, 'Level Now', 'level-now');
    levelSwitch.setCharacteristic(this.platform.Characteristic.Name, 'Level Now');
    levelSwitch.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.levelNow.bind(this))
      .onGet(() => false);
    this.services.set('level', levelSwitch);

    // Optional: Current Status sensor (ContactSensor)
    if (this.config.showStatusSensor !== false) {
      const statusSensor = this.accessory.getService('device-status') ||
        this.accessory.addService(this.platform.Service.ContactSensor, 'Status', 'device-status');
      statusSensor.setCharacteristic(this.platform.Characteristic.Name, 'Status');
      this.services.set('status', statusSensor);
    } else {
      this.removeServiceIfExists('device-status');
    }

    // Optional: Bin State sensor (LeakSensor)
    if (this.config.showBinStateSensor !== false) {
      const binStateSensor = this.accessory.getService('bin-state') ||
        this.accessory.addService(this.platform.Service.LeakSensor, 'Bin State', 'bin-state');
      binStateSensor.setCharacteristic(this.platform.Characteristic.Name, 'Bin State');
      this.services.set('binState', binStateSensor);
    } else {
      this.removeServiceIfExists('bin-state');
    }

    // Optional: WiFi Signal sensor (HumiditySensor)
    if (this.config.showWifiSensor === true) {
      const wifiSensor = this.accessory.getService('wifi-signal') ||
        this.accessory.addService(this.platform.Service.HumiditySensor, 'WiFi Signal', 'wifi-signal');
      wifiSensor.setCharacteristic(this.platform.Characteristic.Name, 'WiFi Signal');
      this.services.set('wifi', wifiSensor);
    } else {
      this.removeServiceIfExists('wifi-signal');
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
    service.setCharacteristic(this.platform.Characteristic.Name, name);
    service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(setter.bind(this))
      .onGet(getter.bind(this));
    this.services.set(key, service);
  }

  private removeServiceIfExists(subType: string): void {
    const existing = this.accessory.getService(subType);
    if (existing) {
      this.accessory.removeService(existing);
    }
  }

  private rssiToPercent(rssi: number): number {
    // Convert dBm to 0-100% quality
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

    // Update Filter Maintenance (sand level)
    const filterService = this.services.get('filter')!;
    const changeIndication = data.sandLevelState === SandLevel.INSUFFICIENT ?
      this.platform.Characteristic.FilterChangeIndication.CHANGE_FILTER :
      this.platform.Characteristic.FilterChangeIndication.FILTER_OK;
    filterService.updateCharacteristic(this.platform.Characteristic.FilterChangeIndication, changeIndication);
    filterService.updateCharacteristic(this.platform.Characteristic.FilterLifeLevel, data.sandLevelPercent);

    // Update Bin Full sensor
    const binSensor = this.services.get('binFull')!;
    binSensor.updateCharacteristic(
      this.platform.Characteristic.OccupancyDetected,
      data.binFullWaitReset ?
        this.platform.Characteristic.OccupancyDetected.OCCUPANCY_DETECTED :
        this.platform.Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED,
    );

    // Update switches
    this.services.get('autoClean')!.updateCharacteristic(this.platform.Characteristic.On, data.cleanCfg?.active === 1);
    this.services.get('childLock')!.updateCharacteristic(this.platform.Characteristic.On, data.childLockOnOff);
    this.services.get('autoBury')!.updateCharacteristic(this.platform.Characteristic.On, data.autoBury);
    this.services.get('autoLevel')!.updateCharacteristic(this.platform.Characteristic.On, data.autoLevel);
    this.services.get('silentMode')!.updateCharacteristic(this.platform.Characteristic.On, data.silentMode);
    this.services.get('unstoppable')!.updateCharacteristic(this.platform.Characteristic.On, data.bIntrptRangeDet);
    this.services.get('autoRecovery')!.updateCharacteristic(this.platform.Characteristic.On, data.autoForceInit);
    this.services.get('youngCatMode')!.updateCharacteristic(this.platform.Characteristic.On, data.youngCatMode);

    // Update optional: Current Status sensor
    const statusSensor = this.services.get('status');
    if (statusSensor) {
      // ContactSensor: CONTACT_DETECTED (0) = idle, CONTACT_NOT_DETECTED (1) = active/busy
      const isActive = data.bucketStatus !== 0;
      statusSensor.updateCharacteristic(
        this.platform.Characteristic.ContactSensorState,
        isActive ?
          this.platform.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED :
          this.platform.Characteristic.ContactSensorState.CONTACT_DETECTED,
      );
      const statusName = BucketStatus[data.bucketStatus] || `Unknown (${data.bucketStatus})`;
      statusSensor.updateCharacteristic(this.platform.Characteristic.Name, statusName);
    }

    // Update optional: Bin State sensor
    const binStateSensor = this.services.get('binState');
    if (binStateSensor) {
      // LeakDetected when bin is full or missing
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

    // Update optional: WiFi Signal sensor
    const wifiSensor = this.services.get('wifi');
    if (wifiSensor) {
      const signalPercent = this.rssiToPercent(data.wifiRssi);
      wifiSensor.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, signalPercent);
    }

    // Update optional: Cat Weight sensors
    if (this.config.showCatSensors !== false && data.cat_list && data.cat_list.length > 0) {
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
        // Create sensor for this cat
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
        catSensor.setCharacteristic(this.platform.Characteristic.Name, cat.name);
        this.services.set(subType, catSensor);
      }

      // Find most recent record for this cat
      const catRecords = data.record_list
        .filter(r => r.cat_id === cat.id)
        .sort((a, b) => b.end_time - a.end_time);

      if (catRecords.length > 0) {
        const latestRecord = catRecords[0];
        // Use humidity characteristic to display weight (kg)
        // Clamp to 0-100 range for HomeKit
        const weight = Math.min(100, Math.max(0, latestRecord.weight));
        catSensor.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, weight);
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
    const newValue = value as boolean;
    try {
      await this.platform.neakasaApi.setDeviceProperties(this.iotId, { childLockOnOff: newValue ? 1 : 0 });
      this.platform.log.info(`Set Child Lock to ${newValue}`);
    } catch (error) {
      this.platform.log.error(`Failed to set Child Lock: ${error}`);
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  async getChildLock(): Promise<CharacteristicValue> {
    return this.deviceData?.childLockOnOff || false;
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
