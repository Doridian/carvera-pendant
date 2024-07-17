import { HID } from 'node-hid';
import { DisplayFlags } from './types';

const CONTROL_REPORT_ID = 0x06;
const BLOCK_DATA_LEN = 7;

export class ControlReport {
    public seed = 0xff;
    public flags: DisplayFlags = DisplayFlags.NONE;

    public coordinates: number[] = [0, 0, 0];

    public feedRate = 0;
    public spindleSpeed = 0;

    private static encodeFloat(buf: Buffer, num: number, offset: number): void {
        const uintArr = new Uint16Array(buf.buffer, buf.byteOffset + offset, 2);

        const isNegative = num < 0;

        const numAbs = Math.abs(num);

        const numAbsInt = Math.trunc(numAbs);
        const numAbsFrac = numAbs - numAbsInt;

        uintArr[0] = numAbsInt;
        uintArr[1] = Math.round(numAbsFrac * 10_000);
        if (isNegative) {
            // eslint-disable-next-line no-bitwise
            uintArr[1] |= 0b1000_0000_0000_0000;
        }
    }

    public writeTo(dev: HID): void {
        const data = Buffer.alloc(42);
        data[0] = 0xfe;
        data[1] = 0xfd;
        data[2] = this.seed;
        data[3] = this.flags;

        ControlReport.encodeFloat(data, this.coordinates[0] ?? 0, 4);
        ControlReport.encodeFloat(data, this.coordinates[1] ?? 0, 8);
        ControlReport.encodeFloat(data, this.coordinates[2] ?? 0, 12);

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
}
