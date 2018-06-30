#include "global.h"

#include <stdio.h>
#include <string.h>
#include <ctype.h>
#include <stdlib.h>

#include <avr/io.h>
#include <avr/interrupt.h>
#include <avr/wdt.h>
#include <util/delay.h>
#include <avr/pgmspace.h>
#include <avr/eeprom.h>

#include "sys.h"
#include "app.h"
#include "mon.h"

// defines
#define SYS_UART_BYTE_RECEIVED (UCSR0A & (1<<RXC0))
#define SYS_UART_UDR_IS_EMPTY (UCSR0A & (1<<UDRE0))
#define SYS_UDR UDR0
#define SYS_UART_RECEIVE_VECTOR USART0_RX_vect
#define SYS_TIMER0_VECTOR TIMER0_COMPA_vect


#define SYS_MONITOR_FLAG_LINEMODE 0x01
#define SYS_MONITOR_FLAG_LINE     0x02
#define SYS_MONITOR_FLAG_CONT     0x04

#define SYS_MONITOR_CTRL_C        0x03
#define SYS_MONITOR_CTRL_X        0x18
#define SYS_MONITOR_CTRL_Y        0x19

struct Sys_Monitor {
    uint8_t flags;
    uint8_t lineIndex;
    uint8_t cursorPos;
    char cmdLine[40];
    uint8_t rpos_u8;
    uint8_t wpos_u8;
    uint8_t errcnt_u8;
    uint8_t rbuffer_u8[GLOBAL_MONITOR_RECBUFSIZE];
};
volatile struct Sys_Monitor sys_mon;

void   sys_mon_main (void);
int8_t sys_cmd_help (uint8_t argc, char *argv[]);
int8_t sys_cmd_sinfo (uint8_t argc, char *argv[]);
int8_t sys_cmd_hexdump (uint8_t argc, char *argv[]);
int8_t sys_cmd_setmem (uint8_t argc, char *argv[]);
uint8_t sys_spi_sendByte (uint8_t channel, uint8_t data, uint8_t waitUntilTransmitted);

// globale Konstante im Flash
const char SYS_PMEM_LINESTART[] PROGMEM = "\n\r>";
const char SYS_PMEM_ERR0[] PROGMEM = "Error ";
const char SYS_PMEM_ERR1[] PROGMEM = "Error: Unknown command\n\r";
const char SYS_PMEM_ERR2[] PROGMEM = " -> Syntax error\n\rUsage: ";
const char SYS_PMEM_CMD_HELP[] PROGMEM = "help\0List of all commands\0help";
const char SYS_PMEM_CMD_SINFO[] PROGMEM = "sinfo\0Systeminformation\0sinfo";
#ifdef GLOBAL_MONCMD_HEXDUMP
const char SYS_PMEM_CMD_HEXDUMP[] PROGMEM = "hexdump\0Hexdump of memory content\0hexdump {f|s|e} start [length]";
#endif // GLOBAL_MONCMD_HEXDUMP
#ifdef GLOBAL_MONCMD_SETMEM
const char SYS_PMEM_CMD_SETMEM[] PROGMEM = "setmem\0Write bytes into SRAM/EEPROM\0setmem [s|e] address value";
#endif // GLOBAL_MONCMD_SETMEM

const struct Sys_MonCmdInfo SYS_PMEMSTR_CMDS[] PROGMEM = {
      { SYS_PMEM_CMD_HELP, sys_cmd_help }
    , { SYS_PMEM_CMD_SINFO, sys_cmd_sinfo }
  #ifdef GLOBAL_MONCMD_HEXDUMP
    , { SYS_PMEM_CMD_HEXDUMP, sys_cmd_hexdump }
  #endif // GLOBAL_MONCMD_HEXDUMP
  #ifdef GLOBAL_MONCMD_SETMEM
    , { SYS_PMEM_CMD_SETMEM, sys_cmd_setmem }
  #endif // GLOBAL_MONCMD_SETMEM
};


/// declarations and definations

volatile struct Sys sys;

// // functions
int sys_monitor_putch (char c, FILE *f);
int sys_monitor_getch (FILE *f);
void sys_mon_handleReceivedByte (uint8_t c);

