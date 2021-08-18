/**
* VL53L1X block
*/
//% weight=90 color=#1eb0f0 icon="\uf0b2"
namespace VL53L1X {
    type ResultBuffer = {
        range_status?: number
        stream_count?: number
        dss_actual_effective_spads_sd0?: number
        ambient_count_rate_mcps_sd0?: number
        final_crosstalk_corrected_range_mm_sd0?: number
        peak_signal_count_rate_crosstalk_corrected_mcps_sd0?: number
    }
    enum RangeStatus {
        RangeValid = 0,
        SigmaFail = 1,
        SignalFail = 2,
        RangeValidMinRangeClipped = 3,
        OutOfBoundsFail = 4,
        HardwareFail = 5,
        RangeValidNoWrapCheckFail = 6,
        WrapTargetFail = 7,
        XtalkSignalFail = 9,
        SynchronizationInt = 10, // (the API spells this "syncronisation")
        MinRangeFail = 13,
        None = 255,
    }
    type RangingData = {
        range_mm?: number
        range_status?: RangeStatus
        peak_signal_count_rate_MCPS?: number
        ambient_count_rate_MCPS?: number
    }
    enum DistanceMode { Short, Medium, Long, Unknown }
    const SOFT_RESET = 0x0000
    const OSC_MEASURED__FAST_OSC__FREQUENCY = 0x0006
    const VHV_CONFIG__TIMEOUT_MACROP_LOOP_BOUND = 0x0008
    const VHV_CONFIG__INIT = 0x000B
    const ALGO__PART_TO_PART_RANGE_OFFSET_MM = 0x001E
    const MM_CONFIG__OUTER_OFFSET_MM = 0x0022
    const DSS_CONFIG__TARGET_TOTAL_RATE_MCPS = 0x0024
    const PAD_I2C_HV__EXTSUP_CONFIG = 0x002E
    const GPIO__TIO_HV_STATUS = 0x0031
    const SIGMA_ESTIMATOR__EFFECTIVE_PULSE_WIDTH_NS = 0x0036
    const SIGMA_ESTIMATOR__EFFECTIVE_AMBIENT_WIDTH_NS = 0x0037
    const ALGO__CROSSTALK_COMPENSATION_VALID_HEIGHT_MM = 0x0039
    const ALGO__RANGE_IGNORE_VALID_HEIGHT_MM = 0x003E
    const ALGO__RANGE_MIN_CLIP = 0x003F
    const ALGO__CONSISTENCY_CHECK__TOLERANCE = 0x0040
    const CAL_CONFIG__VCSEL_START = 0x0047
    const PHASECAL_CONFIG__TIMEOUT_MACROP = 0x004B
    const PHASECAL_CONFIG__OVERRIDE = 0x004D
    const DSS_CONFIG__ROI_MODE_CONTROL = 0x004F
    const SYSTEM__THRESH_RATE_HIGH = 0x0050
    const SYSTEM__THRESH_RATE_LOW = 0x0052
    const DSS_CONFIG__MANUAL_EFFECTIVE_SPADS_SELECT = 0x0054
    const DSS_CONFIG__APERTURE_ATTENUATION = 0x0057
    const MM_CONFIG__TIMEOUT_MACROP_A = 0x005A
    const MM_CONFIG__TIMEOUT_MACROP_B = 0x005C
    const RANGE_CONFIG__TIMEOUT_MACROP_A = 0x005E
    const RANGE_CONFIG__VCSEL_PERIOD_A = 0x0060
    const RANGE_CONFIG__TIMEOUT_MACROP_B = 0x0061
    const RANGE_CONFIG__VCSEL_PERIOD_B = 0x0063
    const RANGE_CONFIG__SIGMA_THRESH = 0x0064
    const RANGE_CONFIG__MIN_COUNT_RATE_RTN_LIMIT_MCPS = 0x0066
    const RANGE_CONFIG__VALID_PHASE_HIGH = 0x0069
    const SYSTEM__GROUPED_PARAMETER_HOLD_0 = 0x0071
    const SYSTEM__SEED_CONFIG = 0x0077
    const SD_CONFIG__WOI_SD0 = 0x0078
    const SD_CONFIG__WOI_SD1 = 0x0079
    const SD_CONFIG__INITIAL_PHASE_SD0 = 0x007A
    const SD_CONFIG__INITIAL_PHASE_SD1 = 0x007B
    const SYSTEM__GROUPED_PARAMETER_HOLD_1 = 0x007C
    const SD_CONFIG__QUANTIFIER = 0x007E
    const SYSTEM__SEQUENCE_CONFIG = 0x0081
    const SYSTEM__GROUPED_PARAMETER_HOLD = 0x0082
    const SYSTEM__INTERRUPT_CLEAR = 0x0086
    const SYSTEM__MODE_START = 0x0087
    const RESULT__RANGE_STATUS = 0x0089
    const PHASECAL_RESULT__VCSEL_START = 0x00D8
    const RESULT__OSC_CALIBRATE_VAL = 0x00DE
    const FIRMWARE__SYSTEM_STATUS = 0x00E5
    const IDENTIFICATION__MODEL_ID = 0x010F
    const TargetRate = 0x0A00
    const TimingGuard = 4528
    const i2cAddr = 0x29
    const io_timeout = 500

