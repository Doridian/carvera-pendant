const SELECTED_AXIS_NONE = 0x06;

export const enum SelectedAxis {
    X = 0x11,
    Y = 0x12,
    Z = 0x13,
    A = 0x14,
    B = 0x15,
    C = 0x16,
}

export const enum SelectedFeedRate {
    RATE_2_PERCENT = 0x0d,
    RATE_0_001 = 0x0d,

    RATE_5_PERCENT = 0x0e,
    RATE_0_01 = 0x0e,

    RATE_10_PERCENT = 0x0f,
    RATE_0_1 = 0x0f,

    RATE_30_PERCENT = 0x10,
    RATE_1_0 = 0x10,

    RATE_60_PERCENT = 0x1a,

    RATE_100_PERCENT = 0x1b,

    RATE_LEAD = 0x1c,
}

export class DeviceReport {
    public buttons: Set<number>;
    public feedRate: SelectedFeedRate;
    public axis?: SelectedAxis;
    public jog: number;

    public constructor(report: Buffer) {
        // [0] = random, ignore this
        // [1] = button1
        // [2] = button2
        // [3] = speed dial
        // [4] = axis dial
        // [5] = jog delta, signed int8
        // [6] = weird checksum, ignore this

        this.buttons = new Set();
        if (report[1]) {
            this.buttons.add(report[1]);
        }
        if (report[2]) {
            this.buttons.add(report[2]);
        }
        this.feedRate = report[3];
        if (report[4] === SELECTED_AXIS_NONE) {
            this.axis = undefined;
        } else {
            this.axis = report[4];
        }
        this.jog = new Int8Array(report)[5];
    }
}
