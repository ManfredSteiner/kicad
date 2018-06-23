#ifndef GLOBAL_H_INCLUDED
#define GLOBAL_H_INCLUDED

#define F_CPU 12000000UL
#ifndef __AVR_ATmega324P__
    #define __AVR_ATmega324P__
#endif

// Monitor commands, maximum number of arguments (command itself is first)
#define GLOBAL_MON_MAXARGV 4

#define GLOBAL_MONITOR
//#define GLOBAL_MONCMD_HEXDUMP
//#define GLOBAL_MONCMD_SETMEM

#define GLOBAL_UART0_BITRATE 57600
#define GLOBAL_UART1_BITRATE 57600
#define GLOBAL_MONITOR_RECBUFSIZE 16
// #define GLOBAL_STDOUT_SPI_WAIT

#endif // GLOBAL_H_INCLUDED
