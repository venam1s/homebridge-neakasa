import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { APIEncryption } from './encryption';
import { IoTClient } from './client';
import { NeakasaDevice, DeviceProperties, RecordsResponse } from './types';
import { Logger } from 'homebridge';

export class NeakasaAPIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NeakasaAPIError';
  }
}

export class NeakasaAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NeakasaAuthError';
  }
}

export class NeakasaAPI {
  private readonly appKey: string = '32715650';
  private readonly appSecret: string = '698ee0ef531c3df2ddded87563643860';
  private readonly language: string = 'en-US';
  private axiosInstance: AxiosInstance;
  private encryption: APIEncryption;
  private log: Logger;

  public connected: boolean = false;
  private baseUrl?: string;
  private aliAuthToken?: string;
  private iotToken?: string;
  private sid?: string;
  private oaApiGatewayEndpoint?: string;
  private apiGatewayEndpoint?: string;

  constructor(log: Logger) {
    this.log = log;
    this.axiosInstance = axios.create({ timeout: 30000 });
    this.encryption = new APIEncryption();
  }

  private md5Hash(input: string): string {
    return crypto.createHash('md5').update(input).digest('hex');
  }

  private hmacSha256(secret: string, message: string): string {
    return crypto.createHmac('sha256', secret).update(message).digest('base64');
  }

  private getSignature(timestamp: string): string {
    return this.hmacSha256(this.appSecret, this.appKey + timestamp);
  }

  async connect(username: string, password: string, firstRun: boolean = true): Promise<void> {
    if (!this.connected) {
      await this.loadBaseUrlByAccount(username);
      await this.loadAuthTokens(username, password);
      await this.loadRegionData();
      const vid = await this.getVid();
      this.sid = await this.getSidByVid(vid);
    }
    
    try {
      this.iotToken = await this.getIotTokenBySid(this.sid!);
      this.connected = true;
      this.log.debug('Successfully connected to Neakasa API');
    } catch (error) {
      if (firstRun) {
        this.log.warn('First connection attempt failed, retrying...');
        await this.connect(username, password, false);
      } else {
        throw error;
      }
    }
  }

  private async loadBaseUrlByAccount(username: string): Promise<void> {
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
    } catch (error: any) {
      throw new NeakasaAPIError(`Failed to load base URL: ${error.message}`);
    }
  }

  private async loadAuthTokens(username: string, password: string): Promise<void> {
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
    } catch (error: any) {
      if (error instanceof NeakasaAuthError) {
        throw error;
      }
      throw new NeakasaAPIError(`Failed to load auth tokens: ${error.message}`);
    }
  }

  private async loadRegionData(): Promise<void> {
    const client = new IoTClient({
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
    } catch (error: any) {
      throw new NeakasaAPIError(`Failed to load region data: ${error.message}`);
    }
  }

  private async getVid(): Promise<string> {
    const client = new IoTClient({
      appKey: this.appKey,
      appSecret: this.appSecret,
      domain: this.oaApiGatewayEndpoint!,
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
    } catch (error: any) {
      throw new NeakasaAPIError(`Failed to get VID: ${error.message}`);
    }
  }

  private async getSidByVid(vid: string): Promise<string> {
    const client = new IoTClient({
      appKey: this.appKey,
      appSecret: this.appSecret,
      domain: this.oaApiGatewayEndpoint!,
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
      const response = await this.axiosInstance.post(
        `https://${this.oaApiGatewayEndpoint}/api/prd/loginbyoauth.json`,
        new URLSearchParams({
          loginByOauthRequest: JSON.stringify(body.loginByOauthRequest),
        }).toString(),
        {
          headers: {
            'Vid': vid,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      if (response.data.success !== 'true' || response.data.data.successful !== 'true') {
        throw new NeakasaAuthError('Failed to get SID');
      }

      return response.data.data.sid;
    } catch (error: any) {
      throw new NeakasaAPIError(`Failed to get SID: ${error.message}`);
    }
  }

  private async getIotTokenBySid(sid: string): Promise<string> {
    const client = new IoTClient({
      appKey: this.appKey,
      appSecret: this.appSecret,
      domain: this.oaApiGatewayEndpoint!,
    });

    const body = {
      sid: sid,
    };

    try {
      const response = await client.doRequestRaw('/api/prd/account/getiottoken.json', body);
      
      if (response.success !== 'true' || response.data.successful !== 'true') {
        throw new NeakasaAuthError('Failed to get IoT token');
      }

      return response.data.data.iotToken;
    } catch (error: any) {
      throw new NeakasaAPIError(`Failed to get IoT token: ${error.message}`);
    }
  }

  async getDevices(): Promise<NeakasaDevice[]> {
    if (!this.connected) {
      throw new NeakasaAPIError('API not connected');
    }

    const client = new IoTClient({
      appKey: this.appKey,
      appSecret: this.appSecret,
      domain: this.apiGatewayEndpoint!,
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
    } catch (error: any) {
      throw new NeakasaAPIError(`Failed to get devices: ${error.message}`);
    }
  }

  async getDeviceProperties(iotId: string): Promise<DeviceProperties> {
    if (!this.connected) {
      throw new NeakasaAPIError('API not connected');
    }

    const client = new IoTClient({
      appKey: this.appKey,
      appSecret: this.appSecret,
      domain: this.apiGatewayEndpoint!,
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
    } catch (error: any) {
      throw new NeakasaAPIError(`Failed to get device properties: ${error.message}`);
    }
  }

  async setDeviceProperties(iotId: string, items: Record<string, any>): Promise<void> {
    if (!this.connected) {
      throw new NeakasaAPIError('API not connected');
    }

    const client = new IoTClient({
      appKey: this.appKey,
      appSecret: this.appSecret,
      domain: this.apiGatewayEndpoint!,
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
    } catch (error: any) {
      throw new NeakasaAPIError(`Failed to set device properties: ${error.message}`);
    }
  }

  private async invokeService(iotId: string, identifier: string, args: Record<string, any>): Promise<void> {
    if (!this.connected) {
      throw new NeakasaAPIError('API not connected');
    }

    const client = new IoTClient({
      appKey: this.appKey,
      appSecret: this.appSecret,
      domain: this.apiGatewayEndpoint!,
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
    } catch (error: any) {
      throw new NeakasaAPIError(`Failed to invoke service: ${error.message}`);
    }
  }

  async cleanNow(iotId: string): Promise<void> {
    await this.invokeService(iotId, 'cleanNow', { bStartClean: 1 });
  }

  async sandLeveling(iotId: string): Promise<void> {
    await this.invokeService(iotId, 'sandLeveling', { bStartLeveling: 1 });
  }

  async getRecords(deviceName: string): Promise<RecordsResponse> {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.getSignature(timestamp.toString());
    const startTime = timestamp - (7 * 24 * 60 * 60); // 7 days ago

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
    } catch (error: any) {
      throw new NeakasaAPIError(`Failed to get records: ${error.message}`);
    }
  }
}
