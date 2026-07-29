export const logger = {
  info(message: string, data?: Record<string, unknown>): void {
    console.log(
      JSON.stringify({ level: 'INFO', message, ...data, timestamp: new Date().toISOString() }),
    );
  },
  error(message: string, err?: unknown): void {
    console.error(
      JSON.stringify({
        level: 'ERROR',
        message,
        error: err instanceof Error ? { name: err.name, message: err.message } : String(err),
        timestamp: new Date().toISOString(),
      }),
    );
  },
};
