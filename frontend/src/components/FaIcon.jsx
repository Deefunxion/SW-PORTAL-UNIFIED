/**
 * FontAwesome inline SVG icon component.
 * Loads SVGs from assets/fontawesome/svgs/solid/ via Vite ?raw imports.
 */

// Solid icons used across the oversight module
// @fa-solid alias defined in vite.config.js → ../assets/fontawesome/svgs/solid
import building from '@fa-solid/building.svg?raw';
import circleCheck from '@fa-solid/circle-check.svg?raw';
import clipboardList from '@fa-solid/clipboard-list.svg?raw';
import clipboardCheck from '@fa-solid/clipboard-check.svg?raw';
import fileLines from '@fa-solid/file-lines.svg?raw';
import scaleBalanced from '@fa-solid/scale-balanced.svg?raw';
import clock from '@fa-solid/clock.svg?raw';
import ban from '@fa-solid/ban.svg?raw';
import euroSign from '@fa-solid/euro-sign.svg?raw';
import shieldHalved from '@fa-solid/shield-halved.svg?raw';
import triangleExclamation from '@fa-solid/triangle-exclamation.svg?raw';
import userGroup from '@fa-solid/user-group.svg?raw';

const ICONS = {
  building,
  'circle-check': circleCheck,
  'clipboard-list': clipboardList,
  'clipboard-check': clipboardCheck,
  'file-lines': fileLines,
  'scale-balanced': scaleBalanced,
  clock,
  ban,
  'euro-sign': euroSign,
  'shield-halved': shieldHalved,
  'triangle-exclamation': triangleExclamation,
  'user-group': userGroup,
};

/**
 * Render a FontAwesome solid icon as inline SVG.
 * @param {string} name — icon name (e.g. "building", "scale-balanced")
 * @param {string} className — Tailwind classes for sizing & color (e.g. "w-5 h-5 text-blue-600")
 */
export default function FaIcon({ name, className = 'w-5 h-5' }) {
  const raw = ICONS[name];
  if (!raw) return null;

  // Strip the wrapping <svg ...> tag attributes and re-apply with our className
  const pathMatch = raw.match(/<path[\s\S]*?\/>/);
  const viewBoxMatch = raw.match(/viewBox="([^"]+)"/);
  if (!pathMatch) return null;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBoxMatch ? viewBoxMatch[1] : '0 0 512 512'}
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      {/* Use dangerouslySetInnerHTML only for the path — content is static from bundled FA SVGs */}
      <g dangerouslySetInnerHTML={{ __html: pathMatch[0].replace(/fill="currentColor"\s*/g, '') }} />
    </svg>
  );
}
