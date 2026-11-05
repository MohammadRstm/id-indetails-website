import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ComponentType } from 'react';
import type { Office } from '../data/offices';
import { placeName, type Project } from '../data/project';
import { loadGlobeStage, siteGlobeQuality, type GlobeStageModule } from '../globe/preload';
import { useMediaQuery, usePrefersReducedMotion } from '../hooks/useMediaQuery';
import { conveyorProjects } from '../lib/conveyor';
import { groupByLocation } from '../lib/geo';
import { PREVIEW_SIZE, sizedSrc } from '../lib/pictureSizes';
import { HomeProjects } from './HomeProjects';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';
import { MotionToggle } from './MotionToggle';
import { ProjectCaption } from './ProjectCaption';
import { ProjectDock } from './ProjectDock';
import { ProjectHeading, ProjectPage } from './ProjectPage';
import { ProjectStrip } from './ProjectStrip';

// three.js and the globe are most of the site's code, so they load on their own (see globe/preload.ts).
// Should the download fail, the page goes on without a globe: every project is still listed.
const GlobeStage = lazy<ComponentType<ComponentProps<GlobeStageModule['GlobeStage']>>>(() =>
  loadGlobeStage().then(
    (module) => ({ default: module.GlobeStage }),
    () => ({ default: () => null }),
  ),
);

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]') !== null;

interface ExplorerProps {
  /** Every project: all of them are on the globe; the strip shows those marked for it. */
  projects: Project[];
  /** The studios: red points on the globe. */
  offices: Office[];
  /** The slug of the project whose page is open, from the address bar; null on the globe overview. */
  openSlug: string | null;
  /** False while another page is showing: the explorer stays mounted but hidden and idle. */
  active: boolean;
  onOpenProject: (slug: string) => void;
  onCloseProject: () => void;
  onContact: () => void;
}

/**
 * The landing page and the project pages, without ever leaving the page: the
 * overview shows the globe beside a drifting strip of projects, with every
 * project in a paged grid below; opening one (from the strip, the globe or
 * the grid) slides the strip away, turns the globe to the place and moves in,
 * in the left half of the page's top with the project's photo in the right
 * half and the project's page right below them.
 */
