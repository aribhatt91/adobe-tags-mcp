let Logger: any = null;

if(process.env.NODE_ENV === 'development') {
    Logger = {
        log: console.log,
        info: console.info,
        error: console.error,
        debug: console.debug,
        warn: console.warn
    }
}

export default Logger;