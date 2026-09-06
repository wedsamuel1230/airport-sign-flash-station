# Airport sign initial flash station

Static GitHub Pages UI for provisioning ESP32-S3 airport signs over USB. It flashes one board at a time using Web Serial.

## Publish

Copy the files in this folder to a GitHub repository, then enable **Settings → Pages → Deploy from a branch**. GitHub Pages serves the static files without a backend.

## Flash a board

1. Use Chrome or Edge on macOS or Windows.
2. Build the firmware and create the merged image with `idf.py merge-bin`.
3. Connect one board by USB.
4. Hold **BOOT**, press and release **RESET**, then release **BOOT**.
5. Choose the merged `.bin`, click **Choose USB port and flash**, and select the `/dev/cu.*` or `COM*` port.
6. Wait for erase and write to reach 100%, then disconnect the completed board and connect the next one.

The page performs a full erase, writes the merged image at address `0x0`, and closes the serial connection after success. It does not require Wi-Fi, login, a server, or the device portal.

## Bundled firmware

Place the approved merged image at `firmware/airport-display.bin`. The page loads it automatically and displays its filename and size. Operators can click **Choose another firmware** to use a different local `.bin` when needed.