    let calibrated: boolean = false
    let distance_mode: DistanceMode = DistanceMode.Unknown
    let fast_osc_frequency = 1
    let saved_vhv_init = 0
    let saved_vhv_timeout = 0
    let did_timeout = false
    let results: ResultBuffer = {}
    let ranging_data: RangingData = {}
    let osc_calibrate_val = 0
    let timeout_start_ms = 0

    /**
     * VL53L1X Initialize
     */
    //% blockId="VL53L1X_INITIALIZE" block="init vl53l1x"
    export function init(): void {
        // check model ID and module type registers (values specified in datasheet)
        if (readReg16Bit(IDENTIFICATION__MODEL_ID) != 0xEACC) {
            return //false
        }
        // VL53L1_software_reset() begin
        writeReg(SOFT_RESET, 0x00)
        //delayMicroseconds(100) ...microsec
        control.waitMicros(100)
        writeReg(SOFT_RESET, 0x01)
        // give it some time to boot; otherwise the sensor NACKs during the readReg()
        // call below and the Arduino 101 doesn't seem to handle that well
        //delay(1); ....msec
        basic.pause(1)
        // VL53L1_poll_for_boot_completion() begin
        startTimeout()
        // check last_status in case we still get a NACK to try to deal with it correctly
        //while ((readReg(FIRMWARE__SYSTEM_STATUS) & 0x01) == 0 || last_status != 0)...original
        while ((readReg(FIRMWARE__SYSTEM_STATUS) & 0x01) == 0) {
            if (checkTimeoutExpired()) {
                did_timeout = true
                return //false
            }
        }
        // VL53L1_poll_for_boot_completion() end
        // VL53L1_software_reset() end
        // VL53L1_DataInit() begin
        writeReg(PAD_I2C_HV__EXTSUP_CONFIG,
            readReg(PAD_I2C_HV__EXTSUP_CONFIG) | 0x01)
        // store oscillator info for later use
        fast_osc_frequency = readReg16Bit(OSC_MEASURED__FAST_OSC__FREQUENCY)
        osc_calibrate_val = readReg16Bit(RESULT__OSC_CALIBRATE_VAL)
        // VL53L1_DataInit() end
        // VL53L1_StaticInit() begin
        // Note that the API does not actually apply the configuration settings below
        // when VL53L1_StaticInit() is called: it keeps a copy of the sensor's
        // register contents in memory and doesn't actually write them until a
        // measurement is started. Writing the configuration here means we don't have
        // to keep it all in memory and avoids a lot of redundant writes later.

        // the API sets the preset mode to LOWPOWER_AUTONOMOUS here:
        // VL53L1_set_preset_mode() begin

        // VL53L1_preset_mode_standard_ranging() begin

        // values labeled "tuning parm default" are from vl53l1_tuning_parm_defaults.h
        // (API uses these in VL53L1_init_tuning_parm_storage_struct())

        // static config
        // API resets PAD_I2C_HV__EXTSUP_CONFIG here, but maybe we don't want to do
        // that? (seems like it would disable 2V8 mode)
        writeReg16Bit(DSS_CONFIG__TARGET_TOTAL_RATE_MCPS, TargetRate) // should already be this value after reset
        writeReg(GPIO__TIO_HV_STATUS, 0x02)
        writeReg(SIGMA_ESTIMATOR__EFFECTIVE_PULSE_WIDTH_NS, 8) // tuning parm default
        writeReg(SIGMA_ESTIMATOR__EFFECTIVE_AMBIENT_WIDTH_NS, 16) // tuning parm default
        writeReg(ALGO__CROSSTALK_COMPENSATION_VALID_HEIGHT_MM, 0x01)
        writeReg(ALGO__RANGE_IGNORE_VALID_HEIGHT_MM, 0xFF)
        writeReg(ALGO__RANGE_MIN_CLIP, 0) // tuning parm default
        writeReg(ALGO__CONSISTENCY_CHECK__TOLERANCE, 2) // tuning parm default

        // general config
        writeReg16Bit(SYSTEM__THRESH_RATE_HIGH, 0x0000)
        writeReg16Bit(SYSTEM__THRESH_RATE_LOW, 0x0000)
        writeReg(DSS_CONFIG__APERTURE_ATTENUATION, 0x38)

        // timing config
        // most of these settings will be determined later by distance and timing
        // budget configuration
        writeReg16Bit(RANGE_CONFIG__SIGMA_THRESH, 360) // tuning parm default
        writeReg16Bit(RANGE_CONFIG__MIN_COUNT_RATE_RTN_LIMIT_MCPS, 192) // tuning parm default

        // dynamic config

        writeReg(SYSTEM__GROUPED_PARAMETER_HOLD_0, 0x01)
        writeReg(SYSTEM__GROUPED_PARAMETER_HOLD_1, 0x01)
        writeReg(SD_CONFIG__QUANTIFIER, 2); // tuning parm default

        // VL53L1_preset_mode_standard_ranging() end
        // from VL53L1_preset_mode_timed_ranging_*
        // GPH is 0 after reset, but writing GPH0 and GPH1 above seem to set GPH to 1,
        // and things don't seem to work if we don't set GPH back to 0 (which the API
        // does here).
        writeReg(SYSTEM__GROUPED_PARAMETER_HOLD, 0x00)
        writeReg(SYSTEM__SEED_CONFIG, 1) // tuning parm default
        // from VL53L1_config_low_power_auto_mode
        writeReg(SYSTEM__SEQUENCE_CONFIG, 0x8B) // VHV, PHASECAL, DSS1, RANGE
        writeReg16Bit(DSS_CONFIG__MANUAL_EFFECTIVE_SPADS_SELECT, 200 << 8);
        writeReg(DSS_CONFIG__ROI_MODE_CONTROL, 2) // REQUESTED_EFFFECTIVE_SPADS
        // VL53L1_set_preset_mode() end
        // default to long range, 50 ms timing budget
        // note that this is different than what the API defaults to
        setDistanceMode(DistanceMode.Long)
        setMeasurementTimingBudget(50000)
        // VL53L1_StaticInit() end
        // the API triggers this change in VL53L1_init_and_start_range() once a
        // measurement is started; assumes MM1 and MM2 are disabled
        writeReg16Bit(ALGO__PART_TO_PART_RANGE_OFFSET_MM,
            readReg16Bit(MM_CONFIG__OUTER_OFFSET_MM) * 4)
        basic.showLeds(`
            . . . . .
            . # . # .
            . . . . .
            # . . . #
            . # # # .
        `)
        //return true;
    }

