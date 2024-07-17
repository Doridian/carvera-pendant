import EventEmitter from 'node:events';
import { Server, Socket } from 'node:net';
import { SerialPort } from 'serialport';
import { logger } from '../log';

interface ProxyTarget {
    send(data: Buffer): void;
    register(handler: (data: Buffer) => void): void;
    unregister(handler: (data: Buffer) => void): void;
}

export class SerialProxyTarget implements ProxyTarget {
    private readonly serial: SerialPort;
    public constructor(path: string) {
        this.serial = new SerialPort({
            path,
            baudRate: 115_200,
        });
    }

    public send(data: Buffer): void {
        this.serial.write(data);
    }

    public register(handler: (data: Buffer) => void): void {
        this.serial.on('data', handler);
    }

    public unregister(handler: (data: Buffer) => void): void {
        this.serial.off('data', handler);
    }
}

export class WlanProxyTarget implements ProxyTarget {
    private socket?: Socket;
    private handler?: (data: Buffer) => void;

    public constructor(
        private readonly carvera_hostname: string,
        private readonly carvera_port: number,
    ) {
        this.connect();
        setInterval(() => {
            this.connect();
        }, 10_000);
    }

    public send(data: Buffer): void {
        if (this.socket) {
            this.socket.write(data);
        }
    }

    public register(handler: (data: Buffer) => void): void {
        this.handler = handler;
    }

    public unregister(): void {
        this.handler = undefined;
    }

    private connect() {
        if (this.socket) {
            return;
        }

        logger.debug(`connecting to ${this.carvera_hostname}:${this.carvera_port}`);
        this.socket = new Socket();
        this.socket.connect(this.carvera_port, this.carvera_hostname, () => {
            logger.debug(`connected to ${this.carvera_hostname}:${this.carvera_port}`);
        });

        this.socket.on('data', (data) => {
            if (this.handler) {
                this.handler(data);
            }
        });

        this.socket.on('close', () => {
            logger.debug('carvera socket closed');
            this.socket = undefined;
        });

        this.socket.on('error', (err) => {
            logger.error(err);
            this.socket = undefined;
        });
    }
}

/*
 *Idle|
 *
 *MPos:-329.6600,-216.0100,-1.0000,0.0000,0.0000|
 *MPos:X,Y,Z,A,-,-|
 *
 *WPos:0.0000,0.0000,96.4050|
 *WPos:X,Y,Z|
 *
 *F:0.0,3000.0,100.0|
 *F:current,target,overall
 *
 *S:0.0,10000.0,100.0,1,24.3|
 *S:current,target,overall,vacuummode,spindletemp|
 *
 *W:4.10|
 *W:???|
 *
 *L:0, 0, 0, 0.0,100.0
 *L:mode,state,testing,power,scale|
 */

export class StatusReport {
    public mpos: number[] = [];
    public wpos: number[] = [];

    public feedCurrent = 0;
    public feedTarget = 0;

    public spindleCurrent = 0;
    public spindleTarget = 0;
    public spindleTemp = 0;

    public state = 'N/A';

    public laserTesting = false;

    /*
     * If the arg contains at least one Carvera status report (query string in Smoothieware
     * parlance), extract and return the last one.  Otherwise return undefined.
     */
    public static extractLast(data: string): StatusReport | undefined {
        const matches = [...data.matchAll(/<(Sleep|Pause|Wait|Alarm|Home|Hold|Idle|Run)\|.*?>/g)];
        if (matches.length > 0) {
            return StatusReport.parse((matches.at(-1) ?? [''])[0]);
        }

        return undefined;
    }

    public static parse(data: string): StatusReport {
        const res = new StatusReport();

        if (data.startsWith('<')) {
            data = data.slice(1);
        }

        if (data.endsWith('>')) {
            data = data.slice(0, -1);
        }

        const split = data.split('|');
        res.state = split[0] ?? 'N/A';

        for (let i = 1; i < split.length; i++) {
            const subSplit = (split[i] ?? '').split(':');
            switch (subSplit[0] ?? '') {
                case 'MPos':
                    res.mpos = (subSplit[1] ?? '').split(',').map(Number.parseFloat);
                    break;
                case 'WPos':
                    res.wpos = (subSplit[1] ?? '').split(',').map(Number.parseFloat);
                    break;
                case 'F':
                    // eslint-disable-next-line no-case-declarations
                    const feedSplit = (subSplit[1] ?? '').split(',').map(Number.parseFloat);
                    res.feedCurrent = feedSplit[0] ?? 0;
                    res.feedTarget = feedSplit[1] ?? 0;
                    break;
                case 'S':
                    // eslint-disable-next-line no-case-declarations
                    const spindleSplit = (subSplit[1] ?? '').split(',').map(Number.parseFloat);
                    res.spindleCurrent = spindleSplit[0] ?? 0;
                    res.spindleTarget = spindleSplit[1] ?? 0;
                    res.spindleTemp = spindleSplit[4] ?? 0;
                    break;
                case 'L':
                    // eslint-disable-next-line no-case-declarations
                    const laserSplit = (subSplit[1] ?? '').split(',').map(Number.parseFloat);
                    res.laserTesting = laserSplit[2] !== 0;
                    break;
            }
        }

        return res;
    }
}

// eslint-disable-next-line unicorn/prefer-event-target
export class ProxyProvider extends EventEmitter {
    private server?: Server;
    private client?: Socket;

    private deviceDataBuffer = '';

    public constructor(
        private readonly target: ProxyTarget,
        private readonly port: number,
        private readonly ip: string,
    ) {
        super();
        this.deviceDataHandler = this.deviceDataHandler.bind(this);
        // When there is no client connected, periodically send our own status requests.
        setInterval(() => {
            if (this.client === undefined) {
                this.inject('?');
            }
        }, 500);
    }

    public isBusy(): boolean {
        return this.client !== undefined;
    }

    public inject(command: string): void {
        this.target.send(Buffer.from(command));
    }
    public stop(): void {
        if (this.server) {
            this.server.close();
            this.server = undefined;
        }

        if (this.client) {
            this.client.end();
            this.client = undefined;
        }

        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.target.unregister(this.deviceDataHandler);
    }

    public start(): void {
        this.stop();
        this.server = new Server();
        this.server.listen(this.port, this.ip);
        this.server.on('connection', (socket) => {
            this.clientHandler(socket);
        });

        // eslint-disable-next-line @typescript-eslint/unbound-method
        this.target.register(this.deviceDataHandler);
    }

    private clientHandler(socket: Socket) {
        if (this.client) {
            this.client.end();
        }

        this.client = socket;

        socket.on('error', (err) => {
            if (this.client !== socket) {
                return;
            }

            logger.error(err);
            this.client = undefined;
        });

        socket.on('close', () => {
            if (this.client !== socket) {
                return;
            }

            this.client = undefined;
        });

        socket.on('data', (data) => {
            if (this.client !== socket) {
                return;
            }

            this.clientDataHandler(data);
        });
    }

    private clientDataHandler(data: Buffer) {
        this.target.send(data);
    }

    private deviceDataHandler(data: Buffer) {
        this.client?.write(data);
        this.deviceDataBuffer += data.toString('utf8');
        this.deviceDataBuffer = this.deviceDataBuffer.slice(-300); // long enough for a status report
        const status = StatusReport.extractLast(this.deviceDataBuffer);
        if (status) {
            logger.debug(status);
            this.emit('status', status);
        }
    }
}
