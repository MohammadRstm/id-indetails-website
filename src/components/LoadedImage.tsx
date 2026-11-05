import { useLayoutEffect, useRef, useState, type ImgHTMLAttributes } from 'react';
import { PREVIEW_SIZE, sizedSrc, sizeToFill } from '../lib/pictureSizes';

type LoadedImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  /** The copy to load (its longest side in px). Without it, the copy that fills the photo's place, after a preview. */
  size?: number;
};

/**
 * A photo from the API at the size its place shows it at (README, "Loading the photos").
 *
 * It starts as the smallest copy, a few KB that show almost at once, softly. Once that has loaded, the photo's shape
 * and its place's size say which copy is sharp enough, and that one is asked for. The browser keeps the preview on
 * screen until the new copy has fully loaded, then swaps it in whole.
 *
 * With a `size`, only that copy loads. It stays invisible until it has fully loaded, then fades in (see
 * `img[data-loaded]` in the styles): large photos would otherwise appear a band at a time from the top.
 */
export function LoadedImage(props: LoadedImageProps) {
  // a new photo starts again from its preview
  return <SizedImage key={props.src} {...props} />;
}

function SizedImage({ src, size, onLoad, ...props }: LoadedImageProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const preview = sizedSrc(src, PREVIEW_SIZE);
  const [shown, setShown] = useState(() => (size ? sizedSrc(src, size) : preview));

  // A photo already in the cache shows at once rather than fading in; its load event still follows.
  useLayoutEffect(() => {
    const image = imageRef.current;
    if (image) image.dataset.loaded = String(image.complete && image.naturalWidth > 0);
  }, []);

  return (
    <img
      ref={imageRef}
      data-loaded="false"
      {...props}
      src={shown}
      onLoad={(event) => {
        const image = event.currentTarget;
        image.dataset.loaded = 'true';
        if (shown === preview) setShown(sizedSrc(src, fillSizeOf(image)));
        onLoad?.(event);
      }}
    />
  );
}

/** The copy the image's place needs, measured once its preview is up: the place's laid-out size and the photo's shape. */
function fillSizeOf(image: HTMLImageElement): number {
  const fit = getComputedStyle(image).objectFit === 'contain' ? 'contain' : 'cover';
  return sizeToFill(
    { width: image.clientWidth, height: image.clientHeight },
    { width: image.naturalWidth, height: image.naturalHeight },
    window.devicePixelRatio || 1,
    fit,
  );
}
