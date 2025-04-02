import { networkInterfaces } from 'node:os';

class NetworkInterface {
    public readonly cidrSegments: number[];
    public readonly netmask: number;

    // IPv4-only
    public constructor(
        public readonly ipv4: string,
        public readonly cidr: string,
    ) {
        const [addr, netmaskStr] = this.cidr.split('/');
        if (!addr || !netmaskStr) {
            throw new Error(`Invalid CIDR ${this.cidr}`);
        }

        this.netmask = Number.parseInt(netmaskStr, 10);
        if (this.netmask < 0 || this.netmask > 32) {
            throw new Error(`Invalid CIDR ${this.cidr}`);
        }

        const addrParts = addr.split('.').map((s) => Number.parseInt(s, 10));
        if (addrParts.length !== 4) {
            throw new Error(`Invalid CIDR ${this.cidr}`);
        }
        this.cidrSegments = addrParts;
    }

    public broadcast(): string {
        const segments = this.cidrSegments;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, no-bitwise
        let addrInt = (segments[0]! << 24) | (segments[1]! << 16) | (segments[2]! << 8) | segments[3]!;
        // eslint-disable-next-line no-bitwise
        addrInt |= 0xff_ff_ff_ff & ((1 << (32 - this.netmask)) - 1);
        // eslint-disable-next-line no-bitwise
        return `${(addrInt >> 24) & 0xff}.${(addrInt >> 16) & 0xff}.${(addrInt >> 8) & 0xff}.${addrInt & 0xff}`;
    }
}

export function getNetworkInterfaces(): NetworkInterface[] {
    const ret: NetworkInterface[] = [];
    for (const netifs of Object.values(networkInterfaces())) {
        for (const netif of netifs ?? []) {
            if (netif.family !== 'IPv4' || !netif.cidr) {
                continue;
            }

            ret.push(new NetworkInterface(netif.address, netif.cidr));
        }
    }

    return ret;
}

export function getNetworkAddresses(): string[] {
    return getNetworkInterfaces().map((netif) => netif.ipv4);
}
