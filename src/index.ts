import { Config } from './config';
import { DiscoveryProvider } from './interposer/discovery';
import { getNetworkAddresses } from './interposer/net';
import { ProxyProvider, SerialProxyTarget, StatusReport, WlanProxyTarget } from './interposer/proxy';
import { logger } from './log';
import { JogReport, PendantDevice } from './pendant/device';
import { Axis, Button, CoordinateMode, FeedRate, StepMode } from './pendant/types';

function main() {
  const pendant = new PendantDevice();

  // eslint-disable-next-line unicorn/no-negation-in-equality-check
  if (!Config.CARVERA_SERIAL_PORT === !Config.CARVERA_HOST_NAME) {
    logger.error('Exactly one of CARVERA_SERIAL_PORT and CARVERA_HOST_NAME must be set');
    process.exit(1);
  }

  const target = Config.CARVERA_SERIAL_PORT
    ? new SerialProxyTarget(Config.CARVERA_SERIAL_PORT)
    : new WlanProxyTarget(Config.CARVERA_HOST_NAME, Config.CARVERA_PORT);

  // Query machine status
  target.send(Buffer.from('?'));

  if (Config.PROXY_IP && !getNetworkAddresses().includes(Config.PROXY_IP)) {
    logger.error(
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
    let jogAmount = jog.delta;
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (jog.stepMode) {
      case StepMode.STEP:
        // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
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

    proxy.inject(`$J ${Axis[jog.axis]}${jogAmount.toFixed(4)}\n`);
  });

  // eslint-disable-next-line complexity, no-inline-comments
  pendant.on('button_up', (button: Button /* , fn_modifier: boolean*/) => {
    switch (button) {
      case Button.RESET:
        proxy.inject('\n$X\n');
        break;

      case Button.STOP:
        proxy.inject('\nM112\n');
        break;

      case Button.START_PAUSE:
        switch (currentStatus.state) {
          case 'Idle':
            proxy.inject('\n~\n');
            break;
          default:
            proxy.inject('\n!\n');
            break;
        }

        break;

      case Button.MACRO_1_FEED_PLUS:
        break;

      case Button.MACRO_2_FEED_MINUS:
        break;

      case Button.MACRO_3_SPINDLE_PLUS:
        break;

      case Button.MACRO_4_SPINDLE_MINUS:
        break;

      case Button.MACRO_5_M_HOME:
        proxy.inject('G28\n');
        break;

      case Button.MACRO_6_SAFE_Z:
        proxy.inject('G90\nG53 G0 Z-1\n');
        break;

      case Button.MACRO_7_W_HOME:
        proxy.inject('G90\nG53 G0 Z-1\nG54 G0 X0 Y0\n');
        break;

      case Button.MACRO_8_S_ON_OFF:
        if (currentStatus.laserTesting) {
          proxy.inject('M324\nM322\n');
        } else {
          proxy.inject('M321\nM323\n');
        }

        break;

      case Button.MACRO_9_PROBE_Z:
        proxy.inject('G38.2 Z-152.200 F500.000\n');
        break;

      case Button.CONTINUOUS:
        pendant.coordinateMode =
          pendant.coordinateMode === CoordinateMode.MACHINE ? CoordinateMode.WORK : CoordinateMode.MACHINE;

        try {
          pendant.refreshDisplay();
        } catch (error) {
          logger.error(error);
        }

        break;

      case Button.STEP:
        break;

      case Button.MACRO_10:
        proxy.inject(`G10 L20 P0 ${Axis[pendant.selectedAxis]}0\n`);
        break;

      // we never receive this
      case Button.FN:
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