FILE sys_stdout = FDEV_SETUP_STREAM(sys_monitor_putch, NULL, _FDEV_SETUP_WRITE);
FILE sys_stdin  = FDEV_SETUP_STREAM(NULL, sys_monitor_getch, _FDEV_SETUP_READ);
FILE sys_modbus1out = FDEV_SETUP_STREAM(sys_monitor_putch, NULL, _FDEV_SETUP_WRITE);
FILE sys_modbus1in  = FDEV_SETUP_STREAM(NULL, sys_monitor_getch, _FDEV_SETUP_READ);
FILE sys_modbus2out = FDEV_SETUP_STREAM(sys_monitor_putch, NULL, _FDEV_SETUP_WRITE);
FILE sys_modbus2in  = FDEV_SETUP_STREAM(NULL, sys_monitor_getch, _FDEV_SETUP_READ);

void sys_init () {
    memset((void *)&sys, 0, sizeof(sys));
    sys.flags |= SYS_FLAG_MON_UART0;        // send monitor output to UART0
    // sys.flags |= SYS_FLAG_MON_SPI_WAIT;  // send monitor output via SPI channel 7
    sys.spi.rxDataHandler[7] = sys_mon_handleReceivedByte;
    _delay_ms(1);

    DDRB |= 0x07; // Debug
    PORTB = 0;
    
    PORTD |= ((1 << PD7) | (1 << PD5));
    PORTD &= ~(1 << PD6);
    PORTD &= ~(1 << PD4);
    DDRD |= 0xf0; // PD7=nRE1, PD6=DE1, PD5=nRE2, PD4=DE2
 
    // Timer 0 for task machine
    OCR0A  = (F_CPU+4)/8/10000-1;
    TCCR0A = (1 << WGM01);
    TCCR0B = (1 << CS01);
    TIMSK0 = (1 << OCIE0A);
    TIFR0  = (1 << OCF0A);
    
    // Timer 1 for Modbus-RTU timing measurments
    TCCR1A = 0;
    TCCR1B = (1 << CS11); // f=12MHz
    OCR1A  = 0xffff;
    TIMSK1 = (1 << OCIE1A);
  
    // UART0
    UBRR0L = (F_CPU/GLOBAL_UART0_BITRATE + 4)/8 - 1;
    UBRR0H = 0x00;
    UCSR0A = (1<<U2X0);
    UCSR0C = (1 << UCSZ01) | (1 << UCSZ00);
    UCSR0B = (1 << RXCIE0) | (1 << TXEN0) | (1 << RXEN0);
    
    // UART1
    UBRR1L = (F_CPU/GLOBAL_UART1_BITRATE + 4)/8 - 1;
    UBRR1H = 0x00;
    UCSR1A = (1 << U2X1);
    UCSR1C = (1 << UCSZ11) | (1 << UCSZ10);
    UCSR1B = (1 << RXCIE1) | (1 << TXEN1) | (1 << RXEN1);
    sys.modbus[0].dT1_35 = 70 * 12000000L / 16 / GLOBAL_UART1_BITRATE;
    sys.modbus[0].dT1_15 = 30 * 12000000L / 16 / GLOBAL_UART1_BITRATE;
    OCR1A = sys.modbus[0].dT1_35;
    
    // SPI Slave
    SPCR0 = (1 << SPIE0) | (1 << SPE0) | (1 << CPOL0);
    DDRB |= (1 << PB6); // MISO

    // connect libc functions printf(), gets()... to UART
    // fdevopen(sys_monitor_putch, sys_monitor_getch);
    stdout = &sys_stdout;
    stderr = &sys_stdout;
    stdin  = &sys_stdin;
}


void sys_main () {
    sys_mon_main();

}

//----------------------------------------------------------------------------

uint8_t sys_inc8BitCnt (uint8_t count) {
    return count<0xff ? count+1 : count;
}


uint16_t sys_inc16BitCnt (uint16_t count) {
    return count<0xffff ? count+1 : count;
}


void sys_sei (void) {
    if (sys.flags & SYS_FLAG_SREG_I) {
        sei();
    }
}


