/**
 * The API serves a smaller copy of any picture on request (`?size=`, the copy's longest side in px), so a picture
 * downloads at the size its place shows it at rather than whole (README, "Loading the photos").
 */

/** The copies the API keeps, each its longest side in px. It rounds any other size up to one of them. */
export const PICTURE_SIZES = [160, 480, 960, 1920] as const;

/** The smallest copy, a few KB: shown first, softly, while the copy the place needs downloads. */
export const PREVIEW_SIZE = PICTURE_SIZES[0];

/** The largest copy, for a photo shown on its own over the page. */
export const FULL_SIZE = PICTURE_SIZES[PICTURE_SIZES.length - 1];

/** Used when the place has no size yet to measure. */
const UNMEASURED_SIZE = 960;

/** A copy up to a tenth smaller than its place looks just as sharp, and the next copy up is twice as large. */
const SHARP_ENOUGH = 0.9;

/** A picture's address at the given size. Only the API's pictures have copies; any other address is left as it is. */
export function sizedSrc(src: string, size: number): string {
  return /\/files\/\d+$/.test(src) ? `${src}?size=${size}` : src;
}

interface Dimensions {
  width: number;
  height: number;
}

/**
 * The smallest copy that shows the photo sharply in its place: a box of `box` CSS px on a screen with `pixelRatio`
 * device px to each, showing a photo of the shape `photo` (any copy of it will do) as `fit` does. `cover` fills the
 * box and crops the rest of the photo away; `contain` shows the whole photo inside the box.
 */
export function sizeToFill(box: Dimensions, photo: Dimensions, pixelRatio: number, fit: 'cover' | 'contain'): number {
  if (box.width <= 0 || box.height <= 0 || photo.width <= 0 || photo.height <= 0) return UNMEASURED_SIZE;
  const scales = [box.width / photo.width, box.height / photo.height];
  const scale = fit === 'cover' ? Math.max(...scales) : Math.min(...scales);
  const longestSide = Math.max(photo.width, photo.height) * scale * pixelRatio;
  return PICTURE_SIZES.find((size) => size >= longestSide * SHARP_ENOUGH) ?? FULL_SIZE;
}
