// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class Config {
    public static readonly ADVERTISED_NAME = 'Pendant';

    // On Windows this might be 'COM3', on Linux '/dev/ttyUSB0' etc
    public static readonly CARVERA_SERIAL_PORT = '';

    public static readonly CARVERA_HOST_NAME = '';
    public static readonly CARVERA_PORT = 2222;

    // If specified, listen on one interface (otherwise listen on all).
    public static readonly PROXY_IP = '';
    public static readonly PROXY_PORT = 9999;

    public static readonly DEBUG_LOGGING = false;
}
