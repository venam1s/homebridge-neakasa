import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

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

export interface IoTApiResponse {
  code: number;
  data: any;
  message?: string;
  id?: string;
}

export class IoTClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IoTClientError';
  }
}

export class IoTClient {
  private appKey: string;
  private appSecret: string;
  readonly domain: string;
  private axiosInstance: AxiosInstance;

  constructor(config: ClientConfig) {
    this.appKey = config.appKey;
    this.appSecret = config.appSecret;
    this.domain = config.domain;
    this.axiosInstance = axios.create({
      timeout: 30000,
    });
  }

  private getNonce(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private getDateUTCString(): string {
    return new Date().toUTCString();
  }

  private getContentMD5(content: string): string {
    return crypto.createHash('md5').update(content).digest('base64');
  }

  buildSignatureHeaders(
    method: string,
    headers: Record<string, string>,
    pathname: string,
  ): Record<string, string> {
    const excludeHeaders = new Set([
      'x-ca-signature', 'x-ca-signature-headers', 'accept', 'content-md5',
      'content-type', 'date', 'host', 'user-agent', 'token',
    ]);
    const headerKeys = Object.keys(headers).filter(k => !excludeHeaders.has(k)).sort();
    const headerString = headerKeys.map(k => `${k}:${headers[k]}`).join('\n');

    const stringToSign = [
      method,
      headers['accept'] || '',
      headers['content-md5'] || '',
      headers['content-type'] || '',
      headers['date'] || '',
      headerString,
      pathname,
    ].join('\n');

    const signature = crypto.createHmac('sha256', this.appSecret).update(stringToSign).digest('base64');

    return {
      'x-ca-signature-headers': headerKeys.join(','),
      'x-ca-signature': signature,
    };
  }

  async doRequest(pathname: string, body: IoTApiRequest): Promise<IoTApiResponse> {
    const nonce = body.id || this.getNonce();
    body.id = nonce;

    const bodyString = JSON.stringify(body);
    const contentMD5 = this.getContentMD5(bodyString);
    const date = this.getDateUTCString();

    const headers: Record<string, string> = {
      'host': this.domain,
      'date': date,
      'x-ca-nonce': nonce,
      'x-ca-key': this.appKey,
      'x-ca-signaturemethod': 'HmacSHA256',
      'accept': 'application/json',
      'content-type': 'application/octet-stream',
      'content-md5': contentMD5,
    };

    const signatureHeaders = this.buildSignatureHeaders('POST', headers, pathname);
    Object.assign(headers, signatureHeaders);

    try {
      const response = await this.axiosInstance.post(`https://${this.domain}${pathname}`, bodyString, { headers });
      return response.data;
    } catch (error: any) {
      throw new IoTClientError(`API request failed: ${error.message}`);
    }
  }

  async doRequestRaw(pathname: string, body: Record<string, any>, extraHeaders?: Record<string, string>): Promise<any> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = this.getNonce();
    const date = this.getDateUTCString();

    const headers: Record<string, string> = {
      'host': this.domain,
      'date': date,
      'x-ca-nonce': nonce,
      'x-ca-key': this.appKey,
      'x-ca-signature-method': 'HmacSHA256',
      'x-ca-signature-Headers': 'x-ca-nonce,x-ca-timestamp,x-ca-key,x-ca-signature-method',
      'x-ca-timestamp': timestamp,
      'accept': 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
      ...extraHeaders,
    };

    // Build form body
    const bodyItems: string[] = [];
    const bodyItemsForSignature: string[] = [];

    for (const key of Object.keys(body)) {
      bodyItems.push(`${key}=${encodeURIComponent(JSON.stringify(body[key]))}`);
      bodyItemsForSignature.push(`${key}=${JSON.stringify(body[key])}`);
    }

    const bodyString = bodyItems.join('&');
    const bodyForSignature = bodyItemsForSignature.join('&');

    // Build signature string
    const stringToSign = [
      'POST',
      headers['accept'],
      '',
      headers['content-type'],
      headers['date'],
      `x-ca-key:${headers['x-ca-key']}`,
      `x-ca-nonce:${headers['x-ca-nonce']}`,
      `x-ca-signature-method:${headers['x-ca-signature-method']}`,
      `x-ca-timestamp:${headers['x-ca-timestamp']}`,
      `${pathname}?${bodyForSignature}`,
    ].join('\n');

    headers['x-ca-signature'] = crypto.createHmac('sha256', this.appSecret).update(stringToSign).digest('base64');

    try {
      const response = await this.axiosInstance.post(`https://${this.domain}${pathname}`, bodyString, { headers });
      return response.data;
    } catch (error: any) {
      throw new IoTClientError(`API request failed: ${error.message}`);
    }
  }
}