void sys_cli (void) {
    if (SREG & 0x80) {
        sys.flags |= SYS_FLAG_SREG_I;
    } else {
        sys.flags &= ~SYS_FLAG_SREG_I;
    }
    cli();
}


void sys_newline (void) {
    printf("\n\r");
}


void sys_printString_P (PGM_P str) {
    char c;

    while (1) {
        memcpy_P(&c, str++, 1);
        if (!c) break;
        putchar(c);
    }
}


void sys_puts_P (PGM_P str) {
    sys_printString_P(str);
    sys_newline();
}


int16_t sys_getByte (char typ, uint16_t add) {
    uint8_t value = 0;

    switch (typ) {
        case 'f': { // flash
            if (add > FLASHEND) return -1;
            memcpy_P(&value, (PGM_P) add, 1);
            break;
        }

        case 's': { // SRAM
            if (add > RAMEND) return -1;
            value = *((uint8_t *)add);
            break;
        }

        case 'e': { // EEPROM
            if (add > E2END) return -1;
            //value = eeprom_read_byte ((uint8_t *)add);
            break;
        }

        default:
            return -1;
    }

    return value;
}


void sys_printBin (uint8_t value, char sep) {
    uint8_t i;

    for (i = 0; i < 8; i++, value <<= 1) {
        putchar(value & 0x80 ? '1' : '0');
        if (i == 3 && sep)
            putchar(sep);
    }
}


void sys_printHexBin8 (uint8_t value) {
    printf("0x%02x (", value);
    sys_printBin(value, ' ');
    putchar(')');
}


void sys_printHexBin16 (uint16_t value) {
    printf("0x%04x (", value);
    sys_printBin(value>>8, ' ');
    putchar(' ');
    sys_printBin(value & 0xff, ' ');
    putchar(')');
}


int8_t sys_cmd_sinfo (uint8_t argc, char *argv[]) {
    printf("sys.flags_u8  : ");
    sys_printHexBin8(sys.flags);
    sys_newline();
    printf("sys.taskErr_u8: ");
    sys_printHexBin8(sys.taskErr_u8);
    sys_newline();
    return 0;
}


int16_t sys_readArgument (char *str, int16_t max) {
    int16_t value;

    if (str[0] == '0' && str[1] == 'x')
        value = strtol(str, NULL, 16);
    else
        value = strtol(str, NULL, 10);

    if (value > max)
        return -1;

    return value;
}


//----------------------------------------------------------------------------

int sys_monitor_getch (FILE *f) {
    if (f != stdin)
        return _FDEV_EOF;
    if (sys_mon.wpos_u8 == sys_mon.rpos_u8)
        return _FDEV_EOF;
    uint8_t c = sys_mon.rbuffer_u8[sys_mon.rpos_u8++];
    if (sys_mon.rpos_u8 >= GLOBAL_MONITOR_RECBUFSIZE)
        sys_mon.rpos_u8 = 0;
    return (int) c;
}


int sys_monitor_putch (char c, FILE *f) {
    if (f != stdout && f != stderr) {
        return _FDEV_EOF;
    }
    int rv = c;    
    
    if ( sys.flags & SYS_FLAG_MON_SPI_WAIT ) {
        sys_spi_sendByte(7, c, 1);
        // sys.spi.flags |= SYS_SPI_FLAG_MONTX;
    
    } else if ( sys.flags & SYS_FLAG_MON_SPI ) {
        sys_spi_sendByte(7, c, 0);
        // sys.spi.flags |= SYS_SPI_FLAG_MONTX;
    }
    
    if (sys.flags & SYS_FLAG_MON_UART0) {
        while (!(UCSR0A & (1<<UDRE0)))
            ;
        UDR0 = c;
    }
    
    if (sys.flags & SYS_FLAG_MON_UART1) {
        while (!(UCSR1A & (1<<UDRE1)))
            ;
        UDR1 = c;
    }
    
    return rv;
}


uint8_t sys_monitor_available () {
    return sys_mon.wpos_u8 >= sys_mon.rpos_u8
           ? sys_mon.wpos_u8 - sys_mon.rpos_u8
           : ((int16_t)sys_mon.wpos_u8) + GLOBAL_MONITOR_RECBUFSIZE - sys_mon.rpos_u8;
}


