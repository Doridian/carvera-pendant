import { HID } from "node-hid";
import { DisplayFlags } from "./types";

const CONTROL_REPORT_ID = 0x06;
const BLOCK_DATA_LEN = 7;

export class ControlReport {
    seed: number = 0xff;
    flags: DisplayFlags = DisplayFlags.NONE;

    coordinates: number[] = [0, 0, 0];

    feedRate: number = 0;
    spindleSpeed: number = 0;

    constructor() {
    }

    public writeTo(dev: HID) {
        const data = Buffer.alloc(42);
        data[0] = 0xfe;
        data[1] = 0xfd;
        data[2] = this.seed;
        data[3] = this.flags;

        ControlReport.encodeFloat(data, this.coordinates[0], 4);
        ControlReport.encodeFloat(data, this.coordinates[1], 8);
        ControlReport.encodeFloat(data, this.coordinates[2], 12);

        const uintArr = new Uint16Array(data.buffer, data.byteOffset + 16, 2);
        uintArr[0] = this.feedRate;
        uintArr[1] = this.spindleSpeed;

        // data[20]

        const blockCount = data.byteLength / BLOCK_DATA_LEN;
        const buf = Buffer.alloc(BLOCK_DATA_LEN + 1);
        buf[0] = CONTROL_REPORT_ID;
        for (let i = 0; i < blockCount; i++) {
            data.copy(buf, 1, i * BLOCK_DATA_LEN);
            dev.sendFeatureReport(buf);
        }
    }

    private static encodeFloat(buf: Buffer, num: number, offset: number) {
        const uintArr = new Uint16Array(buf.buffer, buf.byteOffset + offset, 2);
    
        const isNegative = num < 0;
    
        const numAbs = Math.abs(num);
    
        const numAbsInt = numAbs | 0;
        const numAbsFrac = numAbs - numAbsInt;
    
        uintArr[0] = numAbsInt;
        uintArr[1] = Math.round(numAbsFrac * 10_000);
        if (isNegative) {
            uintArr[1] |= 0b1000000000000000;
        }
    }
}
