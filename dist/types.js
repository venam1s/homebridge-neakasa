"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BinState = exports.BucketStatus = exports.SandLevel = void 0;
exports.SandLevel = {
    INSUFFICIENT: 0,
    MODERATE: 1,
    SUFFICIENT: 2,
    OVERFILLED: 3,
};
exports.BucketStatus = {
    0: 'Idle',
    1: 'Cleaning',
    2: 'Leveling',
    3: 'Flipover',
    4: 'Cat Present',
    5: 'Paused',
    6: 'Panels Missing',
    7: 'Interrupted',
};
exports.BinState = {
    0: 'Normal',
    1: 'Full',
    2: 'Missing',
};
//# sourceMappingURL=types.js.map