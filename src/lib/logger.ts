import fs from 'fs';
import path from 'path';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Create a write stream for the log file
const logStream = fs.createWriteStream(
  path.join(logsDir, `api-${new Date().toISOString().split('T')[0]}.log`),
  { flags: 'a' } // 'a' means append
);

type LogLevel = 'info' | 'error' | 'debug';

function formatLogMessage(
  level: LogLevel,
  message: string,
  data?: any
): string {
  const timestamp = new Date().toISOString();
  const dataString = data ? `\n${JSON.stringify(data, null, 2)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${dataString}\n`;
}

export function log(level: LogLevel, message: string, data?: any) {
  const formattedMessage = formatLogMessage(level, message, data);

  // Log to console
  if (level === 'error') {
    console.error('[Error] ' + formattedMessage);
  } else {
    console.log('[Info] ' + formattedMessage);
  }

  // Log to file
  logStream.write(formattedMessage);
}

// Convenience methods
export const logInfo = (message: string, data?: any) =>
  log('info', message, data);
export const logError = (message: string, data?: any) =>
  log('error', message, data);
export const logDebug = (message: string, data?: any) =>
  log('debug', message, data);

// Ensure the log stream is properly closed when the process exits
process.on('beforeExit', () => {
  logStream.end();
});
