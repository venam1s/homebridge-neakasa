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
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIEncryption = void 0;
const crypto = __importStar(require("crypto"));
const AES_KEY_DEFAULT = Buffer.from('3J74PRUE5TKPJP32', 'utf-8');
const AES_IV_DEFAULT = Buffer.from('QB8GC2X6WK39FF93', 'utf-8');
class APIEncryption {
    constructor() {
        this.aesKey = AES_KEY_DEFAULT;
        this.aesIv = AES_IV_DEFAULT;
        this.token = '';
        this.resetEncryption();
    }
    resetEncryption() {
        this.aesKey = AES_KEY_DEFAULT;
        this.aesIv = AES_IV_DEFAULT;
        this.token = '';
    }
    pad(data) {
        const blockSize = 16;
        const padLen = blockSize - (data.length % blockSize);
        if (padLen === 0 || padLen === blockSize) {
            return data;
        }
        return Buffer.concat([data, Buffer.alloc(padLen, 0)]);
    }
    unpad(data) {
        let i = data.length - 1;
        while (i >= 0 && data[i] === 0) {
            i--;
        }
        return data.slice(0, i + 1);
    }
    encrypt(plainText) {
        const cipher = crypto.createCipheriv('aes-128-cbc', this.aesKey, this.aesIv);
        cipher.setAutoPadding(false);
        const padded = this.pad(Buffer.from(plainText, 'utf-8'));
        const encrypted = Buffer.concat([cipher.update(padded), cipher.final()]);
        return encrypted.toString('base64');
    }
    decrypt(encryptedText) {
        const decipher = crypto.createDecipheriv('aes-128-cbc', this.aesKey, this.aesIv);
        decipher.setAutoPadding(false);
        const encrypted = Buffer.from(encryptedText.replace(/ /g, '+'), 'base64');
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        const unpadded = this.unpad(decrypted);
        return unpadded.toString('utf-8');
    }
    getTimestamp() {
        return (Date.now() / 1000).toFixed(6);
    }
    getToken() {
        return this.encrypt(`${this.token}@${this.getTimestamp()}`);
    }
    decodeLoginToken(loginToken) {
        this.resetEncryption();
        const decrypted = this.decrypt(loginToken);
        const parts = decrypted.split('@');
        if (parts.length >= 1) {
            this.token = parts[0];
        }
        if (parts.length >= 2) {
            this.userid = parts[1];
            this.uid = this.encrypt(parts[1]);
        }
        if (parts.length >= 3) {
            this.aesKey = Buffer.from(parts[2], 'utf-8');
        }
        if (parts.length >= 4) {
            this.aesIv = Buffer.from(parts[3], 'utf-8');
        }
    }
}
exports.APIEncryption = APIEncryption;
//# sourceMappingURL=encryption.js.map