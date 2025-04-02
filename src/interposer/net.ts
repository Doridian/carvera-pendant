import { networkInterfaces } from 'node:os';
class NetworkInterface {
    public readonly broadcast: string;
    public readonly cidrSegments: number[];

    // IPv4-only
    public constructor(
        public readonly ipv4: string,
        public readonly cidr: string,
    ) {
        const [addr, netmaskStr] = this.cidr.split('/');
        if (!addr || !netmaskStr) {
            throw new Error(`Invalid CIDR ${this.cidr}`);
        }

        const addrParts = addr.split('.').map((s) => Number.parseInt(s, 10));
        if (addrParts.length !== 4) {
            throw new Error(`Invalid CIDR ${this.cidr}`);
        }
        this.cidrSegments = addrParts;

        // eslint-disable-next-line no-bitwise, @typescript-eslint/no-non-null-assertion
        let addrInt = (addrParts[0]! << 24) | (addrParts[1]! << 16) | (addrParts[2]! << 8) | addrParts[3]!;
        const netmask = Number.parseInt(netmaskStr, 10);

        // eslint-disable-next-line no-bitwise
        addrInt |= 0xff_ff_ff_ff & ((1 << (32 - netmask)) - 1);

        // eslint-disable-next-line no-bitwise
        this.broadcast = `${(addrInt >> 24) & 0xff}.${(addrInt >> 16) & 0xff}.${(addrInt >> 8) & 0xff}.${addrInt & 0xff}`;
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