    function setDistanceMode(mode: DistanceMode): boolean {
        // save existing timing budget
        let budget_us = getMeasurementTimingBudget()
        switch (mode) {
            case DistanceMode.Short:
                // from VL53L1_preset_mode_standard_ranging_short_range()
                // timing config
                writeReg(RANGE_CONFIG__VCSEL_PERIOD_A, 0x07)
                writeReg(RANGE_CONFIG__VCSEL_PERIOD_B, 0x05)
                writeReg(RANGE_CONFIG__VALID_PHASE_HIGH, 0x38)
                // dynamic config
                writeReg(SD_CONFIG__WOI_SD0, 0x07)
                writeReg(SD_CONFIG__WOI_SD1, 0x05)
                writeReg(SD_CONFIG__INITIAL_PHASE_SD0, 6) // tuning parm default
                writeReg(SD_CONFIG__INITIAL_PHASE_SD1, 6) // tuning parm default
                break;
            case DistanceMode.Medium:
                // from VL53L1_preset_mode_standard_ranging()
                // timing config
                writeReg(RANGE_CONFIG__VCSEL_PERIOD_A, 0x0B)
                writeReg(RANGE_CONFIG__VCSEL_PERIOD_B, 0x09)
                writeReg(RANGE_CONFIG__VALID_PHASE_HIGH, 0x78)
                // dynamic config
                writeReg(SD_CONFIG__WOI_SD0, 0x0B)
                writeReg(SD_CONFIG__WOI_SD1, 0x09)
                writeReg(SD_CONFIG__INITIAL_PHASE_SD0, 10) // tuning parm default
                writeReg(SD_CONFIG__INITIAL_PHASE_SD1, 10) // tuning parm default
                break;
            case DistanceMode.Long: // long
                // from VL53L1_preset_mode_standard_ranging_long_range()
                // timing config
                writeReg(RANGE_CONFIG__VCSEL_PERIOD_A, 0x0F)
                writeReg(RANGE_CONFIG__VCSEL_PERIOD_B, 0x0D)
                writeReg(RANGE_CONFIG__VALID_PHASE_HIGH, 0xB8)
                // dynamic config
                writeReg(SD_CONFIG__WOI_SD0, 0x0F)
                writeReg(SD_CONFIG__WOI_SD1, 0x0D)
                writeReg(SD_CONFIG__INITIAL_PHASE_SD0, 14) // tuning parm default
                writeReg(SD_CONFIG__INITIAL_PHASE_SD1, 14) // tuning parm default
                break
            default:
                // unrecognized mode - do nothing
                return false
        }
        // reapply timing budget
        setMeasurementTimingBudget(budget_us)
        // save mode so it can be returned by getDistanceMode()
        distance_mode = mode
        return true;
    }

