export enum Axis {
    X = 0x11,
    Y = 0x12,
    Z = 0x13,
    A = 0x14,
    B = 0x15,
    C = 0x16,
}

export const enum DisplayFlags {
    STEP_MODE_CONT = 0,
    STEP_MODE_STEP = 1,
    STEP_MODE_MPG = 2,
    STEP_MODE_PERCENT = 3,

    RESET = 0b0100_0000,

    MACHINE_COORDS = 0b0000_0000,
    WORK_COORDS = 0b1000_0000,

    NONE = 0b0000_0000,
    ALL = 0b1111_1111,
}

export const enum FeedRate {
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

export const enum StepMode {
    CONT = DisplayFlags.STEP_MODE_CONT,
    STEP = DisplayFlags.STEP_MODE_STEP,
    MPG = DisplayFlags.STEP_MODE_MPG,
    PERCENT = DisplayFlags.STEP_MODE_PERCENT,
}

export const enum CoordinateMode {
    MACHINE = DisplayFlags.MACHINE_COORDS,
    WORK = DisplayFlags.WORK_COORDS,
}

export enum Button {
    RESET = 1,
    STOP = 2,
    START_PAUSE = 3,
    MACRO_1_FEED_PLUS = 4,
    MACRO_2_FEED_MINUS = 5,
    MACRO_3_SPINDLE_PLUS = 6,
    MACRO_4_SPINDLE_MINUS = 7,
    MACRO_5_M_HOME = 8,
    MACRO_6_SAFE_Z = 9,
    MACRO_7_W_HOME = 10,
    MACRO_8_S_ON_OFF = 11,
    FN = 12,
    MACRO_9_PROBE_Z = 13,
    CONTINUOUS = 14,
    STEP = 15,
    MACRO_10 = 14,
}