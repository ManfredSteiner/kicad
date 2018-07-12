
interface IModbusConfig {
    device:   string;
    baudrate: number;
}

import * as SerialPort from 'serialport';
import { sprintf } from 'sprintf-js';
import { ModbusFrame } from './modbus-frame';
import { FroniusMeter } from '../devices/fronius-meter';

import * as debugsx from 'debug-sx';
const debug: debugsx.IDefaultLogger = debugsx.createDefaultLogger('modbus:Modbus');




export class Modbus {

    private _config: IModbusConfig;
    private _serialPort: SerialPort;
    private _openPromise: { resolve: () => void, reject: (err: Error) => void};
    private _monitor: NodeJS.Timer;
    private _status: { receivedByteCount: number, requestCount: number, responseCount: number, errorCnt: number, signalProblemCnt: number };
    private _frame = '';
    private _lastRequest: ModbusFrame;

    public constructor (config: IModbusConfig) {
        this._config = config;
        this._status = {
            receivedByteCount: 0,
            requestCount: 0,
            responseCount: 0,
            errorCnt: 0,
            signalProblemCnt: 0
        };
    }

    public async open () {
        if (this._openPromise) {
            return Promise.reject(new Error('open already called, execute close() first.'));
        }
        const rv: Promise<void> = new Promise<void>( (resolve, reject) => {
            this._serialPort = new SerialPort(this._config.device, {
                baudRate: this._config.baudrate,
                autoOpen: false
            });
            // this._serialPort.on('open', this.handleOnSerialOpen.bind(this));
            this._serialPort.on('error', this.handleOnSerialError.bind(this));
            this._serialPort.on('data', this.handleOnSerialData.bind(this));
            this._openPromise = { resolve: resolve, reject: reject };
            this._serialPort.open( (err) => {
                if (!this._openPromise || !this._openPromise.resolve) { return; }
                if (err) {
                    debug.warn('cannot open serial port ' + this._config.device);
                    this._openPromise.reject(err);
                } else {
                    debug.info('serial port ' + this._config.device + ' opened (' + this._config.baudrate + 'bps)');
                    this._openPromise.resolve();
                    this._monitor = setInterval(() => this.handleMonitorIntervalEvent(), 5000);
                }
                this._openPromise = null;
            });
        });
        return rv;
    }

    public async close () {
        if (this._monitor) {
            clearInterval(this._monitor);
            this._monitor = null;
        }
        if (!this._serialPort || !this._serialPort.isOpen) {
            return Promise.reject(new Error('serial port not open'));
        }
        if (this._openPromise && this._openPromise.reject) {
            this._openPromise.reject(new Error('serial port closed while opening pending'));
        }
        this._openPromise = null;
        try {
            await this._serialPort.close();
            debug.info('serial port ' + this._config.device + ' closed');
        } catch (err) {
            debug.info('cannot close serial port ' + this._config.device, err);
        }
    }

    private handleOnSerialOpen () {
        debug.info('serial port ' + this._config.device + ' opened');
        if (this._openPromise && this._openPromise.resolve) {
            this._openPromise.resolve();
            this._openPromise.resolve = null;
            this._openPromise.reject = null;
        }
    }

    private handleOnSerialError (err: any) {
        debug.warn(err);
    }

    private handleOnSerialData (data: Buffer) {

        if (!(data instanceof Buffer)) {
            debug.warn('serial input not as expected...');
            return;
        }

        try {
            this._status.receivedByteCount += data.length;

                //         // console.log('Buffer with ' + data.length + ' Bytes received');
            for (const b of data.values()) {
                if (b === 10) {
                    let modbusFrame: ModbusFrame; // = new ModbusFrame(this._frame);
                    if (this._frame.startsWith('0103')) {
                        switch (this._frame.length) {
                            case 16: case 18: {
                                if (this._frame.length === 16) {
                                    modbusFrame = new ModbusFrame(this._frame);
                                } else {
                                    modbusFrame = new ModbusFrame(this._frame, 16);
                                    debug.warn('Modbus request function code 03 for address 01, bus signal problem detected');
                                    this._status.signalProblemCnt++;
                                }
                                if (modbusFrame.ok) {
                                    debug.fine('Modbus request function code 03 for address 01');
                                    this._status.requestCount++;
                                    this._lastRequest = modbusFrame;
                                } else if (!modbusFrame.crcOk) {
                                    debug.warn('CRC Error: modbus request function code 03 for address 01');
                                    this._status.errorCnt++;
                                } else {
                                    debug.warn('Error: modbus request function code 03 for address 01\n%e', modbusFrame.error);
                                    this._status.errorCnt++;
                                }
                                break;
                            }

                            case 246: case 248: {
                                if (this._frame.length === 246) {
                                    modbusFrame = new ModbusFrame(this._frame);

                                } else {
                                    modbusFrame = new ModbusFrame(this._frame, 246);
                                    debug.warn('Modbus response function code 03 from address 01, bus signal problem detected');
                                    this._status.signalProblemCnt++;
                                }
                                if (modbusFrame.ok) {
                                    debug.fine('Modbus response function code 03 from address 01');
                                    this._status.responseCount++;
                                    if (this._lastRequest instanceof ModbusFrame) {
                                        if (this._lastRequest.address === modbusFrame.address &&
                                            this._lastRequest.funcCode === modbusFrame.funcCode) {
                                            const fm = FroniusMeter.getInstance(modbusFrame.address);
                                            if (!fm) {
                                                debug.warn('Response from unknown FroniusMeter');
                                            } else {
                                                fm.handleResponse(this._lastRequest, modbusFrame);
                                            }
                                        } else {
                                            debug.warn('unexpected modbus response');
                                        }
                                    }
                                } else if (!modbusFrame.crcOk) {
                                    debug.warn('CRC Error: modbus response function code 03 from address 01');
                                    this._status.errorCnt++;
                                } else {
                                    debug.warn('Error: modbus response function code 03 for address 01\n%e', modbusFrame.error);
                                    this._status.errorCnt++;
                                }
                                this._lastRequest = null;
                                break;
                            }


                            default: {
                                debug.warn('invalid frame received\n%s', this._frame);
                                this._status.errorCnt++;
                            }
                        }
                    }
                    this._frame = '';
                } else if (b !== 13) {
                    this._frame = this._frame + String.fromCharCode(b);
                }
            }
        } catch (err) {
            debug.warn(err);
        }
    }

    private handleMonitorIntervalEvent () {
        debug.info('Modbus-Monitor: %o', this._status);
    }

}
