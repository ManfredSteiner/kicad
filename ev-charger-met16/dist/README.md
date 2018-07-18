# Manufacturing report

Device is tested on electric vehicle (Hyundai Ioniq). The remaining loading time, shown in the vehicles dashboard is calculated from the start loading current. The pwm duty cycle on control pilot can be selected by SW1 (7=7A, 8=8A, 9, 0, 1, 2, 3, 4, 5, 6=16A). SW2 must be in position ON. The maximum current selection (SW1) can be changed while vehicle is loading. The vehicle is changing the loading current immediatly if pwm duty cycle changes, only the remaining loading time in the dashboard stays unchanged which seems to be a bug in the vehicle software. The loading principle may be used for dynamic loading adjustment, for example to adapt loading current to photovoltaic power generation level.

Also measurement for voltage and current and LCD is working as desired. 

Using a [TTL-232R-5V-WE](http://www.ftdichip.com/Products/Cables/USBTTLSerial.htm) cable on J8 allows safe development without connection of 230V. You can supply the device by 230V and the J8 in parallel, in order to have monitor access via UART interface.

## Phase switching relais needed

The electric vehicle will not start loading, if there is voltage on phase (J6-3).
A relais is needed to separate phase J6-3 from J5-3. This solution works witch Fotek 40A SSR. For Fotek 100A SSR you need an additional switching transistor vom +12V supply.

**Bugfix:**  
Insert solid state relais between J6-3 and the EV cable phase wire.
This relais is switched by Port PC4 (A4 = LED D2).

See: [device_assembled.png](device_assembled.png)

## Bugfixes / Improvements on pcb


| Reference | Description |
| --------- | ---------------------------------------------------- |
| U5, U6    | Pads: space between rows can be reduced (0,1..0,3mm) |
| C8        | Reference not good visible
| C5        | swap location to R4
| R21       | -> 27K
| R22       | -> 10K
| R31       | -> 15K
| R16, R18, R29, R23, R24 | -> 47K
| R10       | -> 100M (or remove resistor)
| R33       | -> 120K
| R34       | -> 33K
| R35       | -> 3K3
| R32       | -> 100M
| R27       | -> 560R
| R28       | -> 560R
| RV1       | -> 100K
| R13,R26   | -> 1K
| R3            | PCB-Error, U5B-5 to +5V, T1-3 to U5B-5 without resistor
| Via: PE, N, L | drill size to diameter 1.5mm ?
| luster-drill  | increase ring size, better placement of connection vias, move distance holes for cable
