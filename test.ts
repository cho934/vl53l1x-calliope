VL53L1X.init()
basic.forever(function () {
    serial.writeLine(VL53L1X.stringDistance())
})
