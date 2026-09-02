import { BACKDROP_INDEX, columns } from './index-content';
import './index-columns.css';

const LANES = columns(BACKDROP_INDEX, 3);

/*
 * A printed index as a wall - dish, leader dots, time on the hob - in three
 * lanes drifting at three speeds so it never lines up into a readable block.
 *
 * Structure only. Every colour, size and rhythm comes from the `--ix-*`
 * properties the screen around it sets, because the sign-in screen and the
 * design study want the same wall at different weights.
 *
 * The listing is decoration, not data - see `index-content.ts`.
 */
export function IndexColumns() {
  return (
    <div className="ix-wall" aria-hidden="true">
      {LANES.map((lane, index) => (
        <div className="ix-col" key={index} data-lane={index}>
          <div className="ix-track">
            {/* the lane is printed twice so the drift loops without a seam */}
            {[0, 1].map((pass) => (
              <ul className="ix-list" key={pass}>
                {lane.map((entry) => (
                  <li className="ix-entry" key={entry.title}>
                    <span className="ix-dish">{entry.title}</span>
                    <span className="ix-dots" />
                    <span className="ix-time">{entry.time}</span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
