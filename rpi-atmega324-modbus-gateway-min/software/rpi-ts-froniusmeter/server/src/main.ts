
export const VERSION = '0.6.0';

import * as nconf from 'nconf';
import * as fs from 'fs';
import * as path from 'path';

import * as git from './utils/git';

process.on('unhandledRejection', (reason, p) => {
    debugger;
    const now = new Date();
    console.log(now.toLocaleDateString() + '/' + now.toLocaleTimeString() + ': unhandled rejection at: Promise', p, 'reason:', reason);
});



// ***********************************************************
// configuration, logging
// ***********************************************************

nconf.argv().env();
const configFilename = path.join(__dirname, '../config.json');
try {
    fs.accessSync(configFilename, fs.constants.R_OK);
    nconf.file(configFilename);
} catch (err) {
    console.log('Error on config file ' + configFilename + '\n' + err);
    process.exit(1);
}

let debugConfig: any = nconf.get('debug');
if (!debugConfig) {
    debugConfig = { enabled: '*::*' };
}
for (const a in debugConfig) {
    if (debugConfig.hasOwnProperty(a)) {
        const name: string = (a === 'enabled') ? 'DEBUG' : 'DEBUG_' + a.toUpperCase();
        if (!process.env[name] && (debugConfig[a] !== undefined || debugConfig[a] !== undefined)) {
            process.env[name] = debugConfig[a] ? debugConfig[a] : debugConfig[a];
        }
    }
}

// logging with debug-sx/debug
import * as debugsx from 'debug-sx';
const debug: debugsx.ISimpleLogger = debugsx.createSimpleLogger('main');

debugsx.addHandler(debugsx.createConsoleHandler('stdout'));
const logfileConfig = nconf.get('logfile');
if (logfileConfig) {
    for (const att in logfileConfig) {
        if (!logfileConfig.hasOwnProperty(att)) { continue; }
        const logHandlerConfig = logfileConfig[att];
        if (logHandlerConfig.disabled) { continue; }
        const h = debugsx.createFileHandler( logHandlerConfig);
        console.log('Logging ' + att + ' to ' + logHandlerConfig.filename);
        debugsx.addHandler(h);
    }
}


// ***********************************************************
// startup of application
//   ... things to do before server can be started
// ***********************************************************

import * as SerialPort from 'serialport';
import { sprintf } from 'sprintf-js';
// import { ModbusCrc } from './modbus/modbus-crc';
import { Server } from './server';
import { PiTechnik } from './devices/pi-technik';
import { ModbusDevice } from './devices/modbus-device';
import { ModbusRtu } from './modbus/modbus-rtu';
import { ModbusTcp } from './modbus/modbus-tcp';
import { FroniusMeter, IFroniusMeterValues } from './devices/fronius-meter';
import { FroniusDevice14, IFroniusDevice14Values } from './devices/fronius-device14';
import { FroniusSymo } from './devices/fronius-symo';
import { Monitor } from './monitor';

let modbusRtu: ModbusRtu;
let modbusTcp: ModbusTcp;
let froniusSymo: FroniusSymo;
let piTechnik: PiTechnik;
let monitor: Monitor;

doStartup();

async function doStartup () {
    debug.info('Start of program V' + VERSION);
    try {
        if (nconf.get('git')) {
            const gitInfo = await git.getGitInfo();
            startupPrintVersion(gitInfo);
        }
        modbusRtu = new ModbusRtu(nconf.get('modbus'));
        modbusTcp = new ModbusTcp(nconf.get('froniusSymo'));
        monitor = Monitor.Instance;
        piTechnik = await PiTechnik.initInstance(nconf.get('pi-technik'));

        const fm = new FroniusMeter(modbusRtu, 1);
        fm.on('update', appendToHistoryFile);
        ModbusDevice.addInstance(fm);
        ModbusDevice.addInstance(new FroniusDevice14(modbusRtu, 0x14));

        await startupParallel();
        await startupServer();
        await monitor.start();
        doSomeTests();
        process.on('SIGINT', () => {
            console.log('...caught interrupt signal');
            shutdown('interrupt signal (CTRL + C)').catch( (err) => {
                console.log(err);
                process.exit(1);
            });
        });
        debug.info('startup finished, enter now normal running mode.');

    } catch (err) {
        console.log(err);
        console.log('-----------------------------------------');
        console.log('Error: exit program');
        process.exit(1);
    }
}

