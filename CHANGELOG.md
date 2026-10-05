# Changelog

All notable changes to JeepMonitor. Versions follow [Semantic Versioning](https://semver.org/); every release is
tagged `vX.Y.Z`. The Android `versionCode` is `major * 10000 + minor * 100 + patch`.

## [0.5.0] - 2026-10-05

### Added
- In-app software update on the About screen: checks the latest GitHub release, shows its notes, downloads the APK
  and hands it to the Android installer. Needs the one-time "install unknown apps" permission.

## [0.4.0] - 2026-10-05

### Added
- Free-form dashboard: widgets sit on a 6-column grid and can be dropped in any free cell. Hold a widget to edit,
  drag the grip to move it and the corner handle to resize it, like an Android home-screen widget.
- Widget content scales with the widget; titles keep one size.
- Refresh and Connect / Disconnect buttons on every device widget.
- Renogy DC-DC charger widget shows alternator and solar volts and amps, temperatures, daily min / max battery
  voltage, peak current and power, lifetime energy, days running and protection counters.
- The charger driver tries common Modbus ids when the configured one does not answer.
- Compact clinometer readout when the widget is small, and a finer height grid so it can shrink further.
- Header emblem; tap it for a fullscreen dashboard without header, tabs or status bar.
- Version and build number on the About screen. `npm run bump` keeps `package.json`, `app.json` and the Android
  `versionCode` in step.

### Changed
- The lock button is gone: hold a widget to start editing and press Done to finish.
- Saved widget sizes and positions are converted to the finer grid on first start.

## [0.3.0] - 2026-10-03

### Added
- Clinometer widget (pitch and roll from the tablet's motion sensor), mount-aware, with "Set level here" and fullscreen.
- Logo / picture widget with your own image.
- Per-widget graph type (bars, line, area, off), custom names and labels, thermometer offsets and units.
- About screen with author, blog link and copyright.
- Fullscreen view for any widget.

### Fixed
- The thermometer scanned in low-power mode and missed advertisements; it now scans in low-latency mode and merges
  split BTHome packets. Unreadable packets are explained on the card.

## Before 0.3.0 (not tagged)

- Renogy Smart Shunt 300 over BLE: state of charge, voltage, current, power, temperature and a time estimate.
- Experimental Renogy BT-1 / BT-2 Modbus driver for controllers and DC-DC chargers.
- Xiaomi LYWSD03MMC thermometer (custom pvvx / ATC firmware), read from BLE advertisements without connecting.
- GATT explorer for unknown devices.

These builds were made on the author's tablet before the project went into version control, so they have no tags.
