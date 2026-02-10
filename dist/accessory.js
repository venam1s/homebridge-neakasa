"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NeakasaAccessory = void 0;
const types_1 = require("./types");
class NeakasaAccessory {
    constructor(platform, accessory, iotId, deviceName, config) {
        this.platform = platform;
        this.accessory = accessory;
        this.iotId = iotId;
        this.deviceName = deviceName;
        this.services = new Map();
        this.config = config;
        this.accessory.getService(this.platform.Service.AccessoryInformation)
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Neakasa')
            .setCharacteristic(this.platform.Characteristic.Model, 'M1')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, iotId);
        this.setupServices();
    }
    setupServices() {
        const filterService = this.accessory.getService(this.platform.Service.FilterMaintenance) ||
            this.accessory.addService(this.platform.Service.FilterMaintenance, 'Litter Level', 'sand-level');
        filterService.setCharacteristic(this.platform.Characteristic.Name, 'Litter Level');
        this.services.set('filter', filterService);
        const binSensor = this.accessory.getService('bin-full') ||
            this.accessory.addService(this.platform.Service.OccupancySensor, 'Waste Bin Full', 'bin-full');
        binSensor.setCharacteristic(this.platform.Characteristic.Name, 'Waste Bin Full');
        this.services.set('binFull', binSensor);
        this.addSwitch('autoClean', 'Auto Clean', 'auto-clean', this.setAutoClean, this.getAutoClean);
        this.addSwitch('childLock', 'Child Lock', 'child-lock', this.setChildLock, this.getChildLock);
        this.addSwitch('autoBury', 'Auto Bury', 'auto-bury', this.setAutoBury, this.getAutoBury);
        this.addSwitch('autoLevel', 'Auto Level', 'auto-level', this.setAutoLevel, this.getAutoLevel);
        this.addSwitch('silentMode', 'Silent Mode', 'silent-mode', this.setSilentMode, this.getSilentMode);
        this.addSwitch('unstoppable', 'Unstoppable Cycle', 'unstoppable-cycle', this.setUnstoppableCycle, this.getUnstoppableCycle);
        this.addSwitch('autoRecovery', 'Auto Recovery', 'auto-recovery', this.setAutoRecovery, this.getAutoRecovery);
        this.addSwitch('youngCatMode', 'Young Cat Mode', 'young-cat-mode', this.setYoungCatMode, this.getYoungCatMode);
        const cleanSwitch = this.accessory.getService('clean-now') ||
            this.accessory.addService(this.platform.Service.Switch, 'Clean Now', 'clean-now');
        cleanSwitch.setCharacteristic(this.platform.Characteristic.Name, 'Clean Now');
        cleanSwitch.getCharacteristic(this.platform.Characteristic.On)
            .onSet(this.cleanNow.bind(this))
            .onGet(() => false);
        this.services.set('clean', cleanSwitch);
        const levelSwitch = this.accessory.getService('level-now') ||
            this.accessory.addService(this.platform.Service.Switch, 'Level Now', 'level-now');
        levelSwitch.setCharacteristic(this.platform.Characteristic.Name, 'Level Now');
        levelSwitch.getCharacteristic(this.platform.Characteristic.On)
            .onSet(this.levelNow.bind(this))
            .onGet(() => false);
        this.services.set('level', levelSwitch);
        if (this.config.showStatusSensor !== false) {
            const statusSensor = this.accessory.getService('device-status') ||
                this.accessory.addService(this.platform.Service.ContactSensor, 'Status', 'device-status');
            statusSensor.setCharacteristic(this.platform.Characteristic.Name, 'Status');
            this.services.set('status', statusSensor);
        }
        else {
            this.removeServiceIfExists('device-status');
        }
        if (this.config.showBinStateSensor !== false) {
            const binStateSensor = this.accessory.getService('bin-state') ||
                this.accessory.addService(this.platform.Service.LeakSensor, 'Bin State', 'bin-state');
            binStateSensor.setCharacteristic(this.platform.Characteristic.Name, 'Bin State');
            this.services.set('binState', binStateSensor);
        }
        else {
            this.removeServiceIfExists('bin-state');
        }
        if (this.config.showWifiSensor === true) {
            const wifiSensor = this.accessory.getService('wifi-signal') ||
                this.accessory.addService(this.platform.Service.HumiditySensor, 'WiFi Signal', 'wifi-signal');
            wifiSensor.setCharacteristic(this.platform.Characteristic.Name, 'WiFi Signal');
            this.services.set('wifi', wifiSensor);
        }
        else {
            this.removeServiceIfExists('wifi-signal');
        }
    }
    addSwitch(key, name, subType, setter, getter) {
        const service = this.accessory.getService(subType) ||
            this.accessory.addService(this.platform.Service.Switch, name, subType);
        service.setCharacteristic(this.platform.Characteristic.Name, name);
        service.getCharacteristic(this.platform.Characteristic.On)
            .onSet(setter.bind(this))
            .onGet(getter.bind(this));
        this.services.set(key, service);
    }
    removeServiceIfExists(subType) {
        const existing = this.accessory.getService(subType);
        if (existing) {
            this.accessory.removeService(existing);
        }
    }
    rssiToPercent(rssi) {
        if (rssi >= -50) {
            return 100;
        }
        if (rssi <= -100) {
            return 0;
        }
        return 2 * (rssi + 100);
    }
    async updateData(data) {
        this.deviceData = data;
        const filterService = this.services.get('filter');
        const changeIndication = data.sandLevelState === types_1.SandLevel.INSUFFICIENT ?
            this.platform.Characteristic.FilterChangeIndication.CHANGE_FILTER :
            this.platform.Characteristic.FilterChangeIndication.FILTER_OK;
        filterService.updateCharacteristic(this.platform.Characteristic.FilterChangeIndication, changeIndication);
        filterService.updateCharacteristic(this.platform.Characteristic.FilterLifeLevel, data.sandLevelPercent);
        const binSensor = this.services.get('binFull');
        binSensor.updateCharacteristic(this.platform.Characteristic.OccupancyDetected, data.binFullWaitReset ?
            this.platform.Characteristic.OccupancyDetected.OCCUPANCY_DETECTED :
            this.platform.Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED);
        this.services.get('autoClean').updateCharacteristic(this.platform.Characteristic.On, data.cleanCfg?.active === 1);
        this.services.get('childLock').updateCharacteristic(this.platform.Characteristic.On, data.childLockOnOff);
        this.services.get('autoBury').updateCharacteristic(this.platform.Characteristic.On, data.autoBury);
        this.services.get('autoLevel').updateCharacteristic(this.platform.Characteristic.On, data.autoLevel);
        this.services.get('silentMode').updateCharacteristic(this.platform.Characteristic.On, data.silentMode);
        this.services.get('unstoppable').updateCharacteristic(this.platform.Characteristic.On, data.bIntrptRangeDet);
        this.services.get('autoRecovery').updateCharacteristic(this.platform.Characteristic.On, data.autoForceInit);
        this.services.get('youngCatMode').updateCharacteristic(this.platform.Characteristic.On, data.youngCatMode);
        const statusSensor = this.services.get('status');
        if (statusSensor) {
            const isActive = data.bucketStatus !== 0;
            statusSensor.updateCharacteristic(this.platform.Characteristic.ContactSensorState, isActive ?
                this.platform.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED :
                this.platform.Characteristic.ContactSensorState.CONTACT_DETECTED);
            const statusName = types_1.BucketStatus[data.bucketStatus] || `Unknown (${data.bucketStatus})`;
            statusSensor.updateCharacteristic(this.platform.Characteristic.Name, statusName);
        }
        const binStateSensor = this.services.get('binState');
        if (binStateSensor) {
            const leakDetected = data.room_of_bin !== 0;
            binStateSensor.updateCharacteristic(this.platform.Characteristic.LeakDetected, leakDetected ?
                this.platform.Characteristic.LeakDetected.LEAK_DETECTED :
                this.platform.Characteristic.LeakDetected.LEAK_NOT_DETECTED);
            const binStateName = types_1.BinState[data.room_of_bin] || `Unknown (${data.room_of_bin})`;
            binStateSensor.updateCharacteristic(this.platform.Characteristic.Name, binStateName);
        }
        const wifiSensor = this.services.get('wifi');
        if (wifiSensor) {
            const signalPercent = this.rssiToPercent(data.wifiRssi);
            wifiSensor.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, signalPercent);
        }
        if (this.config.showCatSensors !== false && data.cat_list && data.cat_list.length > 0) {
            this.updateCatSensors(data);
        }
        this.platform.log.debug(`Updated ${this.deviceName}: Status=${types_1.BucketStatus[data.bucketStatus] || data.bucketStatus}, ` +
            `Sand=${data.sandLevelPercent}%, Bin=${types_1.BinState[data.room_of_bin] || data.room_of_bin}`);
    }
    updateCatSensors(data) {
        for (const cat of data.cat_list) {
            const subType = `cat-${cat.id}`;
            let catSensor = this.services.get(subType);
            if (!catSensor) {
                const existingService = this.accessory.getService(subType);
                if (existingService) {
                    catSensor = existingService;
                }
                else {
                    catSensor = this.accessory.addService(this.platform.Service.HumiditySensor, cat.name, subType);
                }
                catSensor.setCharacteristic(this.platform.Characteristic.Name, cat.name);
                this.services.set(subType, catSensor);
            }
            const catRecords = data.record_list
                .filter(r => r.cat_id === cat.id)
                .sort((a, b) => b.end_time - a.end_time);
            if (catRecords.length > 0) {
                const latestRecord = catRecords[0];
                const weight = Math.min(100, Math.max(0, latestRecord.weight));
                catSensor.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, weight);
            }
        }
    }
    async setAutoClean(value) {
        const newValue = value;
        try {
            const cleanCfg = this.deviceData?.cleanCfg || { active: 0 };
            cleanCfg.active = newValue ? 1 : 0;
            await this.platform.neakasaApi.setDeviceProperties(this.iotId, { cleanCfg });
            this.platform.log.info(`Set Auto Clean to ${newValue}`);
        }
        catch (error) {
            this.platform.log.error(`Failed to set Auto Clean: ${error}`);
            throw new this.platform.api.hap.HapStatusError(-70402);
        }
    }
    async getAutoClean() {
        return this.deviceData?.cleanCfg?.active === 1;
    }
    async setChildLock(value) {
        const newValue = value;
        try {
            await this.platform.neakasaApi.setDeviceProperties(this.iotId, { childLockOnOff: newValue ? 1 : 0 });
            this.platform.log.info(`Set Child Lock to ${newValue}`);
        }
        catch (error) {
            this.platform.log.error(`Failed to set Child Lock: ${error}`);
            throw new this.platform.api.hap.HapStatusError(-70402);
        }
    }
    async getChildLock() {
        return this.deviceData?.childLockOnOff || false;
    }
    async setAutoBury(value) {
        const newValue = value;
        try {
            await this.platform.neakasaApi.setDeviceProperties(this.iotId, { autoBury: newValue ? 1 : 0 });
            this.platform.log.info(`Set Auto Bury to ${newValue}`);
        }
        catch (error) {
            this.platform.log.error(`Failed to set Auto Bury: ${error}`);
            throw new this.platform.api.hap.HapStatusError(-70402);
        }
    }
    async getAutoBury() {
        return this.deviceData?.autoBury || false;
    }
    async setAutoLevel(value) {
        const newValue = value;
        try {
            await this.platform.neakasaApi.setDeviceProperties(this.iotId, { autoLevel: newValue ? 1 : 0 });
            this.platform.log.info(`Set Auto Level to ${newValue}`);
        }
        catch (error) {
            this.platform.log.error(`Failed to set Auto Level: ${error}`);
            throw new this.platform.api.hap.HapStatusError(-70402);
        }
    }
    async getAutoLevel() {
        return this.deviceData?.autoLevel || false;
    }
    async setSilentMode(value) {
        const newValue = value;
        try {
            await this.platform.neakasaApi.setDeviceProperties(this.iotId, { silentMode: newValue ? 1 : 0 });
            this.platform.log.info(`Set Silent Mode to ${newValue}`);
        }
        catch (error) {
            this.platform.log.error(`Failed to set Silent Mode: ${error}`);
            throw new this.platform.api.hap.HapStatusError(-70402);
        }
    }
    async getSilentMode() {
        return this.deviceData?.silentMode || false;
    }
    async setUnstoppableCycle(value) {
        const newValue = value;
        try {
            await this.platform.neakasaApi.setDeviceProperties(this.iotId, { bIntrptRangeDet: newValue ? 1 : 0 });
            this.platform.log.info(`Set Unstoppable Cycle to ${newValue}`);
        }
        catch (error) {
            this.platform.log.error(`Failed to set Unstoppable Cycle: ${error}`);
            throw new this.platform.api.hap.HapStatusError(-70402);
        }
    }
    async getUnstoppableCycle() {
        return this.deviceData?.bIntrptRangeDet || false;
    }
    async setAutoRecovery(value) {
        const newValue = value;
        try {
            await this.platform.neakasaApi.setDeviceProperties(this.iotId, { autoForceInit: newValue ? 1 : 0 });
            this.platform.log.info(`Set Auto Recovery to ${newValue}`);
        }
        catch (error) {
            this.platform.log.error(`Failed to set Auto Recovery: ${error}`);
            throw new this.platform.api.hap.HapStatusError(-70402);
        }
    }
    async getAutoRecovery() {
        return this.deviceData?.autoForceInit || false;
    }
    async setYoungCatMode(value) {
        const newValue = value;
        try {
            await this.platform.neakasaApi.setDeviceProperties(this.iotId, { youngCatMode: newValue ? 1 : 0 });
            this.platform.log.info(`Set Young Cat Mode to ${newValue}`);
        }
        catch (error) {
            this.platform.log.error(`Failed to set Young Cat Mode: ${error}`);
            throw new this.platform.api.hap.HapStatusError(-70402);
        }
    }
    async getYoungCatMode() {
        return this.deviceData?.youngCatMode || false;
    }
    async cleanNow(value) {
        if (value) {
            try {
                await this.platform.neakasaApi.cleanNow(this.iotId);
                this.platform.log.info(`Triggered clean for ${this.deviceName}`);
                setTimeout(() => {
                    this.services.get('clean').updateCharacteristic(this.platform.Characteristic.On, false);
                }, 1000);
            }
            catch (error) {
                this.platform.log.error(`Failed to trigger clean: ${error}`);
                throw new this.platform.api.hap.HapStatusError(-70402);
            }
        }
    }
    async levelNow(value) {
        if (value) {
            try {
                await this.platform.neakasaApi.sandLeveling(this.iotId);
                this.platform.log.info(`Triggered leveling for ${this.deviceName}`);
                setTimeout(() => {
                    this.services.get('level').updateCharacteristic(this.platform.Characteristic.On, false);
                }, 1000);
            }
            catch (error) {
                this.platform.log.error(`Failed to trigger leveling: ${error}`);
                throw new this.platform.api.hap.HapStatusError(-70402);
            }
        }
    }
}
exports.NeakasaAccessory = NeakasaAccessory;
//# sourceMappingURL=accessory.js.map