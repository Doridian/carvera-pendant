import { Axis, Button, FeedRate } from './types';

const SELECTED_AXIS_NONE = 0x06;

export class DeviceReport {
  public buttons: Set<Button>;
  public feedRate: FeedRate;
  public axis?: Axis;
  public jog: number;

  public constructor(report: Buffer) {
    /*
     * [0] = random, ignore this
     * [1] = button1
     * [2] = button2
     * [3] = speed dial
     * [4] = axis dial
     * [5] = jog delta, signed int8
     * [6] = weird checksum, ignore this
     */

    this.buttons = new Set();
    if (report[1]) {
      this.buttons.add(report[1]);
    }

    if (report[2]) {
      this.buttons.add(report[2]);
    }

    this.feedRate = report[3] ?? 0;
    this.axis = report[4] === SELECTED_AXIS_NONE ? undefined : report[4];
    this.jog = new Int8Array(report)[5] ?? 0;
  }
}