//----------------------------------------------------------------------------

int16_t sys_monitor_getBufferByte (uint8_t pos) {
    int16_t value;
    sys_cli();

    if (pos >= sys_monitor_available()) {
        value = -1;
    } else {
        uint8_t bufpos = sys_mon.rpos_u8 + pos;
        if (bufpos >= GLOBAL_MONITOR_RECBUFSIZE)
            bufpos -= GLOBAL_MONITOR_RECBUFSIZE;
        value = sys_mon.rbuffer_u8[bufpos];
    }

    sys_sei();
    return value;
}


void sys_monitor_flush () {
    sys_cli();
    while (SYS_UART_BYTE_RECEIVED) {
        sys_mon.rbuffer_u8[0] = SYS_UDR;
    }

    sys_mon.rpos_u8 = 0;
    sys_mon.wpos_u8 = 0;
    sys_mon.errcnt_u8 = 0;
    sys_sei();
}


//****************************************************************************
// Event Handling
//****************************************************************************

Sys_Event sys_setEvent (Sys_Event event) {
    sys_cli();
    uint8_t eventIsPending = ((sys.eventFlag & event) != 0);
    sys.eventFlag |= event;
    sys_sei();
    return eventIsPending;
}


Sys_Event sys_clearEvent (Sys_Event event) {
    sys_cli();
    uint8_t eventIsPending = ((sys.eventFlag & event) != 0);
    sys.eventFlag &= ~event;
    sys_sei();
    return eventIsPending;
}


Sys_Event sys_isEventPending (Sys_Event event) {
    return (sys.eventFlag & event) != 0;
}


//****************************************************************************
// LED Handling
//****************************************************************************

void sys_setLedD7 (uint8_t on) {
    if (on) {
        PORTC |= (1 << PC5);
    } else {
        PORTC &= ~(1 << PC5);
    }
}

void sys_setLedD8 (uint8_t on) {
    if (on) {
        PORTC |= (1 << PC4);
    } else {
        PORTC &= ~(1 << PC4);
    }
}

void sys_setLedD9 (uint8_t on) {
    if (on) {
        PORTC |= (1 << PC3);
    } else {
        PORTC &= ~(1 << PC3);
    }
}

void sys_toggleLedD7 () {
    PORTC ^= (1 << PC5);
}

void sys_toggleLedD8 () {
    PORTC ^= (1 << PC4);
}

void sys_toggleLedD9 () {
    PORTC ^= (1 << PC3);
}


//****************************************************************************
// Monitor Handling
//****************************************************************************

struct Sys_MonCmdInfo sys_getMonCmdInfo (uint8_t index) {
    struct Sys_MonCmdInfo ci = { NULL, NULL} ;
    PGM_P p;

    if (index < sizeof(SYS_PMEMSTR_CMDS) / sizeof(struct Sys_MonCmdInfo)) {
        p = (PGM_P)&(SYS_PMEMSTR_CMDS[index]);
    } else {
        index -= sizeof(SYS_PMEMSTR_CMDS) / sizeof(struct Sys_MonCmdInfo);
        if (index >= mon_getCmdCount()) {
            return ci;
        }
        p = (PGM_P)&(MON_PMEMSTR_CMDS[index]);
    }

    memcpy_P(&ci, p, sizeof(struct Sys_MonCmdInfo));
    return ci;
}


void sys_mon_printUsageInfo (struct Sys_MonCmdInfo *pCmdInfo) {
    PGM_P p = pCmdInfo->pInfo;
    for (uint8_t i = 0; i < 2; i++) {
        char c;
        do {
            memcpy_P(&c, p++, 1);
        }
        while (c != 0);
    }
    sys_printString_P(p);
}


