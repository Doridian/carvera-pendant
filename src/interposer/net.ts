import { networkInterfaces } from 'node:os';
import { Netmask } from 'netmask';

class NetworkInterface {
    // IPv4-only
    public constructor(
        public readonly ipv4: string,
        public readonly broadcast_addr: string,
    ) {}
}

export function getNetworkInterfaces(): NetworkInterface[] {
    const ret: NetworkInterface[] = [];
    for (const netifs of Object.values(networkInterfaces())) {
        for (const netif of netifs ?? []) {
            if (netif.family !== 'IPv4' || !netif.cidr) {
                continue;
            }

            ret.push(new NetworkInterface(netif.address, new Netmask(netif.cidr).broadcast));
        }
    }

    return ret;
}

export function getNetworkAddresses(): string[] {
    return getNetworkInterfaces().map((netif) => netif.ipv4);
}
