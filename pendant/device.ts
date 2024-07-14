import { EventEmitter } from "node:events";
import { Device, HID, devices } from "node-hid";
import { ControlReport } from "./control";
import { DeviceReport } from "./report";
import { CoordinateMode, DisplayFlags, Axis, FeedRate, StepMode } from "./types";
import { exitCode } from "node:process";

const PENDANT_VID = 0x10ce;
const PENDANT_PID = 0xeb93;

export interface JogReport {
    stepMode: StepMode;
    axis: Axis;
    rate: FeedRate;
    delta: number;
}

const DISPLAY_AXIS_XYZ = [Axis.X, Axis.Y, Axis.Z];
const DISPLAY_AXIS_ABC = [Axis.A, Axis.B, Axis.C];

export class PendantDevice extends EventEmitter {
    // Displayed data
    public axisCoordinates: { [key in Axis]: number } = {
        [Axis.X]: 0,
        [Axis.Y]: 0,
        [Axis.Z]: 0,
        [Axis.A]: 0,
        [Axis.B]: 0,
        [Axis.C]: 0,
    };
    public feedRate: number = 0;
    public spindleSpeed: number = 0;

    public coordinateMode: CoordinateMode = CoordinateMode.MACHINE;
    public stepMode: StepMode = StepMode.CONT;

    public selectedAxis: Axis = Axis.C;

    // Control state
    private pressedButtons: Set<number> = new Set();

    // Internal state
    private axisLines: Axis[] = DISPLAY_AXIS_XYZ;

    private writeDevice?: HID;
    private readDevice?: HID;

    public constructor() {
        super();
    }

    public async control(packet: ControlReport) {
        if (!this.writeDevice) {
            throw new Error('Cannot control unopened device');
        }
        packet.writeTo(this.writeDevice);
    }

    public async refreshDisplay() {
        const packet = new ControlReport();
        packet.flags = this.stepMode | this.coordinateMode;
        packet.feedRate = this.feedRate;
        packet.spindleSpeed = this.spindleSpeed;
        packet.coordinates = this.axisLines.map(axis => this.axisCoordinates[axis]);
        await this.control(packet);
    }

    public init() {
        const deviceInfos = devices().filter((d: Device) => {
            return d.vendorId == PENDANT_VID && d.productId == PENDANT_PID && d.path;
        });
        if (deviceInfos.length == 0) {
            throw new Error('No pendant dongle found');
        } else if (deviceInfos.length != 2) {
            throw new Error('Expected 2 pendant HID devices, found ' + deviceInfos.length);
        }

        // Sort by path, so that the read device (Col01) comes first, followed by
        // the write device (Col02).
        deviceInfos.sort((a, b) => {
            if (a.path! < b.path!) {
                return -1;
            } else if (a.path! > b.path!) {
                return 1;
            } else {
                return 0;
            }
        });

        this.readDevice = new HID(deviceInfos[0].path!);
        this.readDevice.on('data', this.handleData.bind(this));
        this.readDevice.on('error', this.handleError.bind(this));
        
        this.writeDevice = new HID(deviceInfos[1].path!);
        this.writeDevice.on('error', this.handleError.bind(this));
    }

    private refreshDisplayOneshot() {
        this.refreshDisplay().catch(this.handleError.bind(this));
    }

    private handleReport(report: DeviceReport) {
        let needsRedraw = false;

        this.selectedAxis = report.axis ?? Axis.C;

        let targetAxisOffset = DISPLAY_AXIS_XYZ;
        switch (report.axis) {
            case Axis.A:
            case Axis.B:
            case Axis.C:
                targetAxisOffset = DISPLAY_AXIS_ABC;
                break;
            default:
                targetAxisOffset = DISPLAY_AXIS_XYZ;
        }

        if (targetAxisOffset !== this.axisLines) {
            needsRedraw = true;
            this.axisLines = targetAxisOffset;
        }

        for (const button of report.buttons) {
            if (!this.pressedButtons.has(button)) {
                this.emit('button_down', button);
            }
        }

        for (const oldButton of this.pressedButtons) {
            if (!report.buttons.has(oldButton)) {
                this.emit('button_up', oldButton);
            }
        }

        if (report.jog && report.axis) {
            const jogReport: JogReport = {
                axis: report.axis,
                delta: report.jog,
                rate: report.feedRate,
                stepMode: this.stepMode,
            };
            this.emit('jog', jogReport);
        }

        this.pressedButtons = report.buttons;

        if (needsRedraw) {
            this.refreshDisplayOneshot();
        }
    }

    private handleData(data: Buffer) {
        const reportID = data[0];
        data = data.subarray(1);
        if (reportID == 0x04) {
            const report = new DeviceReport(data);
            this.handleReport(report);
            this.emit('report', report);
        } else {
            this.handleError(new Error(`Unknown report ${reportID} with data ${data}`));
        }
    }

    private handleError(err: Error) {
        this.emit('error', err);
    }
}