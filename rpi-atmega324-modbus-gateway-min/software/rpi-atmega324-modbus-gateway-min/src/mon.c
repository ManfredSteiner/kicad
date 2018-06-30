#include "global.h"

#include <stdio.h>
#include <string.h>

#include <avr/io.h>
#include <util/delay.h>
#include <avr/pgmspace.h>

#include "mon.h"
#include "app.h"
#include "sys.h"

#ifdef GLOBAL_MONITOR

// defines
// ...

// declarations and definations

int8_t mon_cmd_info (uint8_t argc, char *argv[]);
int8_t mon_cmd_test (uint8_t argc, char *argv[]);
int8_t mon_cmd_uart1 (uint8_t argc, char *argv[]);

const char MON_LINE_WELCOME[] PROGMEM = "Line-Mode: CTRL-X, CTRL-Y, CTRL-C, Return  \n\r";
const char MON_PMEM_CMD_INFO[] PROGMEM = "info\0Application infos\0info";
const char MON_PMEM_CMD_TEST[] PROGMEM = "test\0commando for test\0test";
const char MON_PMEM_CMD_UART1[] PROGMEM = "uart1\0commando for uart1 config\0uart1 576008N1";

const struct Sys_MonCmdInfo MON_PMEMSTR_CMDS[] PROGMEM =
{
    { MON_PMEM_CMD_INFO, mon_cmd_info }
  , { MON_PMEM_CMD_TEST, mon_cmd_test }
  , { MON_PMEM_CMD_UART1, mon_cmd_uart1 }
};

volatile struct Mon mon;

// functions

void mon_init (void)
{
  memset((void *)&mon, 0, sizeof(mon));
}


//--------------------------------------------------------

inline void mon_main (void)
{
}

inline uint8_t mon_getCmdCount (void)
{
  return sizeof(MON_PMEMSTR_CMDS)/sizeof(struct Sys_MonCmdInfo);
}


// --------------------------------------------------------
// Monitor commands of the application
// --------------------------------------------------------

int8_t mon_cmd_info (uint8_t argc, char *argv[]) {
    printf("app.flags_u8  : ");
    sys_printHexBin8(sys.flags);
    sys_newline();
    return 0;
}


int8_t mon_cmd_test (uint8_t argc, char *argv[]) {
    uint8_t i;

    for (i = 0; i<argc; i++)
        printf("%u: %s\n\r", i, argv[i]);

    return 0;
}


int8_t mon_cmd_uart1 (uint8_t argc, char *argv[]) {
    if (argc != 2) return 1;
    long int br;
    int bits, stopbits;
    char parity;
    if (sscanf(argv[1], "%ld/%d%c%d", &br, &bits, &parity, &stopbits) != 4) return 2;
    
    if (br < 1200 || br > 115200) {
        return 3;
    }
    if (bits != 8) return 4;    

    char ucsr1c = (1 << UCSZ11) | (1 << UCSZ10);
    switch (parity) {
        case 'N': break;
        case 'E': ucsr1c |= (1 << UPM11); break;
        case 'O': ucsr1c |= (1 << UPM10); break;
        default: return 5;
    }
    
    switch (stopbits) {
        case 1: break;
        case 2: ucsr1c |= (1 << USBS1); break;
        default: return 6;
    }
    
    UBRR1L = (F_CPU/br + 4)/8 - 1;
    UBRR1H = 0x00;
    UCSR1A = (1<<U2X1);
    UCSR1C = ucsr1c;
    UCSR1B = (1 << RXCIE1) | (1 << TXEN1) | (1 << RXEN1);
    sys.modbus[0].dT1_35 = (uint16_t)(70 * 12000000L / 16 / br);
    sys.modbus[0].dT1_15 = (uint16_t)(30 * 12000000L / 16 / br);
    OCR1A = sys.modbus[0].dT1_35;
    
    return 0;
}



// --------------------------------------------------------
// Monitor-Line for continues output
// --------------------------------------------------------

int8_t mon_printLineHeader (uint8_t lineIndex)
{
  if (lineIndex==0)
    sys_printString_P(MON_LINE_WELCOME);
  
  switch (lineIndex)
  {
    case 0: printf("L0 | SPI   \n   |    flags err"); return 20;
    case 1: printf("L1 | UART0           | UART1  \n   |  ERR  CNT UCSRA |  ERR  CNT UCSRA"); return 40;
    default: return -1; // this line index is not valid
  }
}

int8_t mon_printLine   (uint8_t lineIndex, char keyPressed)
{

  switch (lineIndex)
  {
    case 0:
      printf("   | "); sys_printBin(sys.spi.flags, 0);
      printf("  %02x    ", sys.spi.err);
      if (keyPressed == 'c') {
          sys.spi.err = 0;
      }
      return 2;

    case 1:
      {
        if (keyPressed == 'c') {
             sys.uart[0].errorCnt = 0; sys.uart[0].receivedByteCnt = 0;
             sys.uart[1].errorCnt = 0; sys.uart[1].receivedByteCnt = 0;
        }
        printf("   | %04x %04x    %02x | %04x %04x    %02x", 
            sys.uart[0].errorCnt, sys.uart[0].receivedByteCnt, sys.uart[0].ucsra,
            sys.uart[1].errorCnt, sys.uart[1].receivedByteCnt, sys.uart[1].ucsra
        );
      }
      return 3;

    default: return -1;
  }
}

#endif // GLOBAL_MONITOR