    function setMeasurementTimingBudget(budget_us: number): boolean {
        // assumes PresetMode is LOWPOWER_AUTONOMOUS
        if (budget_us <= TimingGuard) { return false }
        budget_us -= TimingGuard
        let range_config_timeout_us = budget_us
        if (range_config_timeout_us > 1100000) { return false } // FDA_MAX_TIMING_BUDGET_US * 2
        range_config_timeout_us /= 2
        // VL53L1_calc_timeout_register_values() begin
        // "Update Macro Period for Range A VCSEL Period"
        let macro_period_us = calcMacroPeriod(readReg(RANGE_CONFIG__VCSEL_PERIOD_A))
        // "Update Phase timeout - uses Timing A"
        // Timeout of 1000 is tuning parm default (TIMED_PHASECAL_CONFIG_TIMEOUT_US_DEFAULT)
        // via VL53L1_get_preset_mode_timing_cfg().
        let phasecal_timeout_mclks = timeoutMicrosecondsToMclks(1000, macro_period_us)
        if (phasecal_timeout_mclks > 0xFF) { phasecal_timeout_mclks = 0xFF }
        writeReg(PHASECAL_CONFIG__TIMEOUT_MACROP, phasecal_timeout_mclks)

        // "Update MM Timing A timeout"
        // Timeout of 1 is tuning parm default (LOWPOWERAUTO_MM_CONFIG_TIMEOUT_US_DEFAULT)
        // via VL53L1_get_preset_mode_timing_cfg(). With the API, the register
        // actually ends up with a slightly different value because it gets assigned,
        // retrieved, recalculated with a different macro period, and reassigned,
        // but it probably doesn't matter because it seems like the MM ("mode
        // mitigation"?) sequence steps are disabled in low power auto mode anyway.
        writeReg16Bit(MM_CONFIG__TIMEOUT_MACROP_A, encodeTimeout(
            timeoutMicrosecondsToMclks(1, macro_period_us)));
        // "Update Range Timing A timeout"
        writeReg16Bit(RANGE_CONFIG__TIMEOUT_MACROP_A, encodeTimeout(
            timeoutMicrosecondsToMclks(range_config_timeout_us, macro_period_us)))
        // "Update Macro Period for Range B VCSEL Period"
        macro_period_us = calcMacroPeriod(readReg(RANGE_CONFIG__VCSEL_PERIOD_B))
        // "Update MM Timing B timeout"
        // (See earlier comment about MM Timing A timeout.)
        writeReg16Bit(MM_CONFIG__TIMEOUT_MACROP_B, encodeTimeout(
            timeoutMicrosecondsToMclks(1, macro_period_us)))
        // "Update Range Timing B timeout"
        writeReg16Bit(RANGE_CONFIG__TIMEOUT_MACROP_B, encodeTimeout(
            timeoutMicrosecondsToMclks(range_config_timeout_us, macro_period_us)))
        // VL53L1_calc_timeout_register_values() end
        return true
    }

