import { useEffect, useRef, useState } from 'react';

const features = [
  { title: 'Relevance scoring', description: 'Understand how your target budget and listing recency influence search ranking.' },
  { title: 'Thoughtful filters', description: 'Refine results by city, price, bedrooms, and description keywords.' },
  { title: 'Clearer decisions', description: 'Explore property information, transparent relevance scores, and predictable results.' },
];
const motionQuery = '(prefers-reduced-motion: reduce)';

/** A CSS animation is the only rotation clock; pauses retain its elapsed progress. */
export function EditorialSlideshow() {
  const container = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver !== 'function');
  const [hidden, setHidden] = useState(document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia(motionQuery).matches);
  const running = visible && !focused && !hovered && !hidden && !reducedMotion;

  useEffect(() => {
    const media = window.matchMedia(motionQuery);
    const updateMotion = () => setReducedMotion(media.matches);
    const updateVisibility = () => setHidden(document.hidden);
    media.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateVisibility);
    const observer = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting)))
      : null;
    if (container.current) observer?.observe(container.current);
    return () => {
      observer?.disconnect();
      media.removeEventListener('change', updateMotion);
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);

  function next() {
    setIndex(current => (current + 1) % features.length);
  }

  return <div ref={container} className="editorial-slideshow" role="group" aria-roledescription="carousel"
    aria-label="Search features" onFocusCapture={() => setFocused(true)}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
    onPointerEnter={event => { if (event.pointerType !== 'touch') setHovered(true); }}
    onPointerLeave={() => setHovered(false)}>
    <div className="perspective-features" aria-live="off">
      {features.map((feature, featureIndex) => <div key={feature.title} className="editorial-slide"
        role="group" aria-roledescription="slide" aria-label={`${featureIndex + 1} of ${features.length}`}
        aria-hidden={featureIndex !== index}>
        <span className="feature-number" aria-hidden="true">0{featureIndex + 1}</span>
        <div><h3>{feature.title}</h3><p>{feature.description}</p></div>
      </div>)}
    </div>
    <div className="editorial-controls">
      <span className="editorial-track" aria-hidden="true">
        <span key={index} className="editorial-progress"
          style={{ animationPlayState: running ? 'running' : 'paused' }}
          onAnimationEnd={event => {
            // The completed fill advances once; the next keyed fill starts at zero.
            if (running && event.animationName === 'editorial-progress') next();
          }} />
      </span>
      <button type="button" className="editorial-next" aria-label="Next feature" onClick={next}>
        Next <span aria-hidden="true">→</span>
      </button>
    </div>
  </div>;
}
