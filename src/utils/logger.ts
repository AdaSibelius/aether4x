type LogChannel = 'ECONOMY' | 'POPULATION' | 'FLEETS' | 'RESEARCH' | 'SYSTEM' | 'FINANCE' | 'CORPORATION' | 'TRADE' | 'MIGRATION' | 'LABOR';
type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

class SimLogger {
    private static isTraceEnabled = false;

    static setTrace(enabled: boolean) {
        this.isTraceEnabled = enabled;
        console.log(`[SimLogger] Trace mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    }

    static log(channel: LogChannel, level: LogLevel, message: string, data?: any) {
        if (!this.isTraceEnabled && level === 'DEBUG') return;

        const timestamp = new Date().toISOString().split('T')[1].split('Z')[0];
        const prefix = `[${timestamp}] [${channel}] [${level}]`;

        switch (level) {
            case 'ERROR':
                console.error(prefix, message, data || '');
                break;
            case 'WARN':
                console.warn(prefix, message, data || '');
                break;
            default:
                console.log(prefix, message, data || '');
        }
    }

    static debug(channel: LogChannel, message: string, data?: any) {
        this.log(channel, 'DEBUG', message, data);
    }

    static info(channel: LogChannel, message: string, data?: any) {
        this.log(channel, 'INFO', message, data);
    }

    static warn(channel: LogChannel, message: string, data?: any) {
        this.log(channel, 'WARN', message, data);
    }

    static error(channel: LogChannel, message: string, data?: any) {
        this.log(channel, 'ERROR', message, data);
    }
}

export default SimLogger;