    function getMeasurementTimingBudget(): number {
        // assumes PresetMode is LOWPOWER_AUTONOMOUS and these sequence steps are
        // enabled: VHV, PHASECAL, DSS1, RANGE
        // VL53L1_get_timeouts_us() begin
        // "Update Macro Period for Range A VCSEL Period"
        let macro_period_us = calcMacroPeriod(readReg(RANGE_CONFIG__VCSEL_PERIOD_A));
        // "Get Range Timing A timeout"
        let range_config_timeout_us = timeoutMclksToMicroseconds(decodeTimeout(
            readReg16Bit(RANGE_CONFIG__TIMEOUT_MACROP_A)), macro_period_us);
        // VL53L1_get_timeouts_us() end
        return 2 * range_config_timeout_us + TimingGuard;
    }

    function timeoutOccurred(): boolean {
        let tmp: boolean = did_timeout
        did_timeout = false
        return tmp
    }

    function read(): number {
        startTimeout();
        while (!dataReady()) {
            if (checkTimeoutExpired()) {
                did_timeout = true;
                //basic.showNumber(1)
                return 0;
            }
        }
        readResults();
        if (!calibrated) {
            setupManualCalibration();
            calibrated = true;
        }
        updateDSS();
        getRangingData();
        writeReg(SYSTEM__INTERRUPT_CLEAR, 0x01); // sys_interrupt_clear_range
        return ranging_data.range_mm;
    }

    /**
     * Read Distance
     */
    //% blockId="VL53L1X_DISTANCE" block="distance"
    export function readSingle(): number {
        writeReg(SYSTEM__INTERRUPT_CLEAR, 0x01); // sys_interrupt_clear_range
        writeReg(SYSTEM__MODE_START, 0x10); // mode_range__single_shot
        return read();
    }

    //% blockId="STRING_DISTANCE" block="s_distance"
    export function stringDistance(): string {
        let d = readSingle()
        let d1 = Math.floor(d / 10)
        let d2 = Math.floor(d - (d1 * 10))
        let s = `${d1}` + '.' + `${d2}` + " cm "
        return s
    }
    
    function setupManualCalibration(): void {
        saved_vhv_init = readReg(VHV_CONFIG__INIT);
        saved_vhv_timeout = readReg(VHV_CONFIG__TIMEOUT_MACROP_LOOP_BOUND);

        // "disable VHV init"
        writeReg(VHV_CONFIG__INIT, saved_vhv_init & 0x7F);

        // "set loop bound to tuning param"
        writeReg(VHV_CONFIG__TIMEOUT_MACROP_LOOP_BOUND,
            (saved_vhv_timeout & 0x03) + (3 << 2)); // tuning parm default (LOWPOWERAUTO_VHV_LOOP_BOUND_DEFAULT)

        // "override phasecal"
        writeReg(PHASECAL_CONFIG__OVERRIDE, 0x01);
        writeReg(CAL_CONFIG__VCSEL_START, readReg(PHASECAL_RESULT__VCSEL_START));
    }

