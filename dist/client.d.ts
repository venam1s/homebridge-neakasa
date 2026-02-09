export interface ClientConfig {
    appKey: string;
    appSecret: string;
    domain: string;
}
export interface IoTApiRequest {
    id?: string;
    version: string;
    params: Record<string, any>;
    request: {
        apiVer: string;
        language: string;
        iotToken?: string;
    };
}
export declare class IoTClient {
    private appKey;
    private appSecret;
    private domain;
    private axiosInstance;
    constructor(config: ClientConfig);
    private getNonce;
    private getDateUTCString;
    private getContentMD5;
    private getSignature;
    doRequest(pathname: string, body: IoTApiRequest): Promise<any>;
    doRequestRaw(pathname: string, body: Record<string, any>, extraHeaders?: Record<string, string>): Promise<any>;
}
//# sourceMappingURL=client.d.ts.map