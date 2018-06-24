# Manufacturing report

# Bugs / Improvements

| J2 | FTDI connector, exchange TxD and RxD
| J5 | Add PCB Text "ISP"
| Mounting holes | increase drill diameter


# Software

## Atmega324P Fuses

See [http://www.engbedded.com/fusecalc](http://www.engbedded.com/fusecalc)

Ext crystal Osc, Frequ. 8.0- MHz, Startup 1K CK + 4.1ms
Preserve EEPROM memory through Chip Erase cycle
Serial program downloading enabled
Brownout detection level 1.8V
Watchdog disabled
Boot flash size 1024 words, boot start 3c00 (=byte address 7800)
Boot reset vector

```
avrdude -c usbasp -p atmega324p -U lfuse:w:0xfe:m -U hfuse:w:0xd2:m
avrdude -c usbasp -p atmega324p -U efuse:w:0xfe:m
```

## Bootloader

[https://www.htl-mechatronik.at/gitweb/public/sx/?p=Atmel-Bootloader.git;a=summary](https://www.htl-mechatronik.at/gitweb/public/sx/?p=Atmel-Bootloader.git;a=summary)

Download file [bootloader_atmega324p_57600_12MHz](https://www.htl-mechatronik.at/gitweb/public/sx/?p=Atmel-Bootloader.git;a=blob;f=bootloader_atmega324p/bootloader_atmega324p_57600_12MHz.hex;h=1be515c9ac813556d2ff567f821665cee70f75b4;hb=afe5b4fa248f25c8252e9e7ba1cb7d82af7b6e48)

avrdude -c usbasp -p atmega324p
avrdude -c usbasp -p atmega324p -e -U flash:w:bootloader_atmega324p_57600_12MHz.hex:i

