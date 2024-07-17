import { createLogger, format, transports } from 'winston';
import { Config } from './config';

export const logger = createLogger({
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    level: Config.DEBUG_LOGGING ? 'debug' : 'info',
    transports: [new transports.Console()],
    format: format.combine(
        format.colorize(),
        format.timestamp(),
        format.printf(({ timestamp, level, message }) => {
            return `[${timestamp}] ${level}: ${message}`;
        }),
    ),
});
