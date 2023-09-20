import { createSocket } from 'node:dgram';

export interface BusyHandler {
    isBusy(): boolean;
}

export class DiscoveryProvider {
    private timer?: NodeJS.Timeout;

    public constructor(public machine: string, public ip: string, public port: number, private busyHandler?: BusyHandler) {

    }

    public send() {
        const msg = `${this.machine},${this.ip},${this.port},${this.busyHandler?.isBusy() ? '1' : '0'}`;
        const socket = createSocket('udp4');
        socket.send(msg, 3333, '127.0.0.1');
    }

    public stop() {
        if (this.timer !== undefined) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
    }

    public start() {
        this.stop();
        this.timer = setInterval(() => {
            this.send();
        }, 1000);
    }
}
