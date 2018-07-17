
import * as net from 'net';

import { sprintf } from 'sprintf-js';


export interface IModbusTcpConfig {
    host:   string;
    port: number;
}


import * as debugsx from 'debug-sx';
const debug: debugsx.IDefaultLogger = debugsx.createDefaultLogger('modbus:ModbusTCP');


export class ModbusTcp {

    private _config: IModbusTcpConfig;
    private _socket: net.Socket;
    private _tID = 0;
    private _pendingRequests: ModbusTcpTransactionFactory [] = [];
    private _responseFactory: ModbusTcpResponseFactory;

    public constructor (config: IModbusTcpConfig) {
        this._config = config;
    }

    public get host (): string {
        return this._config.host;
    }

    public get port (): number {
        return this._config.port;
    }

    public async start () {
        this._socket = new net.Socket();
        this._socket.on('data', (data) => this.handleData(data));
        this._socket.on('end', () => this.handleEnd());
        this._socket.on('error', (err) => this.handleError(err));
        this._socket.on('close', () => this.handleClose());
        this._socket.connect(this._config.port, this._config.host, () => {
            debug.info('ModbusTCP socket opened');
            this.refresh();
        });
    }

    public async stop () {
        if (this._socket) {
            this._socket.destroy();
        }
    }

    private handleData (data: Buffer) {
        debug.info('receive %o', data);
        let length = data.length;
        while (length > 0) {
            if (!this._responseFactory) {
                this._responseFactory = new ModbusTcpResponseFactory();
            }
            length -= this._responseFactory.add(data);
            if (this._responseFactory.isComplete) {
                const prIndex = this._pendingRequests.findIndex ( (x) => x.transactionId === this._responseFactory.transactionId );
                if (prIndex < 0) {
                    debug.warn('missing pending request for ModbusTCP response');
                } else {
                    const pr = this._pendingRequests.splice(prIndex, 1)[0];
                    const resp = this._responseFactory;
                    this._responseFactory = null;
                    pr.final(resp);
                }
            }
        }

        // const buffer = new ArrayBuffer(12);
        // const bytes = new Uint8Array(buffer);
        // for (let i = 0; i < 12; i++) {
        //     bytes[i] = data[i + 9 + 12];
        // }
        // const v1 = new DataView(buffer, 0, 4);
        // const v2 = new DataView(buffer, 4, 4);
        // const v3 = new DataView(buffer, 8, 4);
        // console.log(bytes, v1.getFloat32(0, false), v2.getFloat32(0, false), v3.getFloat32(0, false));
    }

    private handleClose () {
        debug.info('socket closed');
        this._socket = null;
    }

    private handleEnd () {
        debug.info('socket end');
    }

    private handleError (error: Error) {
        debug.info('socket error\n%e', error);
    }

    private refresh () {
        // const b = Buffer.alloc(12, 0);
        // b[0] = 0x00; // transction ID
        // b[1] = 0x01;
        // b[2] = 0;    // protocol id
        // b[3] = 0;
        // b[4] = 0;    // length in bytes, starting by Unit ID
        // b[5] = 6;
        // b[6] = 1;  // Unit-ID
        // b[7] = 0x03; // function Code
        // b[8] = (499 >> 8);    // register address
        // b[9] = (499 & 0xff);
        // b[10] = 0;   // quantity
        // b[11] = 14;

        // debug.info('send %o', b);
        // this._socket.write(b);
        // this.readHoldRegisters(1, 40001, 69).then( (x) => {
        //     debug.info('refresh response received');
        // }).catch( (err) => {
        //     debug.warn('refresh failed');
        // });
    }

    /* tslint:disable */
    public async readHoldRegisters (devId: number, addr: number, quantity: number): Promise<ModbusTransaction> {
        const transactionId = this._tID;
        this._tID = (this._tID + 1) & 0xffff;
        
        const b = Buffer.alloc(12, 0);
        b[0] = (transactionId >> 8) & 0xff;
        b[1] = transactionId & 0xff;
        b[5] = 6;            // length
        b[6] = devId & 0xff; // Unit-ID
        b[7] = 0x03;         // function Code
        b[8] = ((addr - 1) >> 8) & 0xff;
        b[9] = (addr - 1) & 0xff;
        b[10] = (quantity >> 8) & 0xff;
        b[11] = quantity & 0xff;
        debug.info('Read %d Hold registers from devId/addr=%d/%d\nsending: %o', quantity, devId, addr, b);
        const mt = new ModbusTcpTransactionFactory();
        this._pendingRequests.push(mt);
        return mt.send(this._socket, b)
    }
    /* tslint:enable */

}

export class ModbusTransaction {
    protected _request: ModbusTcpRequest;
    protected _response: ModbusTcpResponse;
    protected _error: Error;
    protected _resolve: (result: ModbusTransaction) => void;
    protected _reject: (error: ModbusTcpTransactionError) => void;

    public constructor () {
    }

    public get request (): ModbusTcpRequest {
        return this._request;
    }

    public get response (): ModbusTcpResponse {
        return this._response;
    }