export function Explorer({ projects, offices, openSlug, active, onOpenProject, onCloseProject, onContact }: ExplorerProps) {
  const reducedMotion = usePrefersReducedMotion();
  const narrow = useMediaQuery('(max-width: 959px)');
  const groups = useMemo(() => groupByLocation(projects), [projects]);
  const conveyor = useMemo(() => conveyorProjects(projects), [projects]);
  const inConveyor = (slug: string | null) => conveyor.some((item) => item.slug === slug);
  const [stripSlug, setStripSlug] = useState(() => (inConveyor(openSlug) && openSlug) || conveyor[0].slug);
  const [motionOn, setMotionOn] = useState(true);
  const frameRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const [heroOnScreen, setHeroOnScreen] = useState(true);
  // A visit that starts on another page builds no globe until the globe is first shown; after that it stays.
  const [globeWanted, setGlobeWanted] = useState(active);
  const [quality] = useState(siteGlobeQuality);
  if (active && !globeWanted) setGlobeWanted(true);
  // A low-power device keeps everything still (no drifting strip, no ripples or route flow), so it has nothing to pause.
  const canMove = !reducedMotion && !quality.lowPower;
  const moving = motionOn && canMove;

  // A project from the strip stays selected after its page closes, so the strip comes back at the same card.
  // A project opened from elsewhere (the grid, the globe) leaves the strip where it was.
  const [lastOpenSlug, setLastOpenSlug] = useState(openSlug);
  if (openSlug !== lastOpenSlug) {
    setLastOpenSlug(openSlug);
    if (openSlug !== null && inConveyor(openSlug)) setStripSlug(openSlug);
  }

  const projectOpen = openSlug !== null;
  const stripIndex = Math.max(0, conveyor.findIndex((item) => item.slug === stripSlug));
  const project = (openSlug && projects.find((item) => item.slug === openSlug)) || conveyor[stripIndex];
  const group = groups.find((candidate) => candidate.projects.includes(project)) ?? groups[0];
  // Previous and next move through the strip's projects, or through every project for one that is not in it.
  const sequence = !projectOpen || conveyor.includes(project) ? conveyor : projects;
  const sequenceIndex = Math.max(0, sequence.indexOf(project));
  const at = (offset: number) => sequence[(sequenceIndex + offset + sequence.length) % sequence.length];

  const step = useCallback(
    (direction: 1 | -1) => {
      const next = sequence[(sequenceIndex + direction + sequence.length) % sequence.length];
      if (projectOpen) onOpenProject(next.slug);
      else setStripSlug(next.slug);
    },
    [sequence, sequenceIndex, projectOpen, onOpenProject],
  );

  const openProject = useCallback(
    (slug: string) => {
      if (conveyor.some((item) => item.slug === slug)) setStripSlug(slug);
      onOpenProject(slug);
    },
    [conveyor, onOpenProject],
  );

  const selectGroup = useCallback(
    (groupId: string) => {
      const target = groups.find((candidate) => candidate.id === groupId);
      if (target) openProject(target.projects[0].slug);
    },
    [groups, openProject],
  );

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || isTypingTarget(event.target)) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        step(event.key === 'ArrowRight' ? 1 : -1);
      } else if (event.key === 'Escape' && projectOpen) {
        onCloseProject();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, step, projectOpen, onCloseProject]);

  // Like the globe, the strip stops drifting while it is scrolled out of view, for example down at the grid.
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const observer = new IntersectionObserver(([entry]) => setHeroOnScreen(entry.isIntersecting));
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  // Warm the cache with the preview of the current project's opening photo, so its page appears complete at once.
  useEffect(() => {
    const image = new Image();
    image.src = sizedSrc(project.hero.src, PREVIEW_SIZE);
  }, [project]);

  return (
    <main className="explorer" id={active ? 'content' : undefined} hidden={!active} data-view={projectOpen ? 'project' : 'overview'}>
      <h1 className="visually-hidden">ID-Indetails architecture projects</h1>
      <div className="explorer__stage">
        {globeWanted && (
          <Suspense fallback={null}>
            <GlobeStage
              groups={groups}
              offices={offices}
              activeGroupId={group.id}
              activeProject={project}
              closeUp={projectOpen}
              interactive={!projectOpen}
              animate={moving}
              reducedMotion={reducedMotion}
              quality={quality}
              frameRef={frameRef}
              onSelectGroup={selectGroup}
            />
          </Suspense>
        )}
      </div>

      <div className="explorer__hero" ref={heroRef}>
        <div className="explorer__frame" ref={frameRef} aria-hidden="true" />

        <div className="explorer__strip" inert={projectOpen}>
          <ProjectStrip
            projects={conveyor}
            activeIndex={stripIndex}
            axis={narrow ? 'x' : 'y'}
            drifting={moving}
            running={active && !projectOpen && heroOnScreen}
            reducedMotion={reducedMotion}
            onActiveChange={(next) => setStripSlug(conveyor[next].slug)}
            onOpen={(next) => openProject(conveyor[next].slug)}
          />
        </div>

        <section className="showcase" id="project-controls" tabIndex={-1} aria-label="Projects" inert={projectOpen}>
          <ProjectCaption projects={conveyor} project={conveyor[stripIndex]} onOpen={openProject} />
          <div className="showcase__controls">
            <button type="button" className="icon-button" aria-label="Previous project" onClick={() => step(-1)}>
              <ChevronLeftIcon />
            </button>
            <button type="button" className="icon-button" aria-label="Next project" onClick={() => step(1)}>
              <ChevronRightIcon />
            </button>
            {canMove && <MotionToggle playing={motionOn} onToggle={() => setMotionOn(!motionOn)} />}
          </div>
        </section>

        {projectOpen && (
          <ProjectDock key={project.slug} project={project} reducedMotion={reducedMotion} />
        )}
        {projectOpen && <ProjectHeading project={project} onBack={onCloseProject} />}
      </div>

      {projectOpen && (
        <ProjectPage project={project} previous={at(-1)} next={at(1)} onOpen={openProject} onContact={onContact} />
      )}
      {/* Mounted afresh on each visit, so it starts from the page in the address. */}
      {active && !projectOpen && <HomeProjects projects={projects} reducedMotion={reducedMotion} onOpenProject={openProject} />}

      <p className="visually-hidden" aria-live="polite">
        {projectOpen
          ? `${project.title}, ${placeName(project.location)}. Project page open.`
          : `${project.title}, ${placeName(project.location)}. Project ${stripIndex + 1} of ${conveyor.length}.`}
      </p>
    </main>
  );
}
