import { track } from '../analytics/analytics';
import {
  hasExactPosition,
  placeName,
  projectStatusLabel,
  aTypeOf,
  type Project,
  type ProjectImage,
} from '../data/project';
import { formatCoordinates } from '../lib/geo';
import { ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon } from './icons';
import { LoadedImage } from './LoadedImage';
import { ProjectConcept } from './ProjectConcept';
import { ProjectGallery } from './ProjectGallery';
import { ScrollLink } from './ScrollLink';

interface ProjectHeadingProps {
  project: Project;
  onBack: () => void;
}

/** The project's name, laid over the globe's close-up at the top of its page. */
export function ProjectHeading({ project, onBack }: ProjectHeadingProps) {
  const { location } = project;
  return (
    <div className="heading" key={project.slug}>
      <button type="button" className="heading__back" onClick={onBack}>
        <ArrowLeftIcon />
        All projects
      </button>
      <div className="heading__body">
        <p className="heading__eyebrow">
          {project.typeLabel} · {placeName(location)}
        </p>
        <h2 className="heading__title" id="project-title">
          {project.title}
        </h2>
        <p className="heading__coords">
          {hasExactPosition(location) ? `${formatCoordinates(location.lat, location.lng)} · ` : ''}
          {project.year}
        </p>
      </div>
      {/* Only on narrow screens, where the globe fills the first screen and the details start below it. */}
      <ScrollLink className="heading__scroll" to="project-page">
        <ArrowDownIcon />
        <span>Project details</span>
      </ScrollLink>
    </div>
  );
}

interface ProjectPageProps {
  project: Project;
  previous: Project;
  next: Project;
  onOpen: (projectId: string) => void;
  onContact: () => void;
}

function Photo({ image, className }: { image: ProjectImage; className: string }) {
  return (
    <figure className={className}>
      <LoadedImage src={image.src} alt={image.alt} loading="lazy" decoding="async" />
    </figure>
  );
}

/** Everything about one project, below the horizon of the zoomed-in globe. */
export function ProjectPage({ project, previous, next, onOpen, onContact }: ProjectPageProps) {
  const { location } = project;

  return (
    <article className="project-page" id="project-page" aria-labelledby="project-title" key={project.slug}>
      <Photo image={project.hero} className="project-page__hero" />

      <div className="project-page__intro">
        <div className="project-page__about">
          <h3>Description</h3>
          <p className="project-page__lead">{project.description}</p>
        </div>
        <dl className="facts">
          <div>
            <dt>Status</dt>
            <dd>{projectStatusLabel[project.status]}</dd>
          </div>
          {project.client && (
            <div>
              <dt>Client</dt>
              <dd>{project.client}</dd>
            </div>
          )}
          <div>
            <dt>Location</dt>
            <dd>{placeName(location)}</dd>
          </div>
          <div>
            <dt>{project.status === 'completed' ? 'Year' : 'Expected'}</dt>
            <dd>{project.year}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{project.typeLabel}</dd>
          </div>
        </dl>
      </div>

      <ProjectConcept images={project.conceptImages} description={project.conceptDescription} title={project.title} />

      <ProjectGallery images={project.gallery} title={project.title} />

      <aside className="enquiry" aria-labelledby="enquiry-title">
        <h3 id="enquiry-title">Planning {aTypeOf(project)} of your own?</h3>
        <button
          type="button"
          className="text-action"
          onClick={() => {
            track('contact_cta_click', { cta_location: 'project_page', project_slug: project.slug });
            onContact();
          }}
        >
          Contact us
          <ArrowRightIcon />
        </button>
      </aside>

      <nav className="project-nav" aria-label="More projects">
        {[
          { label: 'Previous project', item: previous },
          { label: 'Next project', item: next },
        ].map(({ label, item }) => (
          <button key={label} type="button" className="project-nav__link" onClick={() => onOpen(item.slug)}>
            <LoadedImage src={item.thumbnail} alt="" loading="lazy" decoding="async" />
            <span className="project-nav__label">{label}</span>
            <span className="project-nav__title">{item.title}</span>
            <span className="project-nav__place">{placeName(item.location)}</span>
          </button>
        ))}
      </nav>
    </article>
  );
}