    public get transactionId (): number {
        return this._request.transactionId;
    }

    public get isSent (): boolean {
        return this._response !== undefined || this._resolve !== undefined;
    }

    public get isPending (): boolean {
        return this._request !== undefined && (this._response === undefined && this._error === undefined);
    }

    public get error (): Error {
        return this._error;
    }

    public getRegisterAsUint16 (address: number): number {
        if (!this._request || !this._response) { throw new Error('request/response not available'); }
        if (this.request.pdu[0] !== 3) { throw new Error('invalid function code'); }
        const start = this.request.pduUint16(1) + 1;
        return this.response.pduUint16(2 + 2 * (address - start));
    }

    public getRegisterAsInt16 (address: number): number {
        if (!this._request || !this._response) { throw new Error('request/response not available'); }
        if (this.request.pdu[0] !== 3) { throw new Error('invalid function code'); }
        const start = this.request.pduUint16(1) + 1;
        return this.response.pduInt16(2 + 2 * (address - start));
    }

    public getRegisterAsUint32 (address: number): number {
        if (!this._request || !this._response) { throw new Error('request/response not available'); }
        if (this.request.pdu[0] !== 3) { throw new Error('invalid function code'); }
        const start = this.request.pduUint16(1) + 1;
        return this.response.pduUint32(2 + 2 * (address - start));
    }

    public getRegisterAsInt32 (address: number): number {
        if (!this._request || !this._response) { throw new Error('request/response not available'); }
        if (this.request.pdu[0] !== 3) { throw new Error('invalid function code'); }
        const start = this.request.pduUint16(1) + 1;
        return this.response.pduInt32(2 + 2 * (address - start));
    }

    public getRegisterAsUint64 (address: number): number {
        if (!this._request || !this._response) { throw new Error('request/response not available'); }
        if (this.request.pdu[0] !== 3) { throw new Error('invalid function code'); }
        const start = this.request.pduUint16(1) + 1;
        return this.response.pduUint64(2 + 2 * (address - start));
    }

    public getRegisterAsFloat32 (address: number): number {
        if (!this._request || !this._response) { throw new Error('request/response not available'); }
        if (this.request.pdu[0] !== 3) { throw new Error('invalid function code'); }
        const start = this.request.pduUint16(1) + 1;
        return this.response.pduFloat32(2 + 2 * (address - start));

    }

    public getRegisterAsString (from: number, to: number): string {
        if (!this._request || !this._response) { throw new Error('request/response not available'); }
        if (this.request.pdu[0] !== 3) { throw new Error('invalid function code'); }
        const start = this.request.pduUint16(1) + 1;
        const length = this.request.pduUint16(3);
        if (to < from || from < start || to > (start + length)) { throw new Error('out of range'); }
        const b = this._response.pdu.slice(2 + (from - start) * 2, 2 + (to - start) * 2);
        const i = b.findIndex((x) => x === 0 );
        const rv = i < 0 ? b.toString('utf-8') : b.slice(0, i).toString('utf-8');
        return rv;
    }

}

export class ModbusTcpTransactionFactory extends ModbusTransaction {
    public async send (to: net.Socket, request: Buffer): Promise<ModbusTransaction> {
        if (this._request || this._resolve || this._reject) {
            return Promise.reject('request already sent');
        }
        this._request = new ModbusTcpRequest(request);
        return new Promise<ModbusTransaction>( (res, rej) => {
            this._resolve = res;
            this._reject = rej;
            to.write(request);
        });
    }

    public final (response: ModbusTcpResponse) {
        if (this._response) { throw new Error('response already set'); }
        this._response = response;
        if (this._resolve) {
            const res = this._resolve;
            this._resolve = null;
            this._reject = null;
            res(this);
        }
    }
}


export class ModbusTcpTransactionError extends Error {
    private _transaction: ModbusTransaction;

    public constructor (transaction: ModbusTransaction, msg?: string) {
        super(msg);
        this._transaction = transaction;
    }

    public get transaction (): ModbusTransaction {
        return this._transaction;
    }
}

export class ModbusTcpFrame {
    protected _at: Date;
    protected _mbap_header: Buffer;
    protected _pdu: Buffer;

    public constructor () {
        this._at = new Date();
    }

    public get isComplete (): boolean {
        return this._pdu !== undefined;
    }

    public get transactionId (): number {
        if (!this._mbap_header) { throw new Error('MBAP header missing'); }
        return this._mbap_header[0] * 256 + this._mbap_header[1];
    }

    public get protocolId (): number {
        if (!this._mbap_header) { throw new Error('MBAP header missing'); }
        return this._mbap_header[2] * 256 + this._mbap_header[3];
    }

    public get pduLength (): number {
        if (!this._mbap_header) { throw new Error('MBAP header missing'); }
        return (this._mbap_header[4] * 256 + this._mbap_header[5]) - 1;
    }

    public get unitIdentifier (): number {
        if (!this._mbap_header) { throw new Error('MBAP header missing'); }
        return this._mbap_header[6];
    }

