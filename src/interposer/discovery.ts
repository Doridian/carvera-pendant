import { createSocket } from 'node:dgram';
import { logger } from '../log';
import { getNetworkInterfaces } from './net';

interface BusyHandler {
    isBusy(): boolean;
}

export class DiscoveryProvider {
    private timer?: NodeJS.Timeout;

    public constructor(
        public machine: string,
        public ip: string,
        public port: number,
        private readonly busyHandler?: BusyHandler,
    ) {}

    public send(): void {
        for (const netif of getNetworkInterfaces()) {
            if (!this.ip || netif.ipv4 === this.ip) {
                const msg = `${this.machine},${netif.ipv4},${this.port},${this.busyHandler?.isBusy() ? '1' : '0'}`;
                const dstAddr = netif.cidrSegments[0] === 127 ? '127.0.0.1' : netif.broadcast;

                const socket = createSocket('udp4');
                socket.send(msg, 3333, dstAddr, () => {
                    socket.close();
                });

                logger.debug(`bcast to ${dstAddr}: ${msg}`);
            }
        }
    }

    public stop(): void {
        if (this.timer !== undefined) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
    }

    public start(): void {
        this.stop();
        this.timer = setInterval(() => {
            this.send();
        }, 1000);
    }
}
