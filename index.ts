import { DiscoveryProvider } from "./interposer/discovery";
import { ProxyProvider, SerialProxyTarget, StatusReport } from "./interposer/proxy";
import { JogReport, PendantDevice } from "./pendant/device";
import { Axis, CoordinateMode, FeedRate, StepMode } from "./pendant/types";

/*

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
*/

async function main() {
    const SERIAL_PORT = '/dev/cu.usbserial-A50285BI';
    const PROXY_IP = '127.0.0.1';
    const PROXY_PORT = 9999;

    const pendant = new PendantDevice();
    pendant.on('error', (err: any) => {
        console.error(err);
        process.exit(1);
    });

    const target = new SerialProxyTarget(SERIAL_PORT);
    const proxy = new ProxyProvider(target, PROXY_PORT, PROXY_IP);
    const discovery = new DiscoveryProvider('Pendant', PROXY_IP, PROXY_PORT, proxy);

    proxy.start();
    discovery.start();

    await pendant.init();
    pendant.stepMode = StepMode.STEP;
    pendant.coordinateMode = CoordinateMode.MACHINE;

    pendant.on('jog', (jog: JogReport) => {
        let axisName = '';
        switch (jog.axis) {
            case Axis.X:
                axisName = 'X';
                break;
            case Axis.Y:
                axisName = 'Y';
                break;
            case Axis.Z:
                axisName = 'Z';
                break;
            case Axis.A:
                axisName = 'A';
                break;
        }

        let jogAmount = jog.delta;
        switch (jog.stepMode) {
            case StepMode.STEP:
                switch (jog.rate) {
                    case FeedRate.RATE_0_001:
                        jogAmount *= 0.001;
                        break;
                    case FeedRate.RATE_0_01:
                        jogAmount *= 0.01;
                        break;
                    case FeedRate.RATE_0_1:
                        jogAmount *= 0.1;
                        break;
                    case FeedRate.RATE_1_0:
                        //jogAmount *= 1;
                        break;
                }
                break;
        }

        proxy.inject(`$J ${axisName}${jogAmount.toFixed(4)}\n`);
    });

    proxy.on('status', (status: StatusReport) => {
        switch (pendant.coordinateMode) {
            case CoordinateMode.MACHINE:
                pendant.axisCoordinates[Axis.X] = status.mpos[0];
                pendant.axisCoordinates[Axis.Y] = status.mpos[1];
                pendant.axisCoordinates[Axis.Z] = status.mpos[2];
                pendant.axisCoordinates[Axis.A] = status.mpos[3];
                break;
            case CoordinateMode.WORK:
                pendant.axisCoordinates[Axis.X] = status.wpos[0];
                pendant.axisCoordinates[Axis.Y] = status.wpos[1];
                pendant.axisCoordinates[Axis.Z] = status.wpos[2];
                pendant.axisCoordinates[Axis.A] = 0;
                break;
        }

        const isIdle = status.state === 'Idle';

        pendant.spindleSpeed = isIdle ? status.spindleTarget : status.spindleCurrent;
        pendant.feedRate = isIdle ? status.feedTarget : status.feedCurrent;

        pendant.refreshDisplay();
    });

    console.log('System online!');
}

main().catch(console.error);
