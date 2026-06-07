# Usage

This file documents repo-specific authoring features that are not part of plain EmDash behavior.

## Legacy image block

Use **Legacy image** when you need image behavior that standard EmDash images do not support here, especially:

- left- or right-aligned images with text wrapping
- centered legacy images
- images that should link to another URL

Standard EmDash images should still be the default choice when you do not need those behaviors.

## Where to create it

Create and edit **Legacy image** blocks in the **full EmDash admin editor**.

The inline edit overlay preserves these blocks, but it does not provide the full custom editing UI for them.

## How to insert one

1. Open the full EmDash admin editor for the page or post.
2. Click inside the rich text field.
3. Type `/` to open the slash menu.
4. Choose **Legacy image** from the **Media** group.

## Fields

- **Image**: choose an image from the image picker
- **Alt text**: accessibility text for the image
- **Caption**: optional visible caption
- **Link URL**: optional URL to wrap the image in a link
- **Alignment**: `None`, `Left`, `Right`, or `Center`
- **Width** and **Height**: optional dimensions for legacy sizing

## When to use it

- Use a standard image block for normal inline content.
- Use **Legacy image** only when you need wrapped text or linked-image behavior that must survive future EmDash edits.

## Notes

- Existing legacy content may still render correctly without manual edits.
- To make old imported aligned or linked images durable through future edits, they need to exist in content as `legacyImage` blocks rather than standard image blocks.
- The slash menu appears when you type `/` in the rich text editor.
