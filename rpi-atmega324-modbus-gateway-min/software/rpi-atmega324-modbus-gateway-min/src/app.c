#include "global.h"

#include <stdio.h>
#include <string.h>

#include <avr/io.h>
#include <avr/interrupt.h>
#include <util/delay.h>

#include "app.h"
#include "mon.h"
#include "sys.h"

// defines
// ...


// declarations and definations

volatile struct App app;


// functions

void app_init (void)
{
  memset((void *)&app, 0, sizeof(app));
  PORTD |= (1 << PD4);  // DE2 = 1
  PORTD &= ~(1 << PD5); // nRE2 = 0
  PORTD &= ~(1 << PD7); // nRE1 = 0
  // DDRD |= 0xf0; // PD7=nRE1, PD6=DE1, PD5=nRE2, PD4=DE2
 
}


void app_handleUart1Byte (uint8_t data, uint8_t status) {
    sys_spi_sendByte(1, ' ', 1);
    if (status & 0xf0) {
        sys_spi_sendByte(1, 'U', 1);
        sys_spi_sendByte(1, 'E', 1);
        return;
    } else if (status & (1 << SYS_MODBUS_STATUS_NEWFRAME)) {
        PORTB |= (1 << PB0);
        sys_spi_sendByte(1, 'N', 1);
        sys_spi_sendByte(1, 'F', 1);
        sys_spi_sendByte(1, ' ', 1);
        PORTB &= ~(1 << PB0);
    } else if (status & (1 << SYS_MODBUS_STATUS_ERR_FRAME)) {
        PORTB |= (1 << PB1);
        sys_spi_sendByte(1, 'M', 1);
        sys_spi_sendByte(1, 'E', 1);
        sys_spi_sendByte(1, ' ', 1);
        PORTB &= ~(1 << PB1);
    } else {
        PORTB |= (1 << PB2);
        PORTB &= ~(1 << PB2);
    }
    
    char s[3];
    sprintf(s, "%02X", data);
    sys_spi_sendByte(1, s[0], 1);
    sys_spi_sendByte(1, s[1], 1);
}

//--------------------------------------------------------

void app_main (void)
{
}

//--------------------------------------------------------

void app_task_1ms (void) {}
void app_task_2ms (void) {}
void app_task_4ms (void) {}
void app_task_8ms (void) {}
void app_task_16ms (void) {}
void app_task_32ms (void) {}
void app_task_64ms (void) {}
void app_task_128ms (void) {}

