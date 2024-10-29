import { EventEmitter } from 'node:events';
import { Device, devices, HID } from 'node-hid';
import { logger } from '../log';
import { ControlReport } from './control';
import { DeviceReport } from './report';
import { Axis, Button, CoordinateMode, FeedRate, StepMode } from './types';

const PENDANT_VID = 0x10_ce;
const PENDANT_PID = 0xeb_93;

export interface JogReport {
    stepMode: StepMode;
    axis: Axis;
    rate: FeedRate;
    delta: number;
}

const DISPLAY_AXIS_XYZ = [Axis.X, Axis.Y, Axis.Z];
const DISPLAY_AXIS_ABC = [Axis.A, Axis.B, Axis.C];

// eslint-disable-next-line unicorn/prefer-event-target
export class PendantDevice extends EventEmitter {
    // Displayed data
    public axisCoordinates: Record<Axis, number> = {
        [Axis.X]: 0,
        [Axis.Y]: 0,
        [Axis.Z]: 0,
        [Axis.A]: 0,
        [Axis.B]: 0,
        [Axis.C]: 0,
    };
    public feedRate = 0;
    public spindleSpeed = 0;

    public coordinateMode: CoordinateMode = CoordinateMode.MACHINE;
    public stepMode: StepMode = StepMode.CONT;

    public selectedAxis: Axis = Axis.C;

    // Control state
    private pressedButtons = new Set<Button>();
    // Should the FN modifier apply to the next button press?
    private fnModifierActive = false;
    // Should the FN modifier be cleared as soon as the FN button is released?
    private clearModifierOnFnUp = false;

    // Internal state
    private axisLines: Axis[] = DISPLAY_AXIS_XYZ;

    private writeDevice?: HID;
    private readDevice?: HID;

    public constructor() {
        super();
    }

    public control(packet: ControlReport): void {
        if (!this.writeDevice) {
            throw new Error('Cannot control unopened device');
        }

        packet.writeTo(this.writeDevice);
    }

    public refreshDisplay(): void {
        const packet = new ControlReport();
        // eslint-disable-next-line no-bitwise
        packet.flags = this.stepMode | this.coordinateMode;
        packet.feedRate = this.feedRate;
        packet.spindleSpeed = this.spindleSpeed;
        packet.coordinates = this.axisLines.map((axis) => this.axisCoordinates[axis]);
        this.control(packet);
    }

    public init(): void {
        const deviceInfos = devices().filter((d: Device) => {
            return d.vendorId === PENDANT_VID && d.productId === PENDANT_PID && d.path;
        });

        /*
         * On Windows, there are two devices (read & write) with different paths.
         * On Linux, there are two devices with the same path.
         * On OSX, there is one device.
         */
        const uniqueDevicePaths = new Set(deviceInfos.map((di) => di.path ?? ''));
        // Sort the paths to ensure that, on Windows, the read device comes first.
        const devicePaths = Array.from(uniqueDevicePaths).sort();
        if (deviceInfos.length === 0) {
            logger.error('No pendant dongle found');
            process.exit(1);
        } else if (devicePaths.length < 1 || devicePaths.length > 2) {
            logger.error(`Expected 1 or 2 pendant HID devices, found ${devicePaths.length}: ${devicePaths.join(', ')}`);
            process.exit(1);
        }

        this.readDevice = new HID(devicePaths[0] ?? '');
        this.readDevice.on('data', this.handleData.bind(this));
        this.readDevice.on('error', this.handleError.bind(this));

        this.writeDevice = new HID(devicePaths.at(-1) ?? '');
        this.writeDevice.on('error', this.handleError.bind(this));
    }

    private refreshDisplayOneshot() {
        try {
            this.handleError.bind(this);
        } catch (error) {
            this.handleError(error as Error);
        }
    }

    private handleReport(report: DeviceReport) {
        let needsRedraw = false;

        this.selectedAxis = report.axis ?? Axis.C;

        let targetAxisOffset;
        switch (this.selectedAxis) {
            case Axis.A:
            case Axis.B:
            case Axis.C:
                targetAxisOffset = DISPLAY_AXIS_ABC;
                break;
            case Axis.X:
            case Axis.Y:
            case Axis.Z:
                targetAxisOffset = DISPLAY_AXIS_XYZ;
                break;
        }

        if (targetAxisOffset !== this.axisLines) {
            needsRedraw = true;
            this.axisLines = targetAxisOffset;
        }

        for (const button of report.buttons) {
            if (!this.pressedButtons.has(button)) {
                if (button === Button.FN) {
                    /*
                     * FN on its own will apply the modifier to the next button.
                     * Pressing FN on its own a second time will clear the modifier.
                     * Holding down FN while pressing other buttons will apply the
                     * modifier to just those buttons.
                     */
                    this.fnModifierActive = !this.fnModifierActive;
                    this.clearModifierOnFnUp = false;
                } else {
                    // non-FN button
                    logger.debug(`button_down: ${this.fnModifierActive ? 'FN ' : ''}${Button[button]}`);
                    this.emit('button_down', button, this.fnModifierActive);
                    this.clearModifierOnFnUp = true;
                }
            }
        }

        for (const oldButton of this.pressedButtons) {
            if (!report.buttons.has(oldButton)) {
                if (oldButton === Button.FN) {
                    if (this.clearModifierOnFnUp) {
                        this.fnModifierActive = false;
                        this.clearModifierOnFnUp = false;
                    }
                } else {
                    // non-FN button
                    logger.debug(`button_up: ${this.fnModifierActive ? 'FN ' : ''}${Button[oldButton]}`);
                    this.emit('button_up', oldButton, this.fnModifierActive);
                    // If FN is no longed being held down, clear FN status
                    if (!this.pressedButtons.has(Button.FN)) {
                        this.fnModifierActive = false;
                        this.clearModifierOnFnUp = false;
                    }
                }
            }
        }

        if (report.jog && report.axis) {
            const jogReport: JogReport = {
                axis: report.axis,
                delta: report.jog,
                rate: report.feedRate,
                stepMode: this.stepMode,
            };

            logger.debug(`jog: ${JSON.stringify(jogReport)}`);
            this.emit('jog', jogReport);
        }

        this.pressedButtons = report.buttons;

        if (needsRedraw) {
            this.refreshDisplayOneshot();
        }
    }

    private handleData(data: Buffer) {
        const reportID = data[0] ?? 0;
        data = data.subarray(1);
        if (reportID === 0x04) {
            const report = new DeviceReport(data);
            this.handleReport(report);
            this.emit('report', report);
        } else {
            this.handleError(new Error(`Unknown report ${reportID} with data ${data.toString('hex')}`));
        }
    }

    private handleError(err: Error) {
        this.emit('error', err);
    }
}
