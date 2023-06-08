import { JogReport, PendantDevice } from "./pendant/device";
import { Axis, StepMode } from "./pendant/types";

const device = new PendantDevice();
device.on('error', (err: any) => {
    console.error(err);
    process.exit(1);
});

device.on('button_up', (button: number) => {
    console.log('Released', button);
});

device.on('jog', (jog: JogReport) => {
    console.log('jog', jog);
})

device.init().then(() => {
    device.axisCoordinates[Axis.X] = 1.2345;
    device.axisCoordinates[Axis.Y] = 2.3456;
    device.axisCoordinates[Axis.Z] = 3.4567;
    device.axisCoordinates[Axis.A] = 4.5678;
    device.axisCoordinates[Axis.B] = 5.6789;
    device.axisCoordinates[Axis.C] = 6.7890;
    device.spindleSpeed = 10000;
    device.feedRate = 400;
    device.stepMode = StepMode.STEP;
    device.refreshDisplay().catch(console.error);
});
