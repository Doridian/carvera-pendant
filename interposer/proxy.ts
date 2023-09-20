import EventEmitter from 'node:events';
import { Server, Socket } from 'node:net';
import { SerialPort } from 'serialport';

export interface ProxyTarget {
    send(data: Buffer): void;
    register(handler: (data: Buffer) => void): void;
    unregister(handler: (data: Buffer) => void): void;
}

export class SerialProxyTarget {
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

    public static parse(data: string): StatusReport {
        const res = new StatusReport();

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
            }
        }

        return res;
    }
}

export class ProxyProvider extends EventEmitter {
    private server?: Server;
    private client?: Socket;

    private lastCommandQuestion: boolean = false;
    private questionBuffer: string = '';

    public constructor(private target: ProxyTarget, private port: number, private ip: string = '127.0.0.1') {
        super();
        this.deviceDataHandler = this.deviceDataHandler.bind(this);
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
        this.lastCommandQuestion = false;

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

        this.lastCommandQuestion = (data.byteLength === 1 && data[0] === 0x3F /* ? */);
        this.questionBuffer = '';
    }

    private deviceDataHandler(data: Buffer) {
        this.client?.write(data);

        if (this.lastCommandQuestion) {
            this.questionBuffer += data.toString('utf-8');
            const qStart = this.questionBuffer.indexOf('<');
            const qEnd = this.questionBuffer.indexOf('>');
            if (qStart !== -1 && qEnd !== -1) {
                const qAnswer = this.questionBuffer.substring(qStart + 1, qEnd);
                
                const parsedAnswer = StatusReport.parse(qAnswer);
                this.emit('status', parsedAnswer);

                this.questionBuffer = '';
            }
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
