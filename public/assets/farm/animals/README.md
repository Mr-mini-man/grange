# Animal animation frames

The `pig/`, `sheep/`, `cow/`, and `hen/` directories each contain twelve lossless,
transparent WebP frames cropped from the corresponding user-provided 1254 × 1254 PNG sheet.
The original source sheets are not committed because each exceeds the repository's 1 MiB
per-file limit.

Frame names follow the sheet's visual rows:

- `idle-01`–`02`: standing, including a blink.
- `walk-01`–`04`: walking cycle.
- `feed-01`–`04`: grazing, rooting, or pecking cycle.
- `rest-01`–`02`: resting cycle.

Each species' `manifest.json` records the source sheet's zero-based slot `[column, row]`
and the exact `[x, y, width, height]` `sourceRect` of each tight crop. These are *not*
uniform 313.5-pixel cells: several drawings cross a nominal grid line. To align frames
for animation, use their source positions relative to a common slot origin rather than
centering each differently sized crop independently. No animal behavior or scene placement
is included yet.
