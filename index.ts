import { JogReport, PendantDevice, StepMode } from "./pendant/device";

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
    device.axisCoordinates[0] = 1.2345;
    device.axisCoordinates[1] = 2.3456;
    device.axisCoordinates[2] = 3.4567;
    device.axisCoordinates[3] = 4.5678;
    device.axisCoordinates[4] = 5.6789;
    device.axisCoordinates[5] = 6.7890;
    device.spindleSpeed = 10000;
    device.feedRate = 400;
    device.stepMode = StepMode.STEP_MODE_STEP;
    device.refreshDisplay().catch(console.error);
});