void sys_mon_ExecuteCmd () {
    struct Sys_Monitor *pmon = (struct Sys_Monitor *)&sys_mon;
    sys_newline();

    uint8_t i;
    char *argv[GLOBAL_MON_MAXARGV];
    uint8_t argc;

    char *ps = pmon->cmdLine;
    argc = 0;

    i = 0;
    for (i = 0; i < GLOBAL_MON_MAXARGV && *ps; i++) {
        while (*ps == ' ') { 
           ps++; // ignore leading spaces   
        }
        if (*ps == 0) break;
        argv[i] = ps;
        argc++;
        while (*ps != ' ' && *ps) {
            ps++;
        }
        if (*ps == ' ')
        *ps++ = 0;
    }
    for (; i < GLOBAL_MON_MAXARGV; i++)
       argv[i] = NULL;

    /*
    printf("\n\rargc=%d\n\r", argc);
    for (i = 0; i < GLOBAL_MON_MAXARGV; i++) {
        printf("  argv[%d]=0x%04x", i, (uint16_t)argv[i]);
        if (argv[i])
            printf(" len=%d cmd='%s'", strlen(argv[i]), argv[i]);
        sys_newline();
    }
    */

    if (argc > 0 && *argv[0]) {
        i = 0;
        while (1) {
            struct Sys_MonCmdInfo ci = sys_getMonCmdInfo(i++);
            if (ci.pFunction == NULL) {
                sys_printString_P(SYS_PMEM_ERR1);
                break;
            
            } else if (strcmp_P(pmon->cmdLine, ci.pInfo) == 0) {
                if (argc == 2 && strcmp_P(argv[1], SYS_PMEM_CMD_HELP) == 0) {
                    sys_mon_printUsageInfo(&ci);
                } else {
                    int8_t retCode = (*ci.pFunction)(argc, argv);
                    if (retCode) {
                        sys_printString_P(SYS_PMEM_ERR0);
                        printf("%d", retCode);
                        if (retCode < 0) {
                            sys_printString_P(SYS_PMEM_ERR2);
                            sys_mon_printUsageInfo(&ci);
                        }
                    }
                }
                sys_newline();
                break;
            }
        }
    }

    sys_printString_P(SYS_PMEM_LINESTART);
    pmon->cursorPos = 0;
    pmon->cmdLine[0] = 0;
}


void sys_mon_CmdLineBack () {
    struct Sys_Monitor *pmon = (struct Sys_Monitor *)&sys_mon;
    if (pmon->cursorPos == 0) {
        return;
    }
    printf("\b \b");
    pmon->cmdLine[--pmon->cursorPos] = 0;
}


void sys_putnchar (char c, uint8_t count) {
    for (; count > 0; count--) {
        putchar(c);
    }
}


void sys_mon_main () {
    struct Sys_Monitor *pmon = (struct Sys_Monitor *)&sys_mon;
    char c = 0;
    int8_t incLineIndex = 0;
    static uint8_t lastbyte = 0;

    if (sys_mon.flags & SYS_MONITOR_FLAG_LINEMODE) {
        while (sys_monitor_available() > 0) {
            c = getchar();
            if (lastbyte != '\n' && c == '\r')
                c = '\n';
            else
                lastbyte = c;
            if (c=='\n') {
                sys_mon.flags &= ~(SYS_MONITOR_FLAG_LINEMODE | SYS_MONITOR_FLAG_LINE);
                printf("\n\n\r>");
                return;
            }
        }
        if (c == SYS_MONITOR_CTRL_X) {
            incLineIndex = 1;
            sys_mon.flags &= ~SYS_MONITOR_FLAG_LINE;
        } else if (c==SYS_MONITOR_CTRL_Y) {
            incLineIndex = -1;
            sys_mon.flags &= ~SYS_MONITOR_FLAG_LINE;
        } else if (c==SYS_MONITOR_CTRL_C) {
            if (sys_mon.flags & SYS_MONITOR_FLAG_CONT) {
                sys_mon.flags &= ~(SYS_MONITOR_FLAG_CONT | SYS_MONITOR_FLAG_LINE);
            } else {
                sys_mon.flags |= SYS_MONITOR_FLAG_CONT;
            }
        }

        if (sys_mon.flags & SYS_MONITOR_FLAG_LINE) {
            int8_t lenSpaces = mon_printLine(sys_mon.lineIndex, c);
            sys_putnchar(' ', lenSpaces);
            printf("\r");
            if (sys_mon.flags & SYS_MONITOR_FLAG_CONT) {
                printf("\n");
            }
        } else {
            int8_t len;
            printf("\n\n\r");
            do {
                if (incLineIndex) {
                    sys_mon.lineIndex = incLineIndex>0 ? sys_mon.lineIndex+1 : sys_mon.lineIndex-1;
                }
                len = mon_printLineHeader(sys_mon.lineIndex);
            }
            while (len < 0 && sys_mon.lineIndex != 0)
                ;
 
            sys_newline();
            if (len > 0) {
                sys_putnchar('-', len);
            }
            sys_newline();
            sys_mon.flags |= SYS_MONITOR_FLAG_LINE;
        }
    
    } else {
        while (sys_monitor_available() > 0) {
            c = getchar();
            if (lastbyte != '\n' && c == '\r') {
                c = '\n';
            } else {
                lastbyte = c;
            }

            if ((c == SYS_MONITOR_CTRL_X) || (c == SYS_MONITOR_CTRL_Y)) {
                sys_mon.flags |= SYS_MONITOR_FLAG_LINEMODE;
            } else if (c == '\n') {
                sys_mon_ExecuteCmd();
            } else if (c == 127) {
                ; // ignore Taste 'Entf' -> maybe implemented later
            } else if (c == '\b') {
                sys_mon_CmdLineBack();
            } else if (c < ' ' || c > 126) {
                ; // ignore control codes
            } else if (pmon->cursorPos < (sizeof(pmon->cmdLine) - 1)) {
                #ifdef GLOBAL_MON_ONLYLOCASE
                c = tolower(c);
                #endif
                pmon->cmdLine[pmon->cursorPos++] = c;
                pmon->cmdLine[pmon->cursorPos] = 0;
                putchar(c);
            }
        }
    }
}

