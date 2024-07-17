import { Config } from './config';
import { DiscoveryProvider } from './interposer/discovery';
import { getNetworkAddresses } from './interposer/net';
import { ProxyProvider, SerialProxyTarget, StatusReport, WlanProxyTarget } from './interposer/proxy';
import { logger } from './log';
import { JogReport, PendantDevice } from './pendant/device';
import { Axis, CoordinateMode, FeedRate, StepMode } from './pendant/types';

function main() {
    const pendant = new PendantDevice();

    const SERIAL_PORT = process.env.CARVERA_SERIAL_PORT ?? Config.CARVERA_SERIAL_PORT;
    // eslint-disable-next-line unicorn/no-negation-in-equality-check
    if (!SERIAL_PORT === !Config.CARVERA_HOST_NAME) {
        logger.error('Exactly one of CARVERA_SERIAL_PORT and CARVERA_HOST_NAME must be set');
        process.exit(1);
    }

    const target = SERIAL_PORT
        ? new SerialProxyTarget(SERIAL_PORT)
        : new WlanProxyTarget(Config.CARVERA_HOST_NAME, Config.CARVERA_PORT);

    target.send(Buffer.from('?')); // Query machine status

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (Config.PROXY_IP && !getNetworkAddresses().includes(Config.PROXY_IP)) {
        logger.error(
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            `PROXY_IP must either be blank or one of ${getNetworkAddresses().join(', ')} (got ${Config.PROXY_IP})`,
        );

        process.exit(1);
    }

    const proxy = new ProxyProvider(target, Config.PROXY_PORT, Config.PROXY_IP);
    const discovery = new DiscoveryProvider(Config.ADVERTISED_NAME, Config.PROXY_IP, Config.PROXY_PORT, proxy);

    proxy.start();
    discovery.start();

    pendant.init();
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
            case Axis.B:
                axisName = 'B';
                break;
            case Axis.C:
                axisName = 'C';
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
                        // jogAmount *= 1;
                        break;

                    default:
                        break;
                }

                break;
            default:
                break;
        }

        proxy.inject(`$J ${axisName}${jogAmount.toFixed(4)}\n`);
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
                proxy.inject('G28\n');
                break;
            case 9: // Safe-Z
                proxy.inject('G90\nG53 G0 Z-1\n');
                break;
            case 10: // W-Home
                proxy.inject('G90\nG53 G0 Z-1\nG54 G0 X0 Y0\n');
                break;
            case 11: // S-ON/OFF
                if (currentStatus.laserTesting) {
                    proxy.inject('M324\nM322\n');
                } else {
                    proxy.inject('M321\nM323\n');
                }

                break;
            case 12: // Fn
                break;

            case 13: // Probe-Z
                proxy.inject('G38.2 Z-152.200 F500.000\n');
                break;

            case 14: // Continuous
                pendant.coordinateMode =
                    pendant.coordinateMode === CoordinateMode.MACHINE ? CoordinateMode.WORK : CoordinateMode.MACHINE;

                try {
                    pendant.refreshDisplay();
                } catch (error) {
                    logger.error(error);
                }

                break;
            case 15: // Step
                break;

            case 16: // Macro-10
                // eslint-disable-next-line no-case-declarations
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

                proxy.inject(`G10 L20 P0 ${axis}0\n`);
                break;
        }
    });

    proxy.on('status', (status: StatusReport) => {
        currentStatus = status;

        switch (pendant.coordinateMode) {
            case CoordinateMode.MACHINE:
                pendant.axisCoordinates[Axis.X] = status.mpos[0] ?? 0;
                pendant.axisCoordinates[Axis.Y] = status.mpos[1] ?? 0;
                pendant.axisCoordinates[Axis.Z] = status.mpos[2] ?? 0;
                pendant.axisCoordinates[Axis.A] = status.mpos[3] ?? 0;
                break;
            case CoordinateMode.WORK:
                pendant.axisCoordinates[Axis.X] = status.wpos[0] ?? 0;
                pendant.axisCoordinates[Axis.Y] = status.wpos[1] ?? 0;
                pendant.axisCoordinates[Axis.Z] = status.wpos[2] ?? 0;
                pendant.axisCoordinates[Axis.A] = 0;
                break;
        }

        const isIdle = status.state === 'Idle';

        pendant.spindleSpeed = isIdle ? status.spindleTarget : status.spindleCurrent;
        pendant.feedRate = isIdle ? status.feedTarget : status.feedCurrent;

        pendant.refreshDisplay();
    });

    logger.info('System online!');
}

main();