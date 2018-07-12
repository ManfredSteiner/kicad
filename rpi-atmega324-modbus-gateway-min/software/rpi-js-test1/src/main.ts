
// import * as fs from 'fs';
import * as SerialPort from 'serialport';

const message = 'Start of test program';
console.log(message);

const port = new SerialPort('/dev/ttyS0', {
    baudRate: 115200
});

port.open();

port.on('open', () => {
    console.log('serial port opened');
});

port.on('error', (err) => {
    console.log('serial port error');
    console.log(err);
});

port.on('data', (data: Buffer) => {
    console.log('serial data received');
    console.log(data);
});

let i: number;
i = 0;

setInterval( () => {
    i = i + 1;
    if (i === 10) {
        debugger;
    }
    console.log(i);
}, 1000);
