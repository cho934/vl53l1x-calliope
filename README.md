## vl53l1x-microbit

> Open this page at [https://healthywalk.github.io/vl53l1x-microbit/](https://healthywalk.github.io/vl53l1x-microbit/)

---
This extension supports VL53L1X Time-of-Flight ranging sensor in MakeCode
* I2C address 0x29

---
## Method
* Initialize

   Always run at the beginning
```
VL53L1X.init()
```

* Get Distance as Number

```
VL53L1X.readSingle()
```

* Get Distance as String

```
VL53L1X.stringDistance()
```

---
## Example
```
VL53L1X.init()
basic.forever(function () {
    serial.writeLine(VL53L1X.stringDistance())
})
```

---
## Use as Extension

This repository can be added as an **extension** in MakeCode.

* open [https://makecode.microbit.org/](https://makecode.microbit.org/)
* click on **New Project**
* click on **Extensions** under the gearwheel menu
* search for **https://github.com/healthywalk/vl53l1x-microbit** and import

---
## License
MIT

---
## Metadata (used for search, rendering)

* for PXT/microbit
<script src="https://makecode.com/gh-pages-embed.js"></script><script>makeCodeRender("{{ site.makecode.home_url }}", "{{ site.github.owner_name }}/{{ site.github.repository_name }}");</script>
