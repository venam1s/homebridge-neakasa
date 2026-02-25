"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NeakasaAPI = exports.NeakasaAuthError = exports.NeakasaAPIError = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto = __importStar(require("crypto"));
const encryption_1 = require("./encryption");
const client_1 = require("./client");
class NeakasaAPIError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NeakasaAPIError';
    }
}
exports.NeakasaAPIError = NeakasaAPIError;
class NeakasaAuthError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NeakasaAuthError';
    }
}
exports.NeakasaAuthError = NeakasaAuthError;
class NeakasaAPI {
    constructor(log) {
        this.appKey = '32715650';
        this.appSecret = '698ee0ef531c3df2ddded87563643860';
        this.language = 'en-US';
        this.connected = false;
        this.log = log;
        this.axiosInstance = axios_1.default.create({ timeout: 30000 });
        this.encryption = new encryption_1.APIEncryption();
    }
    md5Hash(input) {
        return crypto.createHash('md5').update(input).digest('hex');
    }
    hmacSha256(secret, message) {
        return crypto.createHmac('sha256', secret).update(message).digest('base64');
    }
    getSignature(timestamp) {
        return this.hmacSha256(this.appSecret, this.appKey + timestamp);
    }
    async connect(username, password, firstRun = true) {
        if (!this.connected) {
            await this.loadBaseUrlByAccount(username);
            await this.loadAuthTokens(username, password);
            await this.loadRegionData();
            const vid = await this.getVid();
            this.sid = await this.getSidByVid(vid);
        }
        try {
            this.iotToken = await this.getIotTokenBySid(this.sid);
            this.connected = true;
            this.log.debug('Successfully connected to Neakasa API');
        }
        catch (error) {
            if (firstRun) {
                this.log.warn('First connection attempt failed, retrying...');
                await this.connect(username, password, false);
            }
            else {
                throw error;
            }
        }
    }
    async loadBaseUrlByAccount(username) {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const signature = this.getSignature(timestamp);
        const accountHash = this.md5Hash(username);
        try {
            const response = await this.axiosInstance.get('https://global.genhigh.com/global/baseurl/account', {
                params: { account: accountHash },
                headers: {
                    'Request-Id': signature,
                    'Appid': this.appKey,
                    'Timestamp': timestamp,
                    'Sign': signature,
                },
            });
            if (response.data.code !== 0) {
                throw new NeakasaAuthError('Invalid username');
            }
            this.baseUrl = response.data.data.web;
            this.log.debug(`Base URL loaded: ${this.baseUrl}`);
        }
        catch (error) {
            throw new NeakasaAPIError(`Failed to load base URL: ${error.message}`);
        }
    }
    async loadAuthTokens(username, password) {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const signature = this.getSignature(timestamp);
        const passwordHash = this.md5Hash(this.md5Hash(password));
        try {
            const response = await this.axiosInstance.post(`${this.baseUrl}/login/user`, {
                product_id: 'a123nCqsrQm3vEbt',
                system: 2,
                system_version: 'Android14,SDK:34',
                system_number: 'GOOGLE_sdk_gphone64_x86_64-userdebug 14 UE1A.230829.050 12077443 dev-keys_sdk_gphone64_x86_64',
                app_version: '2.0.9',
                account: username,
                type: 3,
                password: passwordHash,
            }, {
                headers: {
                    'Request-Id': signature,
                    'Appid': this.appKey,
                    'Timestamp': timestamp,
                    'Sign': signature,
                },
            });
            if (response.data.code !== 0) {
                throw new NeakasaAuthError('Invalid username or password');
            }
            this.aliAuthToken = response.data.data.user_info.ali_authentication_token;
            this.encryption.decodeLoginToken(response.data.data.login_token);
            this.log.debug('Auth tokens loaded successfully');
        }
        catch (error) {
            if (error instanceof NeakasaAuthError) {
                throw error;
            }
            throw new NeakasaAPIError(`Failed to load auth tokens: ${error.message}`);
        }
    }
    async loadRegionData() {
        const client = new client_1.IoTClient({
            appKey: this.appKey,
            appSecret: this.appSecret,
            domain: 'cn-shanghai.api-iot.aliyuncs.com',
        });
        const body = {
            version: '1.0',
            params: {
                authCode: this.aliAuthToken,
                type: 'THIRD_AUTHCODE',
            },
            request: {
                apiVer: '1.0.2',
                language: this.language,
            },
        };
        try {
            const response = await client.doRequest('/living/account/region/get', body);
            if (response.code !== 200) {
                throw new NeakasaAPIError(`Failed to load region data: ${response.message}`);
            }
            this.oaApiGatewayEndpoint = response.data.oaApiGatewayEndpoint;
            this.apiGatewayEndpoint = response.data.apiGatewayEndpoint;
            this.log.debug('Region data loaded successfully');
        }
        catch (error) {
            throw new NeakasaAPIError(`Failed to load region data: ${error.message}`);
        }
    }
    async getVid() {
        const client = new client_1.IoTClient({
            appKey: this.appKey,
            appSecret: this.appSecret,
            domain: this.oaApiGatewayEndpoint,
        });
        const body = {
            request: {
                context: { appKey: this.appKey },
                config: { version: 0, lastModify: 0 },
                device: {},
            },
        };
        try {
            const response = await client.doRequestRaw('/api/prd/connect.json', body);
            if (response.success !== 'true' || response.data.successful !== 'true') {
                throw new NeakasaAPIError('Failed to get VID');
            }
            return response.data.vid;
        }
        catch (error) {
            throw new NeakasaAPIError(`Failed to get VID: ${error.message}`);
        }
    }
    async getSidByVid(vid) {
        const client = new client_1.IoTClient({
            appKey: this.appKey,
            appSecret: this.appSecret,
            domain: this.oaApiGatewayEndpoint,
        });
        const body = {
            loginByOauthRequest: {
                authCode: this.aliAuthToken,
                oauthPlateform: 23,
                oauthAppKey: this.appKey,
                riskControlInfo: {},
            },
        };
        try {
            const response = await client.doRequestRaw('/api/prd/loginbyoauth.json', body, { 'Vid': vid });
            if (response.success !== 'true') {
                throw new NeakasaAuthError(`Failed to get SID: ${response.errorMsg}`);
            }
            if (response.data.successful !== 'true') {
                throw new NeakasaAuthError(`Failed to get SID: ${response.data.message}`);
            }
            return response.data.data.loginSuccessResult.sid;
        }
        catch (error) {
            if (error instanceof NeakasaAuthError) {
                throw error;
            }
            throw new NeakasaAPIError(`Failed to get SID: ${error.message}`);
        }
    }
    async getIotTokenBySid(sid) {
        const client = new client_1.IoTClient({
            appKey: this.appKey,
            appSecret: this.appSecret,
            domain: this.apiGatewayEndpoint,
        });
        const body = {
            version: '1.0',
            params: {
                request: {
                    authCode: sid,
                    accountType: 'OA_SESSION',
                    appKey: this.appKey,
                },
            },
            request: {
                apiVer: '1.0.4',
                language: this.language,
            },
        };
        try {
            const response = await client.doRequest('/account/createSessionByAuthCode', body);
            if (response.code !== 200) {
                this.connected = false;
                throw new NeakasaAuthError(`Failed to get IoT token: ${response.message}`);
            }
            return response.data.iotToken;
        }
        catch (error) {
            if (error instanceof NeakasaAuthError) {
                throw error;
            }
            throw new NeakasaAPIError(`Failed to get IoT token: ${error.message}`);
        }
    }
    async getDevices() {
        if (!this.connected) {
            throw new NeakasaAPIError('API not connected');
        }
        const client = new client_1.IoTClient({
            appKey: this.appKey,
            appSecret: this.appSecret,
            domain: this.apiGatewayEndpoint,
        });
        const body = {
            version: '1.0',
            params: {
                pageSize: 100,
                thingType: 'DEVICE',
                nodeType: 'DEVICE',
                pageNo: 1,
            },
            request: {
                apiVer: '1.0.8',
                language: this.language,
                iotToken: this.iotToken,
            },
        };
        try {
            const response = await client.doRequest('/uc/listBindingByAccount', body);
            if (response.code !== 200) {
                throw new NeakasaAPIError(`Failed to get devices: ${response.message}`);
            }
            return response.data.data;
        }
        catch (error) {
            throw new NeakasaAPIError(`Failed to get devices: ${error.message}`);
        }
    }
    async getDeviceProperties(iotId) {
        if (!this.connected) {
            throw new NeakasaAPIError('API not connected');
        }
        const client = new client_1.IoTClient({
            appKey: this.appKey,
            appSecret: this.appSecret,
            domain: this.apiGatewayEndpoint,
        });
        const body = {
            version: '1.0',
            params: { iotId },
            request: {
                apiVer: '1.0.4',
                language: this.language,
                iotToken: this.iotToken,
            },
        };
        try {
            const response = await client.doRequest('/thing/properties/get', body);
            if (response.code !== 200) {
                if (response.message.includes('identityId is blank')) {
                    this.connected = false;
                }
                throw new NeakasaAPIError(`Failed to get device properties: ${response.message}`);
            }
            return response.data;
        }
        catch (error) {
            throw new NeakasaAPIError(`Failed to get device properties: ${error.message}`);
        }
    }
    async setDeviceProperties(iotId, items) {
        if (!this.connected) {
            throw new NeakasaAPIError('API not connected');
        }
        const client = new client_1.IoTClient({
            appKey: this.appKey,
            appSecret: this.appSecret,
            domain: this.apiGatewayEndpoint,
        });
        const body = {
            version: '1.0',
            params: { items, iotId },
            request: {
                apiVer: '1.0.4',
                language: this.language,
                iotToken: this.iotToken,
            },
        };
        try {
            const response = await client.doRequest('/thing/properties/set', body);
            if (response.code !== 200) {
                throw new NeakasaAPIError('Failed to set device properties');
            }
        }
        catch (error) {
            throw new NeakasaAPIError(`Failed to set device properties: ${error.message}`);
        }
    }
    async invokeService(iotId, identifier, args) {
        if (!this.connected) {
            throw new NeakasaAPIError('API not connected');
        }
        const client = new client_1.IoTClient({
            appKey: this.appKey,
            appSecret: this.appSecret,
            domain: this.apiGatewayEndpoint,
        });
        const body = {
            version: '1.0',
            params: { args, identifier, iotId },
            request: {
                apiVer: '1.0.5',
                language: this.language,
                iotToken: this.iotToken,
            },
        };
        try {
            const response = await client.doRequest('/thing/service/invoke', body);
            if (response.code !== 200) {
                throw new NeakasaAPIError('Failed to invoke service');
            }
        }
        catch (error) {
            throw new NeakasaAPIError(`Failed to invoke service: ${error.message}`);
        }
    }
    async cleanNow(iotId) {
        await this.invokeService(iotId, 'cleanNow', { bStartClean: 1 });
    }
    async sandLeveling(iotId) {
        await this.invokeService(iotId, 'sandLeveling', { bStartLeveling: 1 });
    }
    async emptyBin(iotId) {
        await this.setDeviceProperties(iotId, { binFullWaitReset: 0 });
    }
    async getRecords(deviceName) {
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = this.getSignature(timestamp.toString());
        const startTime = timestamp - (7 * 24 * 60 * 60);
        try {
            const response = await this.axiosInstance.get(`${this.baseUrl}/catbox/record`, {
                params: {
                    user_id: this.encryption.userid,
                    device_name: deviceName,
                    bind_status: 2,
                    start_time: startTime,
                    end_time: timestamp,
                },
                headers: {
                    'Request-Id': signature,
                    'Token': this.encryption.getToken(),
                    'Uid': this.encryption.uid,
                    'Accept-Language': 'en',
                },
            });
            if (response.data.code !== 0) {
                throw new NeakasaAPIError(`Failed to get records: ${response.data.message}`);
            }
            return response.data.data;
        }
        catch (error) {
            throw new NeakasaAPIError(`Failed to get records: ${error.message}`);
        }
    }
}
exports.NeakasaAPI = NeakasaAPI;
//# sourceMappingURL=api.js.map