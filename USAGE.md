# Usage

## Images

Use EmDash's native **Image** block for new images. In the full admin editor,
type `/` in a rich text field and choose **Image**. Use the image controls to
set alt text, captions, links, alignment, and display dimensions.

Imported aligned and linked images also use native image blocks. The theme
preserves their text wrapping and legacy dimensions. Check the public page
after changing alignment or replacing an image, especially when the replacement
has a different aspect ratio.

Use a cropped copy when the original must remain available. Replacing media
preserves its ID and URL but overwrites its bytes without history. See
[Media Editing](docs/launch-checklist.md#media-editing) for cache behavior.

## Remaining custom blocks

The full EmDash admin editor provides these blocks in the slash menu:

- **Legacy video**, in **Media**, preserves imported playlist video URLs,
  titles, MIME types, and intrinsic width and height.
- **Legacy embed**, in **Media**, preserves imported embeds such as Animoto.
  Its fields include the source URL, embed URL, provider, and title.
- **Legacy page list**, in **Content**, renders the dynamic page list and has
  no editable fields.

Use native blocks for new content when they provide the needed behavior.
Edit the remaining custom blocks in the full admin editor. The inline overlay
preserves them but does not provide their full custom editing controls.
