import { createSocket } from 'node:dgram';
import { getNetworkInterfaces } from './net';

export interface BusyHandler {
    isBusy(): boolean;
}

export class DiscoveryProvider {
    private timer?: NodeJS.Timeout;

    public constructor(public machine: string, public ip: string, public port: number, private busyHandler?: BusyHandler) {
    }

    public send() {
        for (const netif of getNetworkInterfaces()) {
            if (!this.ip || netif.ipv4 == this.ip) {
                const msg = `${this.machine},${netif.ipv4},${this.port},${this.busyHandler?.isBusy() ? '1' : '0'}`;
                const socket = createSocket('udp4');
                socket.send(msg, 3333, netif.broadcast_addr, () => {
                    socket.close();
                });
                console.debug(`bcast to ${netif.broadcast_addr}: ${msg}`);
            }
        }
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
