#ifndef SYS_H_INCLUDED
#define SYS_H_INCLUDED

#include <avr/pgmspace.h>

#if GLOBAL_UART_RECBUFSIZE > 255
    #error "Error: GLOBAL_UART_RECBUFSIZE value over maximum (255)"
#endif

extern FILE sys_stdout;
extern FILE sys_stdin;
extern FILE sys_modbus1in;
extern FILE sys_modbus1out;
extern FILE sys_modbus2in;
extern FILE sys_modbus2out;


// declarations

typedef uint8_t Sys_Event;
typedef void (*rxDataHandler_f)(uint8_t);

struct Sys_MonCmdInfo {
    PGM_P pInfo;
    int8_t (*pFunction)(uint8_t, char *[]);
};

struct Sys_SPI {
    uint8_t flags; 
    uint8_t err;
    uint8_t nextChannel;
    uint16_t txData[8];
    uint8_t rxHigh;
    rxDataHandler_f rxDataHandler[8];
    uint16_t txBuffer[8];
    uint8_t txRPos, txUsed;
};

struct Sys {
  uint8_t   flags;
  uint8_t   taskErr_u8;
  Sys_Event eventFlag;
  struct Sys_SPI spi;
};


// defines and declarations
extern volatile struct Sys sys;

#define modbus1in (&sys_modbus1in)
#define modbus1out (&sys_modbus1out)
#define modbus2in (&sys_modbus2in)
#define modbus2out (&sys_modbus2out)

#define SYS_SPI_FLAG_MONTX    0x01

#define SYS_FLAG_SREG_I       0x80
#define SYS_FLAG_MON_UART0    0x40
#define SYS_FLAG_MON_UART1    0x20
#define SYS_FLAG_MON_SPI      0x10
#define SYS_FLAG_MON_SPI_WAIT 0x08
#define SYS_FLAG_Bit2         0x04
#define SYS_FLAG_Bit1         0x02
#define SYS_FLAG_Bit0         0x01

// functions

void     sys_init ();
void     sys_main ();

void     sys_sei ();
void     sys_cli ();

uint8_t  sys_inc8BitCnt (uint8_t count);
uint16_t sys_inc16BitCnt (uint16_t count);

void     sys_newline (void);
void     sys_printString_P (PGM_P str);
void     sys_puts_P (PGM_P str);
void     sys_printBin (uint8_t value, char sep);
void     sys_printHexBin8 (uint8_t value);
void     sys_printHexBin16 (uint16_t value);
int16_t  sys_readArgument (char *str, int16_t max);

int16_t  sys_getByte (char typ, uint16_t add);

Sys_Event sys_setEvent (Sys_Event event);
Sys_Event sys_clearEvent (Sys_Event event);
Sys_Event sys_isEventPending (Sys_Event event);

uint8_t   sys_uart_available ();
int16_t   sys_uart_getBufferByte (uint8_t pos);
void      sys_uart_flush ();

void      sys_setLedD7 (uint8_t on);
void      sys_setLedD8 (uint8_t on);
void      sys_setLedD9 (uint8_t on);
void      sys_toggleLedD7 ();
void      sys_toggleLedD8 ();
void      sys_toggleLedD9 ();

#endif // SYS_H_INCLUDED
