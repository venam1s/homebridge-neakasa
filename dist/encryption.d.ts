export declare class APIEncryption {
    private aesKey;
    private aesIv;
    private token;
    userid?: string;
    uid?: string;
    constructor();
    resetEncryption(): void;
    private pad;
    private unpad;
    encrypt(plainText: string): string;
    decrypt(encryptedText: string): string;
    private getTimestamp;
    getToken(): string;
    decodeLoginToken(loginToken: string): void;
}
//# sourceMappingURL=encryption.d.ts.map