    public get mbapHeader (): Buffer {
        if (!this._mbap_header) { throw new Error('MBAP header missing'); }
        return this._mbap_header;
    }

    public get pdu (): Buffer {
        if (!this._pdu) { throw new Error('PDU not available'); }
        return this._pdu;
    }

    public pduUint16 (byteIndex: number): number {
        if (!this._pdu) { throw new Error('PDU not available'); }
        if (byteIndex < 0 || byteIndex > (this._pdu.length - 2)) { throw new Error('out of range'); }
        return this._pdu[byteIndex] * 256 + this._pdu[byteIndex + 1];
    }

    public pduInt16 (byteIndex: number): number {
        const x = this.pduUint16(byteIndex);
        return x > 0x7fff ? x - 0x10000 : x;
    }

    public pduUint32 (byteIndex: number): number {
        if (!this._pdu) { throw new Error('PDU not available'); }
        if (byteIndex < 0 || byteIndex > (this._pdu.length - 4)) { throw new Error('out of range'); }
        let rv = 0;
        for (let i = 0; i < 4; i++) {
            rv = rv * 256 + this._pdu[byteIndex + i];
        }
        return rv;
    }

    public pduInt32 (byteIndex: number): number {
        const x = this.pduUint32(byteIndex);
        return x > 0x7fffffff ? x - 0x100000000 : x;
    }

    public pduUint64 (byteIndex: number): number {
        if (!this._pdu) { throw new Error('PDU not available'); }
        if (byteIndex < 0 || byteIndex > (this._pdu.length - 8)) { throw new Error('out of range'); }
        let rv = 0;
        for (let i = 0; i < 8; i++) {
            rv = rv * 256 + this._pdu[byteIndex + i];
        }
        return rv;
    }

    public pduInt64 (byteIndex: number): number {
        const x = this.pduUint64(byteIndex);
        return x > 0x7fffffffffffffff ? x - 0x10000000000000000 : x;
    }

    public pduFloat32 (byteIndex: number): number {
        if (!this._pdu) { throw new Error('PDU not available'); }
        if (byteIndex < 0 || byteIndex > (this._pdu.length - 4)) { throw new Error('out of range'); }
        const b = new ArrayBuffer(4);
        const bytes = new Uint8Array(b);
        for (let i = 0; i < 4; i++) {
            bytes[i] = this._pdu[i + byteIndex];
        }
        const v = new DataView(b, 0, 4);
        return v.getFloat32(0, false);
    }


}

export class ModbusTcpRequest extends ModbusTcpFrame {

    public constructor (frame: Buffer) {
        super();
        if (!frame || frame.length < 7 || frame.length !== (6 + frame[4] * 256 + frame[5])) {
            throw new Error('invalid frame');
        }
        this._mbap_header = Buffer.alloc(7);
        for (let i = 0; i < 7; i++) {
            this._mbap_header[i] = frame[i];
        }
        this._pdu = Buffer.alloc(frame.length - 7);
        for (let i = 7; i < frame.length; i++) {
            this._pdu[i - 7] = frame[i];
        }
    }
}

export class ModbusTcpResponse extends ModbusTcpFrame {
}


export class ModbusTcpResponseFactory extends ModbusTcpResponse {
    private _buffer: Buffer;
    private _index: number;

    public constructor () {
        super();
    }


    /**
     * Add Bytes to the frame
     * @param data buffer of bytes which contains bytes to add
     * @param offset start index in data
     * @param length number of bytes from buffer which can be used
     * @returns number of bytes taken from buffer, is 0 if frame already completed
     */
    public add (data: Buffer, offset = 0, length?: number): number {
        if (this._pdu !== undefined) { return 0; } // frame already complete
        let rv = 0;
        let maxLength = data.length - offset;
        length = length >= 0 && length <= maxLength ? length : maxLength;

        if (!this._mbap_header) {
            if (!this._buffer && maxLength >= 6) {
                this._mbap_header = Buffer.alloc(7);
                this._index = 0;
                for (let i = 0; i < 7; i++) {
                    this._mbap_header[i] = data[offset++];
                    rv++;
                }
            } else {
                if (!this._buffer) {
                    this._buffer = Buffer.alloc(7);
                    this._index = 0;
                }
                while (this._index < 7 && maxLength > 0) {
                    this._buffer[this._index++] = data[offset++];
                    maxLength--; rv++;
                }
                if (this._index === 7) {
                    this._mbap_header = this._buffer;
                    this._index = undefined;
                    this._buffer = undefined;
                }
            }
        }

        if (this._mbap_header && !this._buffer) {
            const expectedLength = (this._mbap_header[4] * 256 + this._mbap_header[5]) - 1;
            if (expectedLength > 0) {
                this._buffer = Buffer.alloc(expectedLength);
                this._index = 0;
            } else {
                this._pdu = null;
            }
        }

        while (this._index < this._buffer.length && maxLength > 0) {
            this._buffer[this._index++] = data[offset++];
            maxLength--; rv++;
        }

        if (this._index === this._buffer.length) {
            this._pdu = this._buffer;
            this._index = undefined;
        }

        return rv;
    }

}




