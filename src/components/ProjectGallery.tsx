import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type SyntheticEvent } from 'react';
import type { ProjectImage } from '../data/project';
import { layoutMasonry, PLACEHOLDER_RATIO, stepIndex } from '../lib/gallery';
import { FULL_SIZE, sizedSrc } from '../lib/pictureSizes';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from './icons';
import { LoadedImage } from './LoadedImage';

/** A sideways drag at least this long on the picture moves to the next or previous one. */
const SWIPE_PX = 50;

interface ProjectGalleryProps {
  images: ProjectImage[];
  title: string;
}

/** A project's photos in columns under its details, each at its own shape; each opens the viewer at that photo. */
export function ProjectGallery({ images, title }: ProjectGalleryProps) {
  const [open, setOpen] = useState<number | null>(null);
  if (images.length === 0) return null;

  return (
    <section className="gallery" aria-labelledby="gallery-title">
      <h3 id="gallery-title">Photos</h3>
      <PhotoGrid images={images} onOpen={setOpen} />
      {open !== null && <PhotoViewer images={images} start={open} title={title} onClose={() => setOpen(null)} />}
    </section>
  );
}

interface PhotoGridProps {
  images: ProjectImage[];
  onOpen: (index: number) => void;
}

/** What the layout needs from the page: how wide the grid is, and the gap its stylesheet sets between photos. */
interface GridSize {
  width: number;
  gap: number;
}

/**
 * The photos in columns of one width, each at its own shape and set under the
 * shortest column so far. The list stays in photo order, so the Tab order and
 * the viewer's numbering follow it; only each photo's position is calculated.
 * A photo's shape is known once it has loaded; until then it holds a 4:3 place.
 */
function PhotoGrid({ images, onOpen }: PhotoGridProps) {
  const gridRef = useRef<HTMLUListElement>(null);
  const [size, setSize] = useState<GridSize | null>(null);
  const [ratios, setRatios] = useState<Partial<Record<string, number>>>({});

  // The columns follow the grid's width; the gap follows the screen's (see `.gallery__grid`), which can change on its own.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const measure = () => {
      const width = grid.clientWidth;
      const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
      setSize((current) => (current?.width === width && current.gap === gap ? current : { width, gap }));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // The shape comes from the photo's preview; the sharper copy that follows keeps the place it was given.
  const handleLoad = (src: string, event: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    setRatios((current) => (current[src] ? current : { ...current, [src]: naturalWidth / naturalHeight }));
  };

  const layout =
    size && size.width > 0 ? layoutMasonry(images.map((image) => ratios[image.src] ?? PLACEHOLDER_RATIO), size.width, size.gap) : null;

  // Until the grid has been measured the photos have no place, so they stay hidden and unloaded rather than all fetching at once.
  return (
    <ul ref={gridRef} className="gallery__grid" style={layout ? { height: layout.height } : { visibility: 'hidden' }}>
      {images.map((image, index) => (
        <li key={image.src} style={layout?.tiles[index]}>
          <button
            type="button"
            className="gallery__item"
            aria-label={`Open photo ${index + 1} of ${images.length}: ${image.alt}`}
            onClick={() => onOpen(index)}
          >
            {layout && (
              <LoadedImage src={image.src} alt="" loading="lazy" decoding="async" onLoad={(event) => handleLoad(image.src, event)} />
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

interface PhotoViewerProps {
  images: ProjectImage[];
  start: number;
  title: string;
  onClose: () => void;
}

/**
 * The photos one at a time, over the page. Previous and Next, the arrow keys
 * or a swipe move through them, wrapping round at either end, and the row of
 * small photos below jumps straight to any one. Escape, the close button or
 * a click beside the photo closes it.
 */
export function PhotoViewer({ images, start, title, onClose }: PhotoViewerProps) {
  const [index, setIndex] = useState(start);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const thumbsRef = useRef<HTMLOListElement>(null);
  const swipe = useRef<{ from: number; swiped: boolean } | null>(null);
  const count = images.length;
  const image = images[index];

  // A modal dialog keeps focus and the keyboard inside it, and hands focus back to the photo that opened it.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // Keep the current small photo in view, and fetch the neighbours so stepping to them is instant.
  useEffect(() => {
    thumbsRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    for (const by of [-1, 1]) new Image().src = sizedSrc(images[stepIndex(index, by, count)].src, FULL_SIZE);
  }, [index, images, count]);

  const step = (by: number) => setIndex((current) => stepIndex(current, by, count));
  const close = () => dialogRef.current?.close();

  const handleKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    // The project page also listens for these (to change project, or close it); while the viewer is open they are its own.
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Escape') event.stopPropagation();
    if (event.key === 'ArrowLeft') step(-1);
    if (event.key === 'ArrowRight') step(1);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    swipe.current = { from: event.clientX, swiped: false };
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!swipe.current || count < 2) return;
    const distance = event.clientX - swipe.current.from;
    if (Math.abs(distance) < SWIPE_PX) return;
    swipe.current.swiped = true;
    step(distance < 0 ? 1 : -1);
  };

  // A click on the space around the photo closes the viewer, unless it ends a swipe.
  const handleStageClick = (event: MouseEvent<HTMLDivElement>) => {
    const swiped = swipe.current?.swiped ?? false;
    swipe.current = null;
    if (event.target === event.currentTarget && !swiped) close();
  };

  return (
    <dialog ref={dialogRef} className="viewer" aria-label={`${title}: photos`} onKeyDown={handleKeyDown} onClose={onClose}>
      <div className="viewer__bar">
        <p className="viewer__count" aria-live="polite">
          {index + 1} / {count}
        </p>
        <button type="button" className="icon-button" aria-label="Close photos" onClick={close}>
          <CloseIcon />
        </button>
      </div>

      <div className="viewer__stage" onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onClick={handleStageClick}>
        <LoadedImage className="viewer__image" src={image.src} size={FULL_SIZE} alt={image.alt} decoding="async" draggable={false} />
        {count > 1 && (
          <>
            <button type="button" className="icon-button viewer__step viewer__step--previous" aria-label="Previous photo" onClick={() => step(-1)}>
              <ChevronLeftIcon />
            </button>
            <button type="button" className="icon-button viewer__step viewer__step--next" aria-label="Next photo" onClick={() => step(1)}>
              <ChevronRightIcon />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <ol className="viewer__thumbs" ref={thumbsRef}>
          {images.map((item, itemIndex) => (
            <li key={item.src}>
              <button
                type="button"
                className="viewer__thumb"
                aria-label={`Photo ${itemIndex + 1}: ${item.alt}`}
                aria-current={itemIndex === index ? 'true' : undefined}
                onClick={() => setIndex(itemIndex)}
              >
                <LoadedImage src={item.src} alt="" loading="lazy" decoding="async" draggable={false} />
              </button>
            </li>
          ))}
        </ol>
      )}
    </dialog>
  );
}
