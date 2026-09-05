import type { LogLevel } from './env.js';

type LogContext = Record<string, unknown>;

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

// Structured logs, on stderr, always.
//
// stdout is the MCP transport: it carries JSON-RPC framing and nothing else. A
// stray `console.log` corrupts the stream, and the failure mode is not a
// readable error - the client sees a malformed message or a server that appears
// to hang. Writing to `process.stderr` directly rather than through `console`
// keeps that from happening by accident.
export interface Logger {
  debug: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, context?: LogContext) => void;
}

export function createLogger(minimumLevel: LogLevel): Logger {
  function write(level: LogLevel, message: string, context: LogContext = {}) {
    if (levelPriority[level] < levelPriority[minimumLevel]) return;

    process.stderr.write(
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        message,
        ...context,
      })}\n`,
    );
  }

  return {
    debug: (message, context) => write('debug', message, context),
    info: (message, context) => write('info', message, context),
    warn: (message, context) => write('warn', message, context),
    error: (message, context) => write('error', message, context),
  };
}