void sys_mon_handleReceivedByte (uint8_t c) {
    static uint8_t lastChar;

    if (c == 'R' && lastChar == '@') {
        wdt_enable(WDTO_15MS);
        wdt_reset();
        while(1) {};
    }
    lastChar = c;

    sys_mon.rbuffer_u8[sys_mon.wpos_u8++] = c;
    if (sys_mon.wpos_u8 >= GLOBAL_MONITOR_RECBUFSIZE) {
        sys_mon.wpos_u8 = 0;
    }
    if (sys_mon.wpos_u8 == sys_mon.rpos_u8) {
        sys_mon.wpos_u8 == 0 ? sys_mon.wpos_u8 = GLOBAL_MONITOR_RECBUFSIZE-1 : sys_mon.wpos_u8--;
        sys_mon.errcnt_u8 = sys_inc8BitCnt(sys_mon.errcnt_u8);
    }
    sys_mon.rbuffer_u8[sys_mon.wpos_u8] = 0;
}


//****************************************************************************
// Monitor Commands
//****************************************************************************

int8_t sys_cmd_help (uint8_t argc, char *argv[]) {
    // struct Sys_Monitor *pmon = (struct Sys_Monitor *)&sys_mon;
    uint8_t i = 0, j, max = 0;

    while (1) {
        struct Sys_MonCmdInfo ci = sys_getMonCmdInfo(i++);
        if (ci.pFunction == NULL)
           break;
        uint8_t len = strlen_P(ci.pInfo);
        max = (len>max) ? len : max;
    }

    i = 0;
    while (1) {
        struct Sys_MonCmdInfo ci = sys_getMonCmdInfo(i++);
        if (ci.pFunction == NULL)
           break;

        sys_printString_P(ci.pInfo);
        for (j=strlen_P(ci.pInfo); j<max+2; j++)
           putchar(' ');
        sys_puts_P(ci.pInfo + strlen_P(ci.pInfo) + 1);
    }

    return 0;
}


