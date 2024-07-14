import { DiscoveryProvider } from "./interposer/discovery";
import { ProxyProvider, SerialProxyTarget, StatusReport } from "./interposer/proxy";
import { JogReport, PendantDevice } from "./pendant/device";
import { Axis, CoordinateMode, FeedRate, StepMode } from "./pendant/types";

async function main() {
    const SERIAL_PORT = process.env.CARVERA_SERIAL_PORT || '';
    const PROXY_IP = '127.0.0.1';
    const PROXY_PORT = 9999;

    const pendant = new PendantDevice();

    const target = new SerialProxyTarget(SERIAL_PORT);
    const proxy = new ProxyProvider(target, PROXY_PORT, PROXY_IP);
    const discovery = new DiscoveryProvider('Pendant', PROXY_IP, PROXY_PORT, proxy);

    proxy.start();
    discovery.start();

    await pendant.init();
    pendant.stepMode = StepMode.STEP;
    pendant.coordinateMode = CoordinateMode.MACHINE;

    let currentStatus = new StatusReport();

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

        proxy.injectWhenAlive(`$J ${axisName}${jogAmount.toFixed(4)}\n`);
    });

    pendant.on('button_up', (button: number) => {
        switch (button) {
            case 1: // Reset
                proxy.inject('\n$X\n');
                break;
            case 2: // Stop
                proxy.inject('\nM112\n');
                break;
            case 3: // Start/Pause
                switch (currentStatus.state) {
                    case 'Idle':
                        proxy.inject('\n~\n');
                        break;
                    default:
                        proxy.inject('\n!\n');
                        break;
                }
                break;

            case 4: // Feed+
                break;
            case 5: // Feed-
                break;
            case 6: // Spindle+
                break;
            case 7: // Spindle-
                break;

            case 8: // M-Home
                proxy.injectWhenAlive('G28\n');
                break;
            case 9: // Safe-Z
                proxy.injectWhenAlive('G90\nG53 G0 Z-1\n');
                break;
            case 10: // W-Home
                proxy.injectWhenAlive('G90\nG53 G0 Z-1\nG54 G0 X0 Y0\n');
                break;
            case 11: // S-ON/OFF
                if (currentStatus.laserTesting) {
                    proxy.injectWhenAlive('M324\nM322\n');
                } else {
                    proxy.injectWhenAlive('M321\nM323\n');
                }
                break;
            case 12: // Fn
                break;

            case 13: // Probe-Z
                proxy.injectWhenAlive('G38.2 Z-152.200 F500.000\n');
                break;

            case 14: // Continuous
                if (pendant.coordinateMode === CoordinateMode.MACHINE) {
                    pendant.coordinateMode = CoordinateMode.WORK;
                } else {
                    pendant.coordinateMode = CoordinateMode.MACHINE;
                }
                pendant.refreshDisplay().catch(console.error);
                break;
            case 15: // Step
                break;

            case 16: // Macro-10
                let axis = '_';
                switch (pendant.selectedAxis) {
                    case Axis.X:
                        axis = 'X';
                        break;
                    case Axis.Y:
                        axis = 'Y';
                        break;
                    case Axis.Z:
                        axis = 'Z';
                        break;
                    case Axis.A:
                        axis = 'A';
                        break;
                    case Axis.B:
                        axis = 'B';
                        break;
                    case Axis.C:
                        axis = 'C';
                        break;
                }
                proxy.injectWhenAlive(`G10 L20 P0 ${axis}0\n`);
                break;
        }
    });

    proxy.on('status', (status: StatusReport) => {
        currentStatus = status;

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
