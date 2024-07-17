import { createLogger, transports, format } from "winston";
import { Config } from "./config";

export const logger = createLogger({
    level: Config.DEBUG_LOGGING ? 'debug' : 'info',
    transports: [new transports.Console()],
    format: format.combine(
      format.colorize(),
      format.timestamp(),
      format.printf(({ timestamp, level, message }) => {
        return `[${timestamp}] ${level}: ${message}`;
      })
    ),
  });
  