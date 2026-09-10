# Sketchbook

A local-first vector sketchbook for quick drawing studies.

## MVP contract

- Create multiple named sketches.
- Draw freehand strokes with touch, mouse, or stylus-compatible pointer input exposed through React Native.
- Store stroke points normalized to the canvas so sketches survive resizing without becoming screenshots.
- Choose a small set of brush colors and widths.
- Undo, redo, and clear strokes explicitly.
- Persist sketch data locally with AsyncStorage and fail closed after storage read errors.
- Render strokes with `react-native-svg` on native and web.
- No account, feed, likes, engagement mechanics, analytics, ads, or cloud dependency.

## Boundary

This MVP owns vector sketch state only. Reference images, layers, pressure sensitivity, image/vector export, artwork cataloging, and drawing-study aids should be added only after real use reveals which of them matter.

## Local checks

```sh
bun run verify
```