    function readResults(): void {
        results.range_status = readReg(RESULT__RANGE_STATUS)
        //basic.showNumber(results.range_status)
        results.stream_count = readReg(RESULT__RANGE_STATUS + 2)
        basic.showNumber(results.stream_count)
        results.dss_actual_effective_spads_sd0 = readReg16Bit(RESULT__RANGE_STATUS + 3)
        results.ambient_count_rate_mcps_sd0 = readReg16Bit(RESULT__RANGE_STATUS + 7)
        results.final_crosstalk_corrected_range_mm_sd0 = readReg16Bit(RESULT__RANGE_STATUS + 13)
        //basic.showNumber(results.final_crosstalk_corrected_range_mm_sd0)
        results.peak_signal_count_rate_crosstalk_corrected_mcps_sd0 = readReg16Bit(RESULT__RANGE_STATUS + 15)
    /*
        pins.i2cWriteNumber(i2cAddr, RESULT__RANGE_STATUS, NumberFormat.UInt16BE, false)
        results.range_status = pins.i2cReadNumber(i2cAddr, NumberFormat.UInt8LE, true)
        pins.i2cReadNumber(i2cAddr, NumberFormat.UInt8LE, true)
        results.stream_count = pins.i2cReadNumber(i2cAddr, NumberFormat.UInt8LE, true)
        results.dss_actual_effective_spads_sd0 = pins.i2cReadNumber(i2cAddr, NumberFormat.UInt16LE, true)
        pins.i2cReadNumber(i2cAddr, NumberFormat.UInt16LE, true)
        results.ambient_count_rate_mcps_sd0 = pins.i2cReadNumber(i2cAddr, NumberFormat.UInt16LE, true)
        pins.i2cReadNumber(i2cAddr, NumberFormat.UInt32LE, true)
        results.final_crosstalk_corrected_range_mm_sd0 = pins.i2cReadNumber(i2cAddr, NumberFormat.UInt16LE, true)
        results.peak_signal_count_rate_crosstalk_corrected_mcps_sd0 = pins.i2cReadNumber(i2cAddr, NumberFormat.UInt16LE, false)
    */
    }

    function updateDSS(): void {
        let spadCount = results.dss_actual_effective_spads_sd0
        if (spadCount != 0) {
            let totalRatePerSpad =
                results.peak_signal_count_rate_crosstalk_corrected_mcps_sd0 +
                results.ambient_count_rate_mcps_sd0
            if (totalRatePerSpad > 0xFFFF) { totalRatePerSpad = 0xFFFF; }
            totalRatePerSpad <<= 16;
            totalRatePerSpad /= spadCount;
            if (totalRatePerSpad != 0) {
                let requiredSpads = (TargetRate << 16) / totalRatePerSpad;
                if (requiredSpads > 0xFFFF) { requiredSpads = 0xFFFF; }
                writeReg16Bit(DSS_CONFIG__MANUAL_EFFECTIVE_SPADS_SELECT, requiredSpads);
                return;
            }
        }
        writeReg16Bit(DSS_CONFIG__MANUAL_EFFECTIVE_SPADS_SELECT, 0x8000);
    }

    function getRangingData(): void {
        let range = results.final_crosstalk_corrected_range_mm_sd0
        ranging_data.range_mm = (range * 2011 + 0x0400) / 0x0800;
        switch (results.range_status) {
            case 17: // MULTCLIPFAIL
            case 2: // VCSELWATCHDOGTESTFAILURE
            case 1: // VCSELCONTINUITYTESTFAILURE
            case 3: // NOVHVVALUEFOUND
                // from SetSimpleData()
                ranging_data.range_status = RangeStatus.HardwareFail
                break
            case 13: // USERROICLIP
                // from SetSimpleData()
                ranging_data.range_status = RangeStatus.MinRangeFail
                break
            case 18: // GPHSTREAMCOUNT0READY
                ranging_data.range_status = RangeStatus.SynchronizationInt
                break
            case 5: // RANGEPHASECHECK
                ranging_data.range_status = RangeStatus.OutOfBoundsFail
                break
            case 4: // MSRCNOTARGET
                ranging_data.range_status = RangeStatus.SignalFail
                break
            case 6: // SIGMATHRESHOLDCHECK
                ranging_data.range_status = RangeStatus.SigmaFail
                break
            case 7: // PHASECONSISTENCY
                ranging_data.range_status = RangeStatus.WrapTargetFail
                break
            case 12: // RANGEIGNORETHRESHOLD
                ranging_data.range_status = RangeStatus.XtalkSignalFail
                break
            case 8: // MINCLIP
                ranging_data.range_status = RangeStatus.RangeValidMinRangeClipped
                break
            case 9: // RANGECOMPLETE
                // from VL53L1_copy_sys_and_core_results_to_range_results()
                if (results.stream_count == 0) {
                    ranging_data.range_status = RangeStatus.RangeValidNoWrapCheckFail
                } else {
                    ranging_data.range_status = RangeStatus.RangeValid
                }
                break
            default:
                ranging_data.range_status = RangeStatus.None
        }

        // from SetSimpleData()
        ranging_data.peak_signal_count_rate_MCPS =
            countRateFixedToFloat(results.peak_signal_count_rate_crosstalk_corrected_mcps_sd0);
        ranging_data.ambient_count_rate_MCPS =
            countRateFixedToFloat(results.ambient_count_rate_mcps_sd0);
   }

