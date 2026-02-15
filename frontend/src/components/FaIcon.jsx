/**
 * FontAwesome inline SVG icon component.
 * Loads SVGs from assets/fontawesome/svgs/solid/ via Vite ?raw imports.
 * @fa-solid alias defined in vite.config.js → ../assets/fontawesome/svgs/solid
 */

// ── Stats card icons ──
import landmarkDome from '@fa-solid/landmark-dome.svg?raw';
import buildingCircleCheck from '@fa-solid/building-circle-check.svg?raw';
import magnifyingGlass from '@fa-solid/magnifying-glass.svg?raw';
import listCheck from '@fa-solid/list-check.svg?raw';
import fileCircleExclamation from '@fa-solid/file-circle-exclamation.svg?raw';
import gavel from '@fa-solid/gavel.svg?raw';
import stamp from '@fa-solid/stamp.svg?raw';
import calendarXmark from '@fa-solid/calendar-xmark.svg?raw';
import sackDollar from '@fa-solid/sack-dollar.svg?raw';
import vault from '@fa-solid/vault.svg?raw';

// ── Dashboard header/section icons ──
import building from '@fa-solid/building.svg?raw';
import scaleBalanced from '@fa-solid/scale-balanced.svg?raw';
import userGroup from '@fa-solid/user-group.svg?raw';
import shieldHalved from '@fa-solid/shield-halved.svg?raw';
import fileLines from '@fa-solid/file-lines.svg?raw';
import triangleExclamation from '@fa-solid/triangle-exclamation.svg?raw';

const ICONS = {
  // Stats cards (top row)
  'landmark-dome': landmarkDome,
  'building-circle-check': buildingCircleCheck,
  'magnifying-glass': magnifyingGlass,
  'list-check': listCheck,
  'file-circle-exclamation': fileCircleExclamation,
  gavel,
  // Stats cards (bottom row — decisions)
  stamp,
  'calendar-xmark': calendarXmark,
  'sack-dollar': sackDollar,
  vault,
  // Dashboard headers & buttons
  building,
  'scale-balanced': scaleBalanced,
  'user-group': userGroup,
  'shield-halved': shieldHalved,
  'file-lines': fileLines,
  'triangle-exclamation': triangleExclamation,
};

/**
 * Render a FontAwesome solid icon as inline SVG.
 * @param {string} name — icon name (e.g. "gavel", "landmark-dome")
 * @param {string} className — Tailwind classes for sizing & color
 */
export default function FaIcon({ name, className = 'w-5 h-5' }) {
  const raw = ICONS[name];
  if (!raw) return null;

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
      <g dangerouslySetInnerHTML={{ __html: pathMatch[0].replace(/fill="currentColor"\s*/g, '') }} />
    </svg>
  );
}
