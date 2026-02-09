"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BinState = exports.SandLevel = exports.BucketStatus = void 0;
exports.BucketStatus = {
    IDLE: 0,
    CLEANING_1: 1,
    CLEANING_2: 2,
    LEVELING: 3,
    FLIPOVER: 4,
    CAT_PRESENT: 5,
    PAUSED: 6,
    SIDE_BIN_MISSING: 7,
    UNKNOWN: 8,
    CLEANING_INTERRUPTED: 9,
};
exports.SandLevel = {
    INSUFFICIENT: 0,
    MODERATE: 1,
    SUFFICIENT: 2,
    OVERFILLED: 3,
};
exports.BinState = {
    NORMAL: 0,
    FULL: 1,
    MISSING: 2,
};
//# sourceMappingURL=types.js.map