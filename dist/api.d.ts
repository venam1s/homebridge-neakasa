import { NeakasaDevice, DeviceProperties, RecordsResponse } from './types';
import { Logger } from 'homebridge';
export declare class NeakasaAPIError extends Error {
    constructor(message: string);
}
export declare class NeakasaAuthError extends Error {
    constructor(message: string);
}
export declare class NeakasaAPI {
    private readonly appKey;
    private readonly appSecret;
    private readonly language;
    private axiosInstance;
    private encryption;
    private log;
    connected: boolean;
    private baseUrl?;
    private aliAuthToken?;
    private iotToken?;
    private sid?;
    private oaApiGatewayEndpoint?;
    private apiGatewayEndpoint?;
    constructor(log: Logger);
    private md5Hash;
    private hmacSha256;
    private getSignature;
    connect(username: string, password: string, firstRun?: boolean): Promise<void>;
    private loadBaseUrlByAccount;
    private loadAuthTokens;
    private loadRegionData;
    private getVid;
    private getSidByVid;
    private getIotTokenBySid;
    getDevices(): Promise<NeakasaDevice[]>;
    getDeviceProperties(iotId: string): Promise<DeviceProperties>;
    setDeviceProperties(iotId: string, items: Record<string, any>): Promise<void>;
    private invokeService;
    cleanNow(iotId: string): Promise<void>;
    sandLeveling(iotId: string): Promise<void>;
    emptyBin(iotId: string): Promise<void>;
    getRecords(deviceName: string): Promise<RecordsResponse>;
}
//# sourceMappingURL=api.d.ts.map