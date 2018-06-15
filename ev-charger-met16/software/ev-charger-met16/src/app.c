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
  DDRD |= (1 << PD6);
}


//--------------------------------------------------------

void app_main (void)
{
    printf("SW1: %d     SW2: %d  \r", sys_getSw1Value(), sys_isSw2On());
    sys_lcd_setCursorPosition(1, 0);
    sys_lcd_putString("MAX: ");
    if (!sys_isSw2On()) {
        sys_lcd_putString("0A (OFF)");
        OCR0A = 255;
    } else {
        uint8_t amps;
        switch (sys_getSw1Value()) {
            case 7: amps =  7; break;
            case 8: amps =  8; break;
            case 9: amps =  9; break;
            case 0: amps = 10; break;
            case 1: amps = 11; break;
            case 2: amps = 12; break;
            case 3: amps = 13; break;
            case 4: amps = 14; break;
            case 5: amps = 15; break;
            case 6: amps = 16; break;
            default: amps = 0; break;
        }
        char s[5];
        snprintf(s, sizeof(s), "%2dA", amps);
        sys_lcd_putString(s);
        OCR0A = 255 - ((amps * 255) / 6 + 5) / 10;
    }
        
    sys_lcd_putString("   ");
    sys_lcd_putString(sys_isSw2On() ? "ON " : "OFF");
    _delay_ms(100);
    
/*
    if (sys_isSw2On()) {
        PORTD |= (1 << PD6);
    } else {
        PORTD &= ~(1 << PD6);
    }
*/
}

//--------------------------------------------------------

void app_task_1ms (void) {}
void app_task_2ms (void) {}
void app_task_4ms (void) {}
void app_task_8ms (void) {}
void app_task_16ms (void) {}
void app_task_32ms (void) {}
void app_task_64ms (void) {
    sys_toggleLedD3();
}

void app_task_128ms (void) {
    sys_toggleLedD2();
}

