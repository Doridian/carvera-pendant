import EventEmitter from 'node:events';
import { Server, Socket } from 'node:net';
import { SerialPort } from 'serialport';

export interface ProxyTarget {
    send(data: Buffer): void;
    register(handler: (data: Buffer) => void): void;
    unregister(handler: (data: Buffer) => void): void;
}

export class SerialProxyTarget implements ProxyTarget {
    private serial: SerialPort;
    constructor(path: string) {
        this.serial = new SerialPort({
            path,
            baudRate: 115200,
        });
    }

    send(data: Buffer) {
        this.serial.write(data);
    }

    register(handler: (data: Buffer) => void) {
        this.serial.on('data', handler);
    }

    unregister(handler: (data: Buffer) => void) {
        this.serial.off('data', handler);
    }
}

export class WlanProxyTarget implements ProxyTarget {
    private socket?: Socket;
    private timer?: NodeJS.Timeout;
    private handler?: (data: Buffer) => void;

    constructor(private carvera_hostname: string, private carvera_port: number) {
        this.connect();
        this.timer = setInterval(() => {
            this.connect();
        }, 10000);
    }

    public send(data: Buffer): void {
        if (this.socket) {
            this.socket.write(data);
        }
    }

    public register(handler: (data: Buffer) => void): void {
        this.handler = handler;
    }

    public unregister(handler: (data: Buffer) => void): void {
        this.handler = undefined;
    }

    private connect() {
        if (this.socket) {
            return;
        }
        console.debug(`connecting to ${this.carvera_hostname}:${this.carvera_port}`)
        this.socket = new Socket();
        this.socket.connect(this.carvera_port, this.carvera_hostname, () => {
            console.debug(`connected to ${this.carvera_hostname}:${this.carvera_port}`)
        });
        this.socket.on('data', (data) => {
            if (this.handler) {
                this.handler(data);
            }
        });    
        this.socket.on('close', () => {
            console.debug()
            this.socket = undefined;
        });
        this.socket.on('error', (err) => {
            console.error(err);
            this.socket = undefined;
        });
    }
}

/*
Idle|

MPos:-329.6600,-216.0100,-1.0000,0.0000,0.0000|
MPos:X,Y,Z,A,-,-|

WPos:0.0000,0.0000,96.4050|
WPos:X,Y,Z|

F:0.0,3000.0,100.0|
F:current,target,overall

S:0.0,10000.0,100.0,1,24.3|
S:current,target,overall,vacuummode,spindletemp|

W:4.10|
W:???|

L:0, 0, 0, 0.0,100.0
L:mode,state,testing,power,scale|
*/

export class StatusReport {
    mpos: number[] = [];
    wpos: number[] = [];

    feedCurrent: number = 0;
    feedTarget: number = 0;

    spindleCurrent: number = 0;
    spindleTarget: number = 0;
    spindleTemp: number = 0;

    state: string = 'N/A';

    laserTesting: boolean = false;

    // If the arg contains at least one Carvera status report (query string in Smoothieware
    // parlance), extract and return the last one.  Otherwise return undefined.
    public static extractLast(data: string): StatusReport | undefined {
        const matches = [...data.matchAll(/<(Sleep|Pause|Wait|Alarm|Home|Hold|Idle|Run)[|].*?>/g)];
        if (matches.length > 0) {
            return StatusReport.parse(matches[matches.length - 1][0])
        }
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
        res.state = split[0];

        for (let i = 1; i < split.length; i++) {
            const subSplit = split[i].split(':');
            switch (subSplit[0]) {
                case 'MPos':
                    res.mpos = subSplit[1].split(',').map(parseFloat);
                    break;
                case 'WPos':
                    res.wpos = subSplit[1].split(',').map(parseFloat);
                    break;
                case 'F':
                    const feedSplit = subSplit[1].split(',').map(parseFloat);
                    res.feedCurrent = feedSplit[0];
                    res.feedTarget = feedSplit[1];
                    break;
                case 'S':
                    const spindleSplit = subSplit[1].split(',').map(parseFloat);
                    res.spindleCurrent = spindleSplit[0];
                    res.spindleTarget = spindleSplit[1];
                    res.spindleTemp = spindleSplit[4];
                    break;
                case 'L':
                    const laserSplit = subSplit[1].split(',').map(parseFloat);
                    res.laserTesting = laserSplit[2] !== 0;
                    break;
            }
        }

        return res;
    }
}

export class ProxyProvider extends EventEmitter {
    private server?: Server;
    private client?: Socket;

    private deviceDataBuffer: string = '';
 
    private lastStatusReportTime: number = 0;
    
    private timer: NodeJS.Timeout;

    public constructor(private target: ProxyTarget, private port: number, private ip: string) {
        super();
        this.deviceDataHandler = this.deviceDataHandler.bind(this);
        // When there is no client connect, periodically send our own status requests.
        this.timer = setInterval(() => {
            if (this.client === undefined) {
                this.inject('?');
            }
        }, 500);
    }

    public isBusy() {
        return this.client !== undefined;
    }

    public inject(command: string) {
        this.target.send(Buffer.from(command));
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
            console.error(err);
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
        this.deviceDataBuffer += data.toString('utf-8');
        this.deviceDataBuffer = this.deviceDataBuffer.slice(-160); // long enough for a status report
        const status = StatusReport.extractLast(this.deviceDataBuffer);
        if (status) {
            this.lastStatusReportTime = Date.now();
            console.debug(status);
            this.emit('status', status);
        }
    }

    public stop() {
        if (this.server) {
            this.server.close();
            this.server = undefined;
        }
        if (this.client) {
            this.client.end();
            this.client = undefined;
        }
        this.target.unregister(this.deviceDataHandler);
    }

    public start() {
        this.stop();
        this.server = new Server();
        this.server.listen(this.port, this.ip);
        this.server.on('connection', (socket) => {
            this.clientHandler(socket);
        });
        this.target.register(this.deviceDataHandler);
    }
}