    function countRateFixedToFloat(count_rate_fixed: number): number {
         return count_rate_fixed / (1 << 7)
    }

    function writeReg(reg: number, d: number): void {
        let tmp = (reg << 16) | (d << 8) | (readReg(reg + 1) & 0xff)
        pins.i2cWriteNumber(i2cAddr, tmp, NumberFormat.UInt32BE, false)
    }

    function writeReg16Bit(reg: number, d: number): void {
        let tmp = (reg << 16) | d
        pins.i2cWriteNumber(i2cAddr, tmp, NumberFormat.UInt32BE, false)
    }

    function writeReg32Bit(reg: number, d: number): void {
        let tmp = (reg << 16) | ((d >> 16) & 0xffff)
        pins.i2cWriteNumber(i2cAddr, tmp, NumberFormat.UInt32BE, false)
        tmp = ((reg + 2) << 16) | (d & 0xffff)
        pins.i2cWriteNumber(i2cAddr, tmp, NumberFormat.UInt32BE, false)
    }

    function readReg(reg: number): number {
        pins.i2cWriteNumber(i2cAddr, reg, NumberFormat.UInt16BE, false)
        let d = pins.i2cReadNumber(i2cAddr, NumberFormat.UInt8BE, false)
        return d;
    }

    function readReg16Bit(reg: number): number {
        pins.i2cWriteNumber(i2cAddr, reg, NumberFormat.UInt16BE, false)
        let d = pins.i2cReadNumber(i2cAddr, NumberFormat.UInt16BE, false)
        return d;
    }

    function readReg32Bit(reg: number): number {
        pins.i2cWriteNumber(i2cAddr, reg, NumberFormat.UInt16BE, false)
        let d = pins.i2cReadNumber(i2cAddr, NumberFormat.UInt32BE, false)
        return d;
    }

    function decodeTimeout(reg_val: number): number {
        return ((reg_val & 0xFF) << (reg_val >> 8)) + 1
    }

    function encodeTimeout(timeout_mclks: number): number {
        let ls_byte = 0
        let ms_byte = 0
        if (timeout_mclks > 0) {
            ls_byte = timeout_mclks - 1
            while ((ls_byte & 0xFFFFFF00) > 0) {
                ls_byte >>= 1
                ms_byte++
            }
            return (ms_byte << 8) | (ls_byte & 0xFF)
        } else {
            return 0
        }
    }

    function timeoutMclksToMicroseconds(timeout_mclks: number, macro_period_us: number): number {
        return (timeout_mclks * macro_period_us + 0x800) >> 12;
    }

    function timeoutMicrosecondsToMclks(timeout_us: number, macro_period_us: number): number {
        return ((timeout_us << 12) + (macro_period_us >> 1)) / macro_period_us
    }

    function calcMacroPeriod(vcsel_period: number): number {
        let pll_period_us = (0x01 << 30) / fast_osc_frequency;
        let vcsel_period_pclks = (vcsel_period + 1) << 1;

        let macro_period_us = 2304 * pll_period_us;
        macro_period_us >>= 6;
        macro_period_us *= vcsel_period_pclks;
        macro_period_us >>= 6;
        return macro_period_us;
    }

    function startTimeout(): void {
        //timeout_start_ms = millis()
        timeout_start_ms = input.runningTime()
    }

    function checkTimeoutExpired(): boolean {
        return (io_timeout > 0) && ((input.runningTime() - timeout_start_ms) > io_timeout)
    }

    function dataReady(): boolean {
        return (readReg(GPIO__TIO_HV_STATUS) & 0x01) == 0
    }
}
