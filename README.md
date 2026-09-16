# Airport sign complete flash station

Static GitHub Pages UI for provisioning ESP32-S3 airport signs over USB with Web Serial. One run performs a full erase, writes the boot/application image at `0x0`, writes the FATFS Chinese font assets at `0x820000`, verifies the writes, and hard-resets the board.

## Flash a board

1. Open the site in a current Chrome or Edge browser over HTTPS.
2. Connect one board by USB. Close serial monitors and other programs using the port.
3. Click **Choose USB port** and select the ESP32-S3 USB JTAG/serial device.
4. Click **Erase and flash complete package**.
5. Wait for full erase and combined write to reach 100%. The green completion panel appears only after both images are verified and the board reset is requested.

The flasher first tries the automatic ESP32-S3 reset sequence. If the board does not answer, put it in download mode by holding **BOOT**, tapping **RESET**, then releasing **BOOT**, and retry.

## Firmware package

`firmware/manifest.json` is the package contract. It pins the target, flash settings, image addresses, sizes, and SHA-256 hashes for:

- `firmware/airport-display.bin` at `0x0`
- `firmware/assets.bin` at `0x820000`

The page checks both bundled files against the manifest before it touches the board. Choosing another local `.bin` replaces only the boot/application image; the bundled Chinese font assets are still written after the full erase.

To refresh the package from the ESP-IDF project:

```sh
idf.py -B build-font-luna merge-bin
cp build-font-luna/merged-binary.bin ../github-pages/firmware/airport-display.bin
cp build-font-luna/assets.bin ../github-pages/firmware/assets.bin
```

Update the sizes and SHA-256 values in `firmware/manifest.json`, then run:

```sh
node --test tests/test-flasher.mjs
```

## Publish

Enable **Settings → Pages → Deploy from a branch** for this repository. GitHub Pages provides the secure context required by Web Serial; the flasher does not require Wi-Fi, login, or a backend.
