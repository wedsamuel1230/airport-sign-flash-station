# Airport display batch flash station

Static GitHub Pages station for provisioning several ESP32-S3 airport signs over USB with Web Serial. Each selected board receives a full erase, the boot and application image at `0x0`, the regional Chinese font assets at `0x820000`, verification, and a hard reset into the application.

## Run a batch

1. Open the published station in current Chrome or Edge over HTTPS.
2. Connect the boards. Use a powered USB hub when the boards and displays draw more power than the computer can provide reliably.
3. Click **Add USB board** once for every new device and choose its ESP32 USB JTAG/serial port. Previously approved ports are restored by **Find approved boards** and on page load.
4. Keep the required boards selected, then click **Flash selected boards**.
5. Wait until every row says **Complete** or **Needs attention**. Two boards flash in parallel and additional boards wait automatically.
6. If a verified board remains blank, select it and click **Reset selected boards**. This re-enters the loader and sends a hard reset without erasing flash.

The native Web Serial chooser grants one port per click. The browser does not provide a multi-select chooser, so each new board must be approved once. The station can then keep all approved devices in one batch.

Every flash run performs a full erase. Existing firmware and saved settings are removed. A failure on one USB port is isolated to that row and does not cancel the other boards.

## Screen startup and recovery

After reset, the firmware mounts the FATFS asset partition and creates the regional font instances before LVGL draws the first screen. A short blank interval is expected. The serial log now reports asset, LCD, font, and first-frame-task milestones so a slow boot can be measured.

If the browser cannot enter download mode automatically:

1. Hold **BOOT**.
2. Tap **RESET**.
3. Release **BOOT**.
4. Retry the failed row.

Close serial monitors and development tools before flashing because only one process can own each port.

## Firmware package

`firmware/manifest.json` is the package contract. It pins the target, flash settings, image addresses, sizes, and SHA-256 hashes for:

- `firmware/airport-display.bin` at `0x0`
- `firmware/assets.bin` at `0x820000`

The page checks both bundled files against the manifest before enabling batch flash. Choosing another local `.bin` replaces only the boot and application image; the bundled regional font assets are still written after the full erase.

To refresh the package from the ESP-IDF project:

```sh
idf.py -B build-font-luna build
idf.py -B build-font-luna merge-bin
cp build-font-luna/merged-binary.bin ../github-pages/firmware/airport-display.bin
cp build-font-luna/assets.bin ../github-pages/firmware/assets.bin
```

Update the sizes and SHA-256 values in `firmware/manifest.json`, then run:

```sh
node --test tests/test-flasher.mjs
```

## Publish

GitHub Pages supplies the secure context required by Web Serial. This station needs no Wi-Fi, login, or backend. The workflow in `.github/workflows/pages.yml` publishes the repository after changes reach `main`.

The port permission and reset behavior follow the [Web Serial specification](https://wicg.github.io/serial/) and [Espressif esptool-js reset flow](https://github.com/espressif/esptool-js/blob/main/README.md).
