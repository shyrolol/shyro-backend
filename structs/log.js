const fs = require("fs");
const config = JSON.parse(fs.readFileSync("./Config/config.json").toString());

function getTimestamp() {
    const now = new Date();
    const date = now.toLocaleDateString('en-US');
    const time = now.toLocaleTimeString();
    
    return `${date} ${time}`; 
}

function formatLog(prefixColor, prefix, ...args) {
    let msg = args.join(" ");
    let formattedMessage = `${prefixColor}[${getTimestamp()}] ${prefix}\x1b[0m: ${msg}`;
    console.log(formattedMessage);
}

function backend(...args) {
    let msg = args.join(" ");
    if (config.bEnableFormattedLogs) {
        formatLog("\x1b[32m", "Backend", ...args);
    } else {
        console.log(`\x1b[32m[BACKEND]\x1b[0m: ${msg}`);
    }
}

function matchmaker(...args) {
    let msg = args.join(" ");
    if (config.bEnableFormattedLogs) {
        formatLog("\x1b[36m", "Matchmaker", ...args);
    } else {
        console.log(`\x1b[36m[MATCHMAKER]\x1b[0m: ${msg}`);
    }
}

function bot(...args) {
    let msg = args.join(" ");
    if (config.bEnableFormattedLogs) {
        formatLog("\x1b[33m", "Bot", ...args);
    } else {
        console.log(`\x1b[33m[BOT]\x1b[0m: ${msg}`);
    }
}

function xmpp(...args) {
    let msg = args.join(" ");
    if (config.bEnableFormattedLogs) {
        formatLog("\x1b[34m", "Xmpp", ...args);
    } else {
        console.log(`\x1b[34m[XMPP]\x1b[0m: ${msg}`);
    }
}

function error(...args) {
    let msg = args.join(" ");
    if (config.bEnableFormattedLogs) {
        formatLog("\x1b[31m", "Error", ...args);
    } else {
        console.log(`\x1b[31m[ERROR]\x1b[0m: ${msg}`);
    }
}

function debug(...args) {
    if (config.bEnableDebugLogs) {
        let msg = args.join(" ");
        if (config.bEnableFormattedLogs) {
            formatLog("\x1b[35m", "Debug", ...args);
        } else {
            console.log(`\x1b[35m[DEBUG]\x1b[0m: ${msg}`);
        }
    }
}

function AutoRotation(...args) {
    if (config.bEnableAutoRotateDebugLogs) {
        let msg = args.join(" ");
        if (config.bEnableFormattedLogs) {
            formatLog("\x1b[36m", "AutoRotation Debug", ...args);
        } else {
            console.log(`\x1b[36m[SHOP]\x1b[0m: ${msg}`);
        }
    }
}

function autobackendrestart(...args) {
    let msg = args.join(" ");
    if (config.bEnableFormattedLogs) {
        formatLog("\x1b[92m", "Auto Backend Restart", ...args);
    } else {
        console.log(`\x1b[92m[RESTART]\x1b[0m: ${msg}`);
    }
}

function calderaservice(...args) {
    let msg = args.join(" ");
    if (config.bEnableFormattedLogs) {
        formatLog("\x1b[91m", "Caldera Service", ...args);
    } else {
        console.log(`\x1b[91m[CALDERA]\x1b[0m: ${msg}`);
    }
}

module.exports = {
    backend,
    bot,
    xmpp,
    error,
    debug,
    AutoRotation,
    autobackendrestart,
    calderaservice,
    matchmaker
};