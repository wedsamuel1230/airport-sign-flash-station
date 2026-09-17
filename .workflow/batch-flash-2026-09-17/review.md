# Batch flash station review

## Accepted behavior

- Previously approved ESP32-S3 Web Serial ports appear as separate board rows.
- Operators can add more ports without replacing the existing queue.
- At most two erase and write operations run concurrently; later boards wait.
- One failed worker is recorded without cancelling the remaining queue.
- Every successful flash writes both manifest segments, verifies them, and calls the ESP32-S3 USB hard reset path.
- A separate Reset selected boards action does not erase flash.
- The BOOT factory-reset hint is 44 pixels higher, uses a 24 pixel label, and leaves a 14 pixel bottom safe area below the final system row.

## Verification

- `node --test tests/test-flasher.mjs`: 11 passed.
- Mocked five-board browser run: maximum concurrency 2, five reset calls, five complete, zero failures.
- Desktop light layout: three board rows, no horizontal overflow, package ready, both batch actions enabled.
- Mobile dark layout: one board row, no horizontal overflow, dark palette active.
- Browser console: zero errors after the favicon fix.
- Firmware host suite: passed, including regional fonts, portal contract, release gate, and display safe-area check.
- ESP-IDF 6.0.2 build and merged binary generation: passed.

Screenshots are saved beside this review as `browser-light.png` and `browser-dark-mobile.png`.
