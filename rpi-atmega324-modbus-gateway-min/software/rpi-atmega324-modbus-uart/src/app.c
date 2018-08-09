#include "global.h"

#include <stdio.h>
#include <string.h>

#include <avr/io.h>
#include <avr/interrupt.h>
#include <util/delay.h>

#include "app.h"
#include "sys.h"

// defines
// ...


// declarations and definations

volatile struct App app;


// functions

void app_init (void)
{
  memset((void *)&app, 0, sizeof(app));
  PORTD &= ~(1 << PD6); // PD6=DE1  = 0 -> disable Modbus 1 as transmitter
  PORTD &= ~(1 << PD7); // PD7=nRE1 = 0 -> enable Modbus 1 as receiver
  PORTD &= ~(1 << PD4); // PD4=DE2  = 0 -> disable Modbus 2
  PORTD |=  (1 << PD5); // PD5=nRE2 = 1 -> disable Modbus 2
  app.monitorModbus1 = 1;
}


//--------------------------------------------------------

void app_main (void) {
    if (sys_uart_available() > 0) {
        char c = getchar();
        switch (c) {
            case 'm': 
                app.monitorModbus1 = !app.monitorModbus1;
                break;    
            
            case 's': {
                uint32_t br = F_CPU / ((UBRR1L + 1) * 8);
                printf("\r\n\nSTATUS\r\n===========================\r\n");
                printf("  (m)    monitor: %u\r\n", app.monitorModbus1);
                printf("         switch:  %d\r\n", (PINC & 0x80) != 0);
                printf("  (1..4) t35=%04x  t15=%04x  speed=%lu  \r\n",
                    sys.modbus[0].dT1_15, sys.modbus[0].dT1_35, br);
                printf("         modbus-errors: %u \r\n", sys.modbus[0].errorCnt);
                printf("         modbus-bytes:  %u \r\n", sys.modbus[0].receivedByteCnt);
                sys_newline();
                break;    
            }
            
            case '1': case '2': case '3': case '4': {
                uint32_t br = F_CPU / ((UBRR1L + 1) * 8);
                sys.modbus[0].dT1_35 = (c - '0') * 70 * F_CPU / 16 / br;
                sys.modbus[0].dT1_15 = (c - '0') * 30 * F_CPU / 16 / br;                
                break;
            }
        }
    }
}


void app_handleUart1Byte (uint8_t data, uint8_t status) {
    if (status & 0xf0) {
        PORTB |= (1 << PB3);
        PORTB &= ~(1 << PB3);
        sys_setEvent(APP_EVENT_MODBUS_ERROR);
        if (app.monitorModbus1) printf("\n\rU\n\r");
        return;
    } else if (status & (1 << SYS_MODBUS_STATUS_NEWFRAME)) {
        PORTB |= (1 << PB0);
        PORTB &= ~(1 << PB0);
        sys_setEvent(APP_EVENT_NEW_FRAME);
        if (app.monitorModbus1) printf("\n\r");
    } else if (status & (1 << SYS_MODBUS_STATUS_ERR_FRAME)) {
        PORTB |= (1 << PB1);
        PORTB &= ~(1 << PB1);
        sys_setEvent(APP_EVENT_MODBUS_ERROR);
        if (app.monitorModbus1) printf("XX");
    } else {
        PORTB |= (1 << PB2);
        PORTB &= ~(1 << PB2);
    }
    
    if (app.monitorModbus1) {
        for (uint8_t i = 0; i < 2; i++) {
            uint8_t x = (i == 0) ? data >> 4 : data & 0x0f;
            if (x >= 0 && x <= 9) {
                putchar(x + '0');
            } else {
                putchar(x - 10 + 'a');
            }
        }
    }
    
}

void app_handleUart1Timeout () {
    PORTB |= (1 << PB0);
    PORTB &= ~(1 << PB0);
    sys_setEvent(APP_EVENT_NEW_FRAME);
    if (app.monitorModbus1) {
        printf("\n\r");
    }
}

//--------------------------------------------------------

void app_task_1ms (void) {}
void app_task_2ms (void) {}

void app_task_4ms (void) {
    static uint8_t brOld = 0;
    uint8_t swRight = (PINC & 0x80) != 0;
    uint16_t br;
    if (swRight) {
        br = 19200;
    } else {
        br = 9600;
    }
//    if (brOld != br) {
//        sys.modbus[0].dT1_35 = 70 * F_CPU / 16 / br;
//        sys.modbus[0].dT1_15 = 30 * F_CPU / 16 / br;
//        OCR1A = sys.modbus[0].dT1_35;
//    }
//    UBRR1L = (F_CPU / br + 4)/8 - 1;
}

void app_task_8ms (void) {
    static uint8_t timerD9 = 0, timerD8 = 0, timerD7 = 0;
    
    timerD9++;
    if (timerD9 >= 125) {
        timerD9 = 0;
        sys_setLedD9(1);
    } else if (timerD9 == 16) {
        sys_setLedD9(0);
    }
    
    if (timerD8 > 0) {
        timerD8--;
    } else if (sys_clearEvent(APP_EVENT_NEW_FRAME)) {
        timerD8 = 30;
    }
    sys_setLedD8(timerD8 > 15);

    if (timerD7 > 0) {
        timerD7--;
    } else if (sys_clearEvent(APP_EVENT_MODBUS_ERROR)) {
        timerD7 = 30;
    }
    sys_setLedD8(timerD7 > 15);
}


void app_task_16ms (void) {}
void app_task_32ms (void) {}
void app_task_64ms (void) {}

void app_task_128ms (void) {
    static uint8_t timer = 0;
    timer = timer >= 8 ? 0 : timer + 1;
    
    if (timer == 0) {
        // UDR1 = 0x41;
        // app_handleUart1Byte(0x41, 0);
    }
    
}



