// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class Config {
    /*
     * Note that all of these can be defined as the equivalently named
     * environment variables or you can change the values here directly by
     * replacing everyhing between the = and ; with your value
     */

    public static readonly ADVERTISED_NAME: string = process.env.ADVERTISED_NAME ?? 'Pendant';

    // On Windows this might be 'COM3', on Linux '/dev/ttyUSB0' etc
    public static readonly CARVERA_SERIAL_PORT: string = process.env.CARVERA_SERIAL_PORT ?? '';

    public static readonly CARVERA_HOST_NAME: string = process.env.CARVERA_HOST_NAME ?? '';
    public static readonly CARVERA_PORT: number = Number.parseInt(process.env.CARVERA_PORT ?? '2222', 10);

    // If specified, listen on one interface (otherwise listen on all).
    public static readonly PROXY_IP: string = process.env.PROXY_IP ?? '127.0.0.1';
    public static readonly PROXY_PORT: number = Number.parseInt(process.env.PROXY_PORT ?? '9999', 10);

    public static readonly LOG_LEVEL: string = process.env.LOG_LEVEL ?? 'info';
}