#ifdef GLOBAL_MONCMD_SETMEM
int8_t sys_cmd_setmem (uint8_t argc, char *argv[]) {
    char     typ;    // 1st parameter (s='SRAM | 'e'=EEPROM)
    uint16_t add;    // 2nd parameter (address)
    uint16_t value;  // 3rd parameter (value)
    char     *padd, *pval;

    if (argc == 3) {
        typ = 's'; // default is set of SRAM-Byte
        padd = argv[1];
        pval = argv[2];
    } else if (argc == 4) {
        typ = argv[1][0];
        padd = argv[2];
        pval = argv[3];
    } else {
        return -1; // Syntax Error
    }

    add = sys_readArgument(padd, RAMEND);
    value = sys_readArgument(pval, 255);
    if (value < 0)
        return -2;

    printf("set 0x%02x to address 0x%04x\n\r", value, add);

    switch (typ) {
        case 's': {
            *((uint8_t *)add) = value;
            break;
        }

        case 'e': {
            eeprom_write_byte((uint8_t *)add, value);
            eeprom_busy_wait();
            break;
        }
    }

    return 0;
}
#endif // GLOBAL_MONCMD_SETMEM


#ifdef GLOBAL_MONCMD_HEXDUMP
int8_t sys_cmd_hexdump (uint8_t argc, char *argv[]) {
    if (argc < 3 || argc > 4)
        return -1;

    char     typ; // 1st parameter ('s'=SRAM | 'f'=FLASH | 'e'=EEPROM)
    uint16_t add; // 2nd parameter (start address of hexdump)
    uint16_t len; // [3rd parameter] (number of bytes to dump)

    typ = argv[1][0];
    if (typ != 'f' && typ != 's' && typ != 'e')
        return -1;
    if (argv[2][0] == '0' && argv[2][1] == 'x') {
        add = strtol(&argv[2][2], NULL, 16);
    } else {
        add = strtol(argv[2], NULL, 10);
    }

    if (argc == 4) {
        if (argv[3][0] == '0' && argv[3][1] == 'x') {
            len = strtol(&argv[3][2], NULL, 16);
        } else {
            len = strtol(&argv[3][0], NULL, 10);
        }
    } else {
        len = 32;
    }

    char s[19] = "  ";
    s[18] = 0;
    uint16_t i;

    for (i = 0; i < len; add++, i++) {
        int16_t i16 = sys_getByte(typ, add);
        if (i16 < 0)
            break;
        uint8_t value = (uint8_t)i16;

        if (i % 16 == 0) {
            printf("0x%04x: ", add);
        } else if (i%4==0) {
            putchar(' ');
        }

        s[(i%16)+2] = value>=32 && value<127 ? value : '.';
        printf("%02x ", value);
        if (i % 16 == 15) {
            printf(s);
            sys_newline();
        }
    }

    if ((i % 16) != 0) {
        for (; (i % 16) != 0; i++) {
            printf("   ");
            s[(i % 16) + 2] = ' ';
            if (i % 4 == 0)
                putchar(' ');
        }
        printf(s);
        sys_newline();
    }

    return 0;
}
#endif // GLOBAL_MONCMD_HEXDUMP


uint8_t sys_spi_sendByte (uint8_t channel, uint8_t data, uint8_t wait) {
    uint8_t used;
    uint8_t timer = 255;
    while (1) {
        cli();
        __asm__ __volatile__ ("nop");
        used = sys.spi.txUsed;
        if (used < 8 || --timer == 0 || !wait)
            break;
        sei();
        __asm__ __volatile__ ("nop");
    }
    if (timer > 0 && used < 8) {
        uint8_t i = (sys.spi.txRPos + used) % 8;
        sys.spi.txBuffer[i] = ((uint16_t)channel) << 13 | data;
        sys.spi.txUsed++;
        sei();
        return 0; // OK
    } else {
        sei();
        return 1; // error, transmit buffer overflow
    }
}


// ------------------------------------
// Interrupt Service Routinen
// ------------------------------------

ISR (USART0_RX_vect) {
    sys.uart[0].ucsra = UCSR0A;
    uint8_t errors = sys.uart[0].ucsra & ( (1 << FE0) | (1 << DOR0) | (1 << UPE0) );
    volatile uint8_t data = UDR0;
    if (errors) {
         sys.uart[0].errorCnt = sys_inc16BitCnt(sys.uart[0].errorCnt);
         return;
    }
    sys.uart[0].receivedByteCnt = sys_inc16BitCnt(sys.uart[0].receivedByteCnt);

    if (sys.flags & SYS_FLAG_MON_UART0) {
        sys_mon_handleReceivedByte(data);
    }
}

