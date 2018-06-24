var wpi = require('wiringpi-sx');
var NanoTimer = require('nanotimer');

let result = wpi.setup('wpi');
console.log('wpi.setup() -> ' + result);

// var pin = 10; // CS   (D3)
// var pin = 14; // SCLK (D0)
// var pin = 13; // MISO (D1)
// var pin = 12; // MOSI (D2)

// wpi.pinMode(7, wpi.GPIO_CLOCK);
// wpi.gpioClockSet(7,9500000);

// wpi.pinMode(21, wpi.GPIO_CLOCK);
// wpi.gpioClockSet(21, 9600000);

const fd = wpi.wiringPiSPISetupMode(0, 1000000, 3);
console.log('wpi.wpi.wiringPiSPISetup() -> ' + fd);

const timer = new NanoTimer();
let cnt = 0;
let error = 0, channel = -1, high = -1, busy;

timer.setInterval(() => {
    if (busy === 1) {
        return;
    }
    busy = 1;
    let receivedByte = -1, spiByte = -1;
    if (cnt >= 10000) {
        cnt = 3;
    }
    if (cnt === 1) {
        let buf1 = Buffer.from([0x34]);
        rv = wpi.wiringPiSPIDataRW(0, buf1);
        spiByte = buf1[0];
    } else if (cnt === 2) {
        let buf1 = Buffer.from([0x21]);
        rv = wpi.wiringPiSPIDataRW(0, buf1);
        spiByte = buf1[0];
    } else {
        if (cnt % 2 === 0) {
            let buf1 = Buffer.from([0x00]);
            rv = wpi.wiringPiSPIDataRW(0, buf1);
            spiByte = buf1[0];
        } else {
            let buf1 = Buffer.from([0x00]);
            rv = wpi.wiringPiSPIDataRW(0, buf1);
            spiByte = buf1[0];
        }
    }
    cnt++;

    if (spiByte >= 0 && spiByte <= 255) {
        // if ((spiByte >> 5) === 1) {
        //     console.log('SPI: ' + spiByte);
        // }
        if ((spiByte & 0x10) !== 0) {
            high = spiByte & 0x0f;
            channel = spiByte >> 5;
            // if (channel === 1) {
            //     console.log('high: ' + high);
            // }
        } else if (channel === (spiByte >> 5)) {
            let low = spiByte & 0x0f;
            if (high >= 0 && low >= 0) {
                // receivedByte = (high << 4) | low;
                // if (channel === 1) {
                //     console.log('low: ' + low);
                // }
                receivedByte = (high << 4) | low;
                high = -1;
            } else {
                error++;
                high = -1;
                console.log('Error 1');
            }
        } else {
            error++;
            high = -1;
            console.log('Error 2: SPI=' + spiByte);
        }
    } else {
        error++;
        high = -1;
        console.log('Error 3');
    }

    if (receivedByte >= 0 && receivedByte <=255) {
        if (channel > 0) {
            console.log('channel:' + channel + '   byte: ' + receivedByte + '   -> ' + String.fromCharCode(receivedByte));
        }
    }
    busy = 0;

}, '', '200u');

