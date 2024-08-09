## vl53l1x-microbit

> Open this page at [https://github.com/martinclausen2/vl53l1x-calliope](https://github.com/martinclausen2/vl53l1x-calliope)

## Summary
This extension supports the __VL53L1X__ time-of-flight ranging sensor in __Calliope MakeCode__ programming.  
The extension is available for almost all __VL53L1X__ breakouts.

## Pin connection

Calliope Grove A0 | VL53L1X breakout
:--------: | :---------:
SCL  |  SCL
SDA  |  SDA
3V  |  +V (VIN, Vcc)
GND (0V)  |  GND
NC  |  XSHUT
NC  |  GPIO1

* VL53L1X Breakout must be 3.3V drivable
* I2C address: 0x29


## Methods
* Initialize    (Always run at the beginning)
```
VL53L1X.init()
```

* Get Distance as Number(mm)
```
VL53L1X.readSingle()
```

* Get Distance as String
```
VL53L1X.stringDistance()
```

* When the sensor times out, the distance obtained will be zero.
* If the measurement target is too far or the measurement cannot be performed correctly, the distance obtained will be 9999.

## Example
```blocks
VL53L1X.init()
basic.forever(function () {
    serial.writeLine(VL53L1X.readSingle())
})
```

## Use as Extension

This repository can be added as an **extension** in MakeCode.

* open [https://makecode.calliope.cc/](https://makecode.calliope.cc/)
* click on **New Project**
* click on **Extensions** under the gearwheel menu
* search for **https://github.com/martinclausen2/vl53l1x-calliope** and import


## Metadata (used for search, rendering)

* for PXT/calliope
<script src="https://makecode.com/gh-pages-embed.js"></script><script>makeCodeRender("{{ site.makecode.home_url }}", "{{ site.github.owner_name }}/{{ site.github.repository_name }}");</script>