// setTimeout( () => { modbus.close(); }, 5000);

// ***********************************************************
// startup and shutdown functions
// ***********************************************************

async function shutdown (src: string): Promise<void> {
    debug.info('starting shutdown ... (caused by %s)', src || '?');
    const shutdownMillis = +nconf.get('shutdownMillis');
    const timer = setTimeout( () => {
        console.log('Some jobs hanging? End program with exit code 1!');
        process.exit(1);
    }, shutdownMillis > 0 ? shutdownMillis : 500);
    let rv = 0;
    try { await modbusRtu.close(); } catch (err) { rv++; console.log(err); }
    try { await modbusTcp.stop(); } catch (err) { rv++; console.log(err); }
    try { await froniusSymo.stop(); } catch (err) { rv++; console.log(err); }
    // await new Promise<void>( (resolve, reject) => { setTimeout(() => { resolve(); }, 2000); } );
    clearTimeout(timer);
    process.exit(rv);
}

function startupPrintVersion (info?: git.GitInfo) {
    console.log('main.ts Version ' + VERSION);
    if (info) {
        console.log('GIT: ' + info.branch + ' (' + info.hash + ')');
        const cnt = info.modified.length;
        console.log('     ' + (cnt === 0 ? 'No files modified' : cnt + ' files modified'));
    }
}

async function startupParallel (): Promise<any []> {
    const rv: Promise<any> [] = [ modbusRtu.open(), modbusTcp.start() ];
    for (const p of rv) {
        await p;
    }
    froniusSymo = new FroniusSymo(modbusTcp, 1);
    ModbusDevice.addInstance(froniusSymo);
    await froniusSymo.start();
    debug.info('startupParallel finished');
    return rv;
}

async function startupServer (): Promise<void> {
    const configServer = nconf.get('server');
    if (configServer && configServer.start) {
        await Server.Instance.start();
    }
}

async function startupShutdown (src?: string): Promise<void> {
    const shutdownMillis = +nconf.get('shutdownMillis');
    if (shutdownMillis > 0) {
        setTimeout( () => {
            shutdown(src ? src : 'startupShutdown').then( () => {
                console.log('shutdown successful');
                process.exit(0);
            }).catch( err => {
                console.log(err);
                console.log('shutdown fails');
                process.exit(1);
            });
        }, shutdownMillis);
        debug.info('startupShutdown finished, shutdown in ' + (shutdownMillis / 1000) + ' seconds.');
    }
}

async function doSomeTests () {
    return;
}


function appendToHistoryFile (v: IFroniusMeterValues) {
    const ts = v.lastUpdateAt;
    const filename = sprintf('/var/log/fronius/%04d-%02d-%02d_fronius.csv', ts.getFullYear(), ts.getMonth() + 1, ts.getDate());
        let s = '';
        let t = '"Time"';      s = '"' + ts.toLocaleTimeString() + '"';
        t += ',"E-in/kWh"';    s += sprintf(',"%8.03f"', v.activeEnergy / 1000);
        t += ',"E-out/kWh"';   s += sprintf(',"%8.03f"', v.activeFeedEnergy / 1000);
        t += ',"f/Hz"';        s += sprintf(',"%4.01f"', v.frequency);
        t += ',"P/W"';         s += sprintf(',"%7.02f"', v.activePower);
        t += ',"Q/var"';       s += sprintf(',"%6.02f"', v.reactivePower);
        t += ',"S/VA"';        s += sprintf(',"%7.02f"', v.apparentPower);
        t += ',"Q-in/kvarh"';  s += sprintf(',"%8.03f"', v.reactiveEnergy / 1000);
        t += ',"Q-out/kvarh"'; s += sprintf(',"%8.03f"', v.reactiveFeedEnergy / 1000);
        t += ',"P1/W"';        s += sprintf(',"%8.02f"', v.activePowerL1);
        t += ',"P2/W"';        s += sprintf(',"%8.02f"', v.activePowerL2);
        t += ',"P3/W"';        s += sprintf(',"%8.02f"', v.activePowerL3);

        if (!fs.existsSync(filename)) {
            fs.writeFileSync(filename, t + '\n');
        }

        s = s.replace(/\./g, ',');
        fs.appendFileSync(filename, s + '\n');
}
