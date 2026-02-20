"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NeakasaAccessory = void 0;
const types_1 = require("./types");
const FAULT_STATUSES = new Set([6, 7]);
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
    setServiceName(service, name) {
        service.setCharacteristic(this.platform.Characteristic.Name, name);
        service.setCharacteristic(this.platform.Characteristic.ConfiguredName, name);
    }
    updateIfChanged(service, characteristic, newValue) {
        const current = service.getCharacteristic(characteristic).value;
        if (current !== newValue) {
            service.updateCharacteristic(characteristic, newValue);
        }
    }
    setupServices() {
        const binSensor = this.accessory.getService('bin-full') ||
            this.accessory.addService(this.platform.Service.OccupancySensor, 'Waste Bin Full', 'bin-full');
        this.setServiceName(binSensor, 'Waste Bin Full');
        this.services.set('binFull', binSensor);
        this.addSwitch('autoClean', 'Auto Clean', 'auto-clean', this.setAutoClean, this.getAutoClean);
        const cleanSwitch = this.accessory.getService('clean-now') ||
            this.accessory.addService(this.platform.Service.Switch, 'Clean Now', 'clean-now');
        this.setServiceName(cleanSwitch, 'Clean Now');
        cleanSwitch.getCharacteristic(this.platform.Characteristic.On)
            .onSet(this.cleanNow.bind(this))
            .onGet(() => false);
        this.services.set('clean', cleanSwitch);
        const levelSwitch = this.accessory.getService('level-now') ||
            this.accessory.addService(this.platform.Service.Switch, 'Level Now', 'level-now');
        this.setServiceName(levelSwitch, 'Level Now');
        levelSwitch.getCharacteristic(this.platform.Characteristic.On)
            .onSet(this.levelNow.bind(this))
            .onGet(() => false);
        this.services.set('level', levelSwitch);
        const statusSensor = this.accessory.getService('device-status') ||
            this.accessory.addService(this.platform.Service.ContactSensor, 'Status', 'device-status');
        this.setServiceName(statusSensor, 'Status');
        this.services.set('status', statusSensor);
        const catPresentSensor = this.accessory.getService('cat-present') ||
            this.accessory.addService(this.platform.Service.OccupancySensor, 'Cat Present', 'cat-present');
        this.setServiceName(catPresentSensor, 'Cat Present');
        this.services.set('catPresent', catPresentSensor);
        const filterService = this.accessory.getService(this.platform.Service.FilterMaintenance) ||
            this.accessory.addService(this.platform.Service.FilterMaintenance, 'Litter Level', 'sand-level');
        this.setServiceName(filterService, 'Litter Level');
        this.services.set('filter', filterService);
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
        }
        else {
            this.removeServiceIfExists('child-lock');
        }
        this.addOptionalSwitch('autoBury', 'Auto Bury', 'auto-bury', this.config.showAutoBury, this.setAutoBury, this.getAutoBury);
        this.addOptionalSwitch('autoLevel', 'Auto Level', 'auto-level', this.config.showAutoLevel, this.setAutoLevel, this.getAutoLevel);
        this.addOptionalSwitch('silentMode', 'Silent Mode', 'silent-mode', this.config.showSilentMode, this.setSilentMode, this.getSilentMode);
        this.addOptionalSwitch('unstoppable', 'Unstoppable Cycle', 'unstoppable-cycle', this.config.showUnstoppableCycle, this.setUnstoppableCycle, this.getUnstoppableCycle);
        this.addOptionalSwitch('autoRecovery', 'Auto Recovery', 'auto-recovery', this.config.showAutoRecovery, this.setAutoRecovery, this.getAutoRecovery);
        this.addOptionalSwitch('youngCatMode', 'Young Cat Mode', 'young-cat-mode', this.config.showYoungCatMode, this.setYoungCatMode, this.getYoungCatMode);
        if (this.config.showBinStateSensor === true) {
            const binStateSensor = this.accessory.getService('bin-state') ||
                this.accessory.addService(this.platform.Service.LeakSensor, 'Bin State', 'bin-state');
            this.setServiceName(binStateSensor, 'Bin State');
            this.services.set('binState', binStateSensor);
        }
        else {
            this.removeServiceIfExists('bin-state');
        }
        if (this.config.showWifiSensor === true) {
            const wifiSensor = this.accessory.getService('wifi-signal') ||
                this.accessory.addService(this.platform.Service.HumiditySensor, 'WiFi Signal', 'wifi-signal');
            this.setServiceName(wifiSensor, 'WiFi Signal');
            this.services.set('wifi', wifiSensor);
        }
        else {
            this.removeServiceIfExists('wifi-signal');
        }
        if (this.config.showSandLevelSensor === true) {
            const sandSensor = this.accessory.getService('sand-level-state') ||
                this.accessory.addService(this.platform.Service.ContactSensor, 'Sand Level State', 'sand-level-state');
            this.setServiceName(sandSensor, 'Sand Level State');
            this.services.set('sandLevelState', sandSensor);
        }
        else {
            this.removeServiceIfExists('sand-level-state');
        }
        if (this.config.showFaultSensor === true) {
            const faultSensor = this.accessory.getService('fault-alert') ||
                this.accessory.addService(this.platform.Service.MotionSensor, 'Fault Alert', 'fault-alert');
            this.setServiceName(faultSensor, 'Fault Alert');
            this.services.set('faultAlert', faultSensor);
        }
        else {
            this.removeServiceIfExists('fault-alert');
        }
    }
    addSwitch(key, name, subType, setter, getter) {
        const service = this.accessory.getService(subType) ||
            this.accessory.addService(this.platform.Service.Switch, name, subType);
        this.setServiceName(service, name);
        service.getCharacteristic(this.platform.Characteristic.On)
            .onSet(setter.bind(this))
            .onGet(getter.bind(this));
        this.services.set(key, service);
    }
    addOptionalSwitch(key, name, subType, enabled, setter, getter) {
        if (enabled === true) {
            this.addSwitch(key, name, subType, setter, getter);
        }
        else {
            this.removeServiceIfExists(subType);
        }
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
        this.updateIfChanged(filterService, this.platform.Characteristic.FilterChangeIndication, changeIndication);
        this.updateIfChanged(filterService, this.platform.Characteristic.FilterLifeLevel, data.sandLevelPercent);
        const binSensor = this.services.get('binFull');
        this.updateIfChanged(binSensor, this.platform.Characteristic.OccupancyDetected, data.binFullWaitReset ?
            this.platform.Characteristic.OccupancyDetected.OCCUPANCY_DETECTED :
            this.platform.Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED);
        this.updateIfChanged(this.services.get('autoClean'), this.platform.Characteristic.On, data.cleanCfg?.active === 1);
        const statusSensor = this.services.get('status');
        const isActive = data.bucketStatus !== 0;
        this.updateIfChanged(statusSensor, this.platform.Characteristic.ContactSensorState, isActive ?
            this.platform.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED :
            this.platform.Characteristic.ContactSensorState.CONTACT_DETECTED);
        const statusName = types_1.BucketStatus[data.bucketStatus] || `Unknown (${data.bucketStatus})`;
        this.updateIfChanged(statusSensor, this.platform.Characteristic.Name, statusName);
        const catPresentSensor = this.services.get('catPresent');
        this.updateIfChanged(catPresentSensor, this.platform.Characteristic.OccupancyDetected, data.bucketStatus === 4 ?
            this.platform.Characteristic.OccupancyDetected.OCCUPANCY_DETECTED :
            this.platform.Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED);
        const childLockService = this.services.get('childLock');
        if (childLockService) {
            const lockState = data.childLockOnOff ?
                this.platform.Characteristic.LockCurrentState.SECURED :
                this.platform.Characteristic.LockCurrentState.UNSECURED;
            this.updateIfChanged(childLockService, this.platform.Characteristic.LockCurrentState, lockState);
            this.updateIfChanged(childLockService, this.platform.Characteristic.LockTargetState, lockState);
        }
        const autoBury = this.services.get('autoBury');
        if (autoBury) {
            this.updateIfChanged(autoBury, this.platform.Characteristic.On, data.autoBury);
        }
        const autoLevel = this.services.get('autoLevel');
        if (autoLevel) {
            this.updateIfChanged(autoLevel, this.platform.Characteristic.On, data.autoLevel);
        }
        const silentMode = this.services.get('silentMode');
        if (silentMode) {
            this.updateIfChanged(silentMode, this.platform.Characteristic.On, data.silentMode);
        }
        const unstoppable = this.services.get('unstoppable');
        if (unstoppable) {
            this.updateIfChanged(unstoppable, this.platform.Characteristic.On, data.bIntrptRangeDet);
        }
        const autoRecovery = this.services.get('autoRecovery');
        if (autoRecovery) {
            this.updateIfChanged(autoRecovery, this.platform.Characteristic.On, data.autoForceInit);
        }
        const youngCatMode = this.services.get('youngCatMode');
        if (youngCatMode) {
            this.updateIfChanged(youngCatMode, this.platform.Characteristic.On, data.youngCatMode);
        }
        const binStateSensor = this.services.get('binState');
        if (binStateSensor) {
            const leakDetected = data.room_of_bin !== 0;
            this.updateIfChanged(binStateSensor, this.platform.Characteristic.LeakDetected, leakDetected ?
                this.platform.Characteristic.LeakDetected.LEAK_DETECTED :
                this.platform.Characteristic.LeakDetected.LEAK_NOT_DETECTED);
            const binStateName = types_1.BinState[data.room_of_bin] || `Unknown (${data.room_of_bin})`;
            this.updateIfChanged(binStateSensor, this.platform.Characteristic.Name, binStateName);
        }
        const wifiSensor = this.services.get('wifi');
        if (wifiSensor) {
            this.updateIfChanged(wifiSensor, this.platform.Characteristic.CurrentRelativeHumidity, this.rssiToPercent(data.wifiRssi));
        }
        const sandSensor = this.services.get('sandLevelState');
        if (sandSensor) {
            const isInsufficient = data.sandLevelState === types_1.SandLevel.INSUFFICIENT;
            this.updateIfChanged(sandSensor, this.platform.Characteristic.ContactSensorState, isInsufficient ?
                this.platform.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED :
                this.platform.Characteristic.ContactSensorState.CONTACT_DETECTED);
            const sandStateName = types_1.SandLevelName[data.sandLevelState] || `Unknown (${data.sandLevelState})`;
            this.updateIfChanged(sandSensor, this.platform.Characteristic.Name, sandStateName);
        }
        const faultSensor = this.services.get('faultAlert');
        if (faultSensor) {
            const isFaulted = FAULT_STATUSES.has(data.bucketStatus);
            this.updateIfChanged(faultSensor, this.platform.Characteristic.MotionDetected, isFaulted);
            if (isFaulted) {
                this.platform.log.warn(`${this.deviceName} fault: ${types_1.BucketStatus[data.bucketStatus]}`);
            }
        }
        if (this.config.showCatSensors === true && data.cat_list && data.cat_list.length > 0) {
            this.updateCatSensors(data);
        }
        this.previousData = data;
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
                this.setServiceName(catSensor, cat.name);
                this.services.set(subType, catSensor);
            }
            const catRecords = data.record_list
                .filter(r => r.cat_id === cat.id)
                .sort((a, b) => b.end_time - a.end_time);
            if (catRecords.length > 0) {
                const latestRecord = catRecords[0];
                let weight = latestRecord.weight;
                if (this.config.useImperialUnits === true) {
                    weight = weight * 2.20462;
                }
                const displayWeight = Math.min(100, Math.max(0, Math.round(weight)));
                catSensor.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, displayWeight);
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
        const locked = value === this.platform.Characteristic.LockTargetState.SECURED;
        try {
            await this.platform.neakasaApi.setDeviceProperties(this.iotId, { childLockOnOff: locked ? 1 : 0 });
            this.platform.log.info(`Set Child Lock to ${locked ? 'Locked' : 'Unlocked'}`);
            this.services.get('childLock')?.updateCharacteristic(this.platform.Characteristic.LockCurrentState, locked ?
                this.platform.Characteristic.LockCurrentState.SECURED :
                this.platform.Characteristic.LockCurrentState.UNSECURED);
        }
        catch (error) {
            this.platform.log.error(`Failed to set Child Lock: ${error}`);
            throw new this.platform.api.hap.HapStatusError(-70402);
        }
    }
    async getChildLockState() {
        return this.deviceData?.childLockOnOff ?
            this.platform.Characteristic.LockCurrentState.SECURED :
            this.platform.Characteristic.LockCurrentState.UNSECURED;
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