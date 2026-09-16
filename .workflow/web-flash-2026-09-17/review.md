# Web flash completion review

## Root causes

1. `index.html` replaced the file input handler installed by `flasher.js`, so a locally selected image changed the label while the flasher retained the old bundled image.
2. A full erase was followed by a write at `0x0` only. The required FATFS Chinese font assets at `0x820000` were erased and never restored.
3. Connection cleanup could close the same serial port twice and the retry path depended on one error-message substring.
4. GitHub Pages module URLs were unversioned, so a newly deployed HTML page could execute an older cached flasher module.

## Final behavior

- A manifest pins the ESP32-S3 target, 16 MB DIO/80 MHz flash settings, two addresses, sizes, and SHA-256 hashes.
- Bundled images are checked before device erase.
- A local application override does not replace the required assets image.
- The page reuses one previously granted Espressif port, tries the automatic reset sequence, and retries a board already in download mode.
- One connection owner performs full erase, two-image write, verification, hard reset, and cleanup.
- Versioned module URLs keep the HTML, flasher, and core logic on the same deployment.

## Verification evidence

- Seven deterministic Node tests pass for package addresses, file hashes and sizes, aggregate progress, event ownership, granted-port reuse, module versioning, and rejection of a missing assets partition.
- GitHub Pages deployment `35125819077` completed successfully from commit `861707a`.
- The deployed webpage detected `ESP32-S3 (QFN56) (revision v0.2)` through the approved `303a:1001` port.
- Webpage evidence reached erase `100%`, combined write `100%`, both-image verification, and `Flash complete · board reset` with no page errors.
- The USB device was active again at `/dev/cu.usbmodem11101` after the hard reset.
- `browser-result.png` is the final browser evidence captured after completion.

The physical display pixels were not inspected through a camera. The verified claim is that the deployed webpage wrote and verified both required images, requested the hard reset, and the USB device returned afterward.