ISR (USART1_RX_vect) {
    sys.uart[1].ucsra = UCSR1A;
    uint16_t tcnt1 = TCNT1;
    TCNT1 = 0; TCCR1B = (1 << CS11); // restart timer
    uint8_t errors = UCSR1A & ( (1 << FE1) | (1 << DOR1) | (1 << UPE1) );
    // uint8_t errors = sys.uart[1].ucsra & ( (1 << FE1) );
    volatile uint8_t data = UDR1;
    if (errors) {
        sys.uart[1].errorCnt = sys_inc16BitCnt(sys.uart[1].errorCnt);
    } else {
        sys.uart[1].receivedByteCnt = sys_inc16BitCnt(sys.uart[1].receivedByteCnt);
    }
    sei();
    uint8_t status = ((errors != 0) << 3) | ((tcnt1 > sys.modbus[0].dT1_15) << 1) | (tcnt1 > sys.modbus[0].dT1_35);
    app_handleUart1Byte(data, status);
    if (!errors && sys.flags & SYS_FLAG_MON_UART1) {
        sys_mon_handleReceivedByte(data);
    }
    
}


// Timer 0 Output/Compare Interrupt
// called every 100us
ISR (TIMER0_COMPA_vect) {
    static uint8_t cnt100us = 0;
    static uint8_t cnt500us = 0;
    static uint8_t busy = 0;

    cnt100us++;
    if (cnt100us >= 5) {
        cnt100us = 0;
        cnt500us++;
        if (busy) {
            sys.taskErr_u8 = sys_inc8BitCnt(sys.taskErr_u8);
        } else {
            busy = 1;
            sei();
            if      (cnt500us & 0x01) app_task_1ms();
            else if (cnt500us & 0x02) app_task_2ms();
            else if (cnt500us & 0x04) app_task_4ms();
            else if (cnt500us & 0x08) app_task_8ms();
            else if (cnt500us & 0x10) app_task_16ms();
            else if (cnt500us & 0x20) app_task_32ms();
            else if (cnt500us & 0x40) app_task_64ms();
            else if (cnt500us & 0x80) app_task_128ms();
            busy = 0;
        }
    }
}

ISR (TIMER1_COMPA_vect) {
    TCCR1B = 0; // disable timer 1
    PORTB ^= (1 << PB1);
    // PORTB &= ~(1 << PB1);
}


ISR (SPI_STC_vect) {
    static uint8_t sendLow = 0;
    static uint8_t lowByte = 0;
    volatile uint8_t data = SPDR0;
    
    uint8_t used = sys.spi.txUsed;
    uint8_t dOut;
    if (sendLow) { // 0,6us
        sendLow = 0;
        dOut = lowByte;
    } else { // 4us
        sendLow = 1;
        uint8_t i = sys.spi.txRPos;
        uint16_t w = sys.spi.txBuffer[i];
        sys.spi.txBuffer[i] = 0;
        sys.spi.txRPos = (i + 1) % 8;
        uint8_t channel = (w >> 8) & 0xe0;
        lowByte = channel | (w & 0x0f);
        dOut = channel | 0x10 | ((w >> 4) & 0x0f);
        if (used > 0) {
            sys.spi.txUsed = used - 1;
        }
    }
    SPDR0 = dOut;

    // handle received SPI byte
    if (data & 0x10) {
        if  ((sys.spi.rxHigh & 0x10)) {
            sys.spi.err = sys_inc8BitCnt(sys.spi.err); // error, high byte after high byte
        }
        sys.spi.rxHigh = data; // memorize high byte (first part of transfer)
    } else {
        uint8_t ch = data >> 5;
        uint8_t lastChannel = sys.spi.rxHigh >> 5;
        if (lastChannel > 0 && ch != (sys.spi.rxHigh >> 5)) {
            sys.spi.err = sys_inc8BitCnt(sys.spi.err); // error, channel differs for high/low byte
        } else {
            if (sys.spi.rxDataHandler[ch] != NULL) {
                (*sys.spi.rxDataHandler[ch])( (sys.spi.rxHigh << 4) | (data & 0x0f) );
            }
        }
        sys.spi.rxHigh = 0;
    }
}
