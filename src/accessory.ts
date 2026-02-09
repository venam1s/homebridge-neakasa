import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { NeakasaPlatform } from './platform';
import { DeviceData, SandLevel } from './types';

export class NeakasaAccessory {
  private services: Map<string, Service> = new Map();
  private deviceData?: DeviceData;

  constructor(
    private readonly platform: NeakasaPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly iotId: string,
    private readonly deviceName: string,
  ) {
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
      this.accessory.addService(this.platform.Service.OccupancySensor, 'Bin Full', 'bin-full');
    binSensor.setCharacteristic(this.platform.Characteristic.Name, 'Bin Full');
    this.services.set('binFull', binSensor);

    // Switch for Auto Clean
    const autoCleanSwitch = this.accessory.getService('auto-clean') ||
      this.accessory.addService(this.platform.Service.Switch, 'Auto Clean', 'auto-clean');
    autoCleanSwitch.setCharacteristic(this.platform.Characteristic.Name, 'Auto Clean');
    autoCleanSwitch.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setAutoClean.bind(this))
      .onGet(this.getAutoClean.bind(this));
    this.services.set('autoClean', autoCleanSwitch);

    // Switch for Child Lock
    const childLockSwitch = this.accessory.getService('child-lock') ||
      this.accessory.addService(this.platform.Service.Switch, 'Child Lock', 'child-lock');
    childLockSwitch.setCharacteristic(this.platform.Characteristic.Name, 'Child Lock');
    childLockSwitch.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setChildLock.bind(this))
      .onGet(this.getChildLock.bind(this));
    this.services.set('childLock', childLockSwitch);

    // Switch for Auto Bury
    const autoBurySwitch = this.accessory.getService('auto-bury') ||
      this.accessory.addService(this.platform.Service.Switch, 'Auto Cover', 'auto-bury');
    autoBurySwitch.setCharacteristic(this.platform.Characteristic.Name, 'Auto Cover');
    autoBurySwitch.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setAutoBury.bind(this))
      .onGet(this.getAutoBury.bind(this));
    this.services.set('autoBury', autoBurySwitch);

    // Switch for Auto Level
    const autoLevelSwitch = this.accessory.getService('auto-level') ||
      this.accessory.addService(this.platform.Service.Switch, 'Auto Leveling', 'auto-level');
    autoLevelSwitch.setCharacteristic(this.platform.Characteristic.Name, 'Auto Leveling');
    autoLevelSwitch.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setAutoLevel.bind(this))
      .onGet(this.getAutoLevel.bind(this));
    this.services.set('autoLevel', autoLevelSwitch);

    // Switch for Silent Mode
    const silentModeSwitch = this.accessory.getService('silent-mode') ||
      this.accessory.addService(this.platform.Service.Switch, 'Silent Mode', 'silent-mode');
    silentModeSwitch.setCharacteristic(this.platform.Characteristic.Name, 'Silent Mode');
    silentModeSwitch.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setSilentMode.bind(this))
      .onGet(this.getSilentMode.bind(this));
    this.services.set('silentMode', silentModeSwitch);

    // Switch for Unstoppable Cycle
    const unstoppableSwitch = this.accessory.getService('unstoppable-cycle') ||
      this.accessory.addService(this.platform.Service.Switch, 'Unstoppable Cycle', 'unstoppable-cycle');
    unstoppableSwitch.setCharacteristic(this.platform.Characteristic.Name, 'Unstoppable Cycle');
    unstoppableSwitch.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setUnstoppableCycle.bind(this))
      .onGet(this.getUnstoppableCycle.bind(this));
    this.services.set('unstoppable', unstoppableSwitch);

    // Switch for Clean Now (as a stateless button)
    const cleanSwitch = this.accessory.getService('clean-now') ||
      this.accessory.addService(this.platform.Service.Switch, 'Clean Now', 'clean-now');
    cleanSwitch.setCharacteristic(this.platform.Characteristic.Name, 'Clean Now');
    cleanSwitch.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.cleanNow.bind(this))
      .onGet(() => false);
    this.services.set('clean', cleanSwitch);

    // Switch for Level Now (as a stateless button)
    const levelSwitch = this.accessory.getService('level-now') ||
      this.accessory.addService(this.platform.Service.Switch, 'Level Now', 'level-now');
    levelSwitch.setCharacteristic(this.platform.Characteristic.Name, 'Level Now');
    levelSwitch.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.levelNow.bind(this))
      .onGet(() => false);
    this.services.set('level', levelSwitch);
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

    this.platform.log.debug(`Updated data for ${this.deviceName}: Sand ${data.sandLevelPercent}%, Status ${data.bucketStatus}`);
  }

  // Switch handlers
  async setAutoClean(value: CharacteristicValue): Promise<void> {
    const newValue = value as boolean;
    try {
      const cleanCfg = this.deviceData?.cleanCfg || { active: 0 };
      cleanCfg.active = newValue ? 1 : 0;
      await this.platform.neakasaApi.setDeviceProperties(this.iotId, { cleanCfg });
      this.platform.log.info(`Set Auto Clean to ${newValue} for ${this.deviceName}`);
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
      this.platform.log.info(`Set Child Lock to ${newValue} for ${this.deviceName}`);
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
      this.platform.log.info(`Set Auto Cover to ${newValue} for ${this.deviceName}`);
    } catch (error) {
      this.platform.log.error(`Failed to set Auto Cover: ${error}`);
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
      this.platform.log.info(`Set Auto Leveling to ${newValue} for ${this.deviceName}`);
    } catch (error) {
      this.platform.log.error(`Failed to set Auto Leveling: ${error}`);
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
      this.platform.log.info(`Set Silent Mode to ${newValue} for ${this.deviceName}`);
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
      this.platform.log.info(`Set Unstoppable Cycle to ${newValue} for ${this.deviceName}`);
    } catch (error) {
      this.platform.log.error(`Failed to set Unstoppable Cycle: ${error}`);
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  async getUnstoppableCycle(): Promise<CharacteristicValue> {
    return this.deviceData?.bIntrptRangeDet || false;
  }

  async cleanNow(value: CharacteristicValue): Promise<void> {
    if (value) {
      try {
        await this.platform.neakasaApi.cleanNow(this.iotId);
        this.platform.log.info(`Triggered clean for ${this.deviceName}`);
        // Automatically turn off after triggering
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
        // Automatically turn off after triggering
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
