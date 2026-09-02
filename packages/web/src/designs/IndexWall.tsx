import { useId } from 'react';
import { AuthError, SignInButton } from '../login/parts';
import { useSignInFlow } from '../login/useSignInFlow';
import { IndexColumns } from '../login/IndexColumns';
import { BACKDROP_INDEX } from '../login/index-content';
import './index-wall.css';

/*
 * Concept 4 - "The Index".
 *
 * The hero is the book itself. The household's whole index runs floor to
 * ceiling behind the sign-in, set as a card-catalog listing - dish, leader
 * dots, time on the hob - drifting at three different speeds. You can see
 * exactly what you are outside of.
 *
 * The sign-in is not a card. It is a band cut edge to edge through the wall:
 * a cream veil over the drifting type, held by two hairlines. Nothing floats,
 * nothing has a shadow, and the index stays faintly visible behind the words.
 */
export function IndexWall() {
  const flow = useSignInFlow();
  const errorId = useId();

  return (
    <main className="iw">
      <IndexColumns />

      <section className="iw__band" aria-labelledby="iw-heading">
        <div className="iw__band-inner">
          <div className="iw__lede">
            <p className="iw__eyebrow">
              Pior Labs Cookbook <span aria-hidden="true">/</span> {BACKDROP_INDEX.length} recipes
            </p>
            <h1 className="iw__title" id="iw-heading">
              Everything the house
              <br />
              knows how to <em>cook.</em>
            </h1>
          </div>

          <div className="iw__act">
            <AuthError id={errorId} message={flow.error} className="iw__error" />
            <SignInButton flow={flow} className="iw__btn" errorId={errorId} />
            <p className="iw__note">One shared book. Approved accounts only.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
