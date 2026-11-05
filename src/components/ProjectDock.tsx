import { useLayoutEffect, useRef } from 'react';
import type { Project } from '../data/project';
import { PREVIEW_SIZE, sizedSrc } from '../lib/pictureSizes';
import { LoadedImage } from './LoadedImage';

/** Waits for the strip, and the clicked photo with it, to fade out first. */
const FADE_DELAY_MS = 300;
const FADE_MS = 700;

interface ProjectDockProps {
  project: Project;
  reducedMotion: boolean;
}

/**
 * The project's photograph, held to the right of the globe's close-up. It
 * fades in where it belongs once the strip has faded out.
 */
export function ProjectDock({ project, reducedMotion }: ProjectDockProps) {
  const dockRef = useRef<HTMLElement>(null);

  // The parent remounts the dock for each project, so this runs as each photo first appears.
  useLayoutEffect(() => {
    const dock = dockRef.current;
    if (!dock || reducedMotion) return;
    // Only opacity and transform, which the GPU compositor animates smoothly while the page sets up the project view.
    const fade = dock.animate([{ opacity: 0, transform: 'scale(0.985)' }, { opacity: 1, transform: 'none' }], {
      duration: FADE_MS,
      delay: FADE_DELAY_MS,
      easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
      fill: 'backwards',
    });
    // React runs effects twice in development; without this the second run would stack a second fade.
    return () => fade.cancel();
  }, [reducedMotion]);

  return (
    // The card's preview sits underneath, already loaded, so the dock is never blank while its own photo loads.
    <figure ref={dockRef} className="dock" style={{ backgroundImage: `url(${sizedSrc(project.thumbnail, PREVIEW_SIZE)})` }}>
      <LoadedImage src={project.hero.src} alt={project.hero.alt} decoding="async" />
    </figure>
  );
}
