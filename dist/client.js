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
exports.IoTClient = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto = __importStar(require("crypto"));
class IoTClient {
    constructor(config) {
        this.appKey = config.appKey;
        this.appSecret = config.appSecret;
        this.domain = config.domain;
        this.axiosInstance = axios_1.default.create({
            timeout: 30000,
        });
    }
    getNonce() {
        return crypto.randomBytes(16).toString('hex');
    }
    getDateUTCString() {
        return new Date().toUTCString();
    }
    getContentMD5(content) {
        return crypto.createHash('md5').update(content).digest('base64');
    }
    getSignature(method, accept, contentMD5, contentType, date, headers, pathname) {
        const excludeHeaders = new Set([
            'x-ca-signature', 'x-ca-signature-headers', 'accept', 'content-md5',
            'content-type', 'date', 'host', 'user-agent', 'token',
        ]);
        const headerKeys = Object.keys(headers).filter(k => !excludeHeaders.has(k)).sort();
        const headerString = headerKeys.map(k => `${k}:${headers[k]}`).join('\n');
        headers['x-ca-signature-headers'] = headerKeys.join(',');
        const stringToSign = [
            method,
            accept,
            contentMD5,
            contentType,
            date,
            headerString,
            pathname,
        ].join('\n');
        return crypto.createHmac('sha256', this.appSecret).update(stringToSign).digest('base64');
    }
    async doRequest(pathname, body) {
        const nonce = body.id || this.getNonce();
        body.id = nonce;
        const bodyString = JSON.stringify(body);
        const contentMD5 = this.getContentMD5(bodyString);
        const date = this.getDateUTCString();
        const headers = {
            'host': this.domain,
            'date': date,
            'x-ca-nonce': nonce,
            'x-ca-key': this.appKey,
            'x-ca-signaturemethod': 'HmacSHA256',
            'accept': 'application/json',
            'content-type': 'application/octet-stream',
            'content-md5': contentMD5,
        };
        const signature = this.getSignature('POST', headers['accept'], contentMD5, headers['content-type'], date, headers, pathname);
        headers['x-ca-signature'] = signature;
        try {
            const response = await this.axiosInstance.post(`https://${this.domain}${pathname}`, bodyString, { headers });
            return response.data;
        }
        catch (error) {
            throw new Error(`API request failed: ${error.message}`);
        }
    }
    async doRequestRaw(pathname, body) {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = this.getNonce();
        const date = this.getDateUTCString();
        const headers = {
            'host': this.domain,
            'date': date,
            'x-ca-nonce': nonce,
            'x-ca-key': this.appKey,
            'x-ca-signature-method': 'HmacSHA256',
            'x-ca-signature-Headers': 'x-ca-nonce,x-ca-timestamp,x-ca-key,x-ca-signature-method',
            'x-ca-timestamp': timestamp,
            'accept': 'application/json',
            'content-type': 'application/x-www-form-urlencoded',
        };
        const bodyItems = [];
        const bodyItemsForSignature = [];
        for (const key of Object.keys(body)) {
            bodyItems.push(`${key}=${encodeURIComponent(JSON.stringify(body[key]))}`);
            bodyItemsForSignature.push(`${key}=${JSON.stringify(body[key])}`);
        }
        const bodyString = bodyItems.join('&');
        const bodyForSignature = bodyItemsForSignature.join('&');
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
        }
        catch (error) {
            throw new Error(`API request failed: ${error.message}`);
        }
    }
}
exports.IoTClient = IoTClient;
//# sourceMappingURL=client.js.map