import { ModbusRtu } from '../modbus/modbus-rtu';
import { ModbusDevice } from './modbus-device';

export class ModbusRtuDevice extends ModbusDevice {

    protected _serial: ModbusRtu;

    public constructor (serial: ModbusRtu, address: number) {
        super(address);
        this._serial = serial;
    }

    public get id (): string {
        return this._serial.device + ':' + this.address;
    }
}
