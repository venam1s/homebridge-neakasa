import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { NeakasaAccessory } from './accessory';
import { NeakasaAPI } from './api';
import { NeakasaPlatformConfig, NeakasaDevice, DeviceData } from './types';

export class NeakasaPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  public readonly accessories: PlatformAccessory[] = [];
  public readonly neakasaApi: NeakasaAPI;

  private readonly deviceAccessories: Map<string, NeakasaAccessory> = new Map();
  private pollInterval?: NodeJS.Timeout;
  private readonly config: NeakasaPlatformConfig;

  constructor(
    public readonly log: Logger,
    config: PlatformConfig,
    public readonly api: API,
  ) {
    this.config = config as NeakasaPlatformConfig;
    this.neakasaApi = new NeakasaAPI(this.log);

    if (!this.config.username || !this.config.password) {
      this.log.error('Username and password are required in config');
      return;
    }

    this.log.debug('Finished initializing platform:', this.config.name);

    this.api.on('didFinishLaunching', () => {
      this.log.debug('Executed didFinishLaunching callback');
      this.discoverDevices();
    });

    this.api.on('shutdown', () => {
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
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

      const displayName = this.config.deviceName || 'Neakasa M1';

      for (const device of devices) {
        const uuid = this.api.hap.uuid.generate(device.iotId);
        const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

        if (existingAccessory) {
          this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
          existingAccessory.context.device = device;
          this.api.updatePlatformAccessories([existingAccessory]);

          const accessory = new NeakasaAccessory(this, existingAccessory, device.iotId, device.deviceName, this.config);
          this.deviceAccessories.set(device.iotId, accessory);
        } else {
          this.log.info('Adding new accessory:', displayName);
          const accessory = new this.api.platformAccessory(displayName, uuid);
          accessory.context.device = device;

          const neakasaAccessory = new NeakasaAccessory(this, accessory, device.iotId, device.deviceName, this.config);
          this.deviceAccessories.set(device.iotId, neakasaAccessory);

          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          this.accessories.push(accessory);
        }
      }

      // Remove devices that no longer exist
      const discoveredIotIds = new Set(devices.map(d => d.iotId));
      const accessoriesToRemove = this.accessories.filter(accessory => {
        const iotId = accessory.context.device?.iotId;
        return iotId && !discoveredIotIds.has(iotId);
      });

      if (accessoriesToRemove.length > 0) {
        this.log.info(`Removing ${accessoriesToRemove.length} obsolete accessory(ies)`);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, accessoriesToRemove);
        for (const accessory of accessoriesToRemove) {
          const index = this.accessories.indexOf(accessory);
          if (index > -1) {
            this.accessories.splice(index, 1);
          }
        }
      }

      // Start polling for updates
      this.startPolling();
    } catch (error) {
      this.log.error('Failed to discover devices:', error);
    }
  }

  private startPolling(): void {
    const intervalSeconds = this.config.pollInterval || 60;
    this.log.info(`Starting polling every ${intervalSeconds} seconds`);

    // Initial update
    this.updateAllDevices();

    // Set up interval
    this.pollInterval = setInterval(() => {
      this.updateAllDevices();
    }, intervalSeconds * 1000);
  }

  private async updateAllDevices(): Promise<void> {
    for (const [iotId, accessory] of this.deviceAccessories.entries()) {
      try {
        await this.updateDevice(iotId, accessory);
      } catch (error) {
        this.log.error(`Failed to update device ${iotId}:`, error);
        
        // Try to reconnect if it's an auth error
        if (error instanceof Error && error.message.includes('not connected')) {
          this.log.warn('Attempting to reconnect to Neakasa API...');
          try {
            await this.neakasaApi.connect(this.config.username, this.config.password);
            this.log.info('Reconnected successfully, retrying device update...');
            await this.updateDevice(iotId, accessory);
          } catch (reconnectError) {
            this.log.error('Failed to reconnect:', reconnectError);
          }
        }
      }
    }
  }

  private async updateDevice(iotId: string, accessory: NeakasaAccessory): Promise<void> {
    try {
      const properties = await this.neakasaApi.getDeviceProperties(iotId);
      
      // Get records for cat data
      const deviceContext = this.accessories.find(acc => acc.context.device?.iotId === iotId)?.context.device;
      let catList: any[] = [];
      let recordList: any[] = [];
      
      if (deviceContext) {
        try {
          const records = await this.neakasaApi.getRecords(deviceContext.deviceName);
          catList = records.cat_list || [];
          recordList = records.record_list || [];
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
    } catch (error) {
      throw error;
    }
  }
}
