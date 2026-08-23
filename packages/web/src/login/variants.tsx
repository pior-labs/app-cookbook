import { useId, type ReactElement } from 'react';
import { LoginScreen } from './LoginScreen';
import { AuthError, Seal, SignInButton } from './parts';
import { useSignInFlow } from './useSignInFlow';

export interface LoginVariant {
  id: string;
  name: string;
  blurb: string;
  Component: () => ReactElement;
}

/* ------------------------------------------------------------------ */
/* 1 - Ticket Stub: a perforated pass, story on the left, seat right. */
/* ------------------------------------------------------------------ */
function TicketLogin() {
  const flow = useSignInFlow();
  const errorId = useId();

  return (
    <div className="lv-variant v-ticket">
      <div className="v-ticket__card">
        <div className="v-ticket__brand">
          <p className="lv-eyebrow">Admit one</p>
          <h1 className="v-ticket__title">
            A table set for
            <br />
            your household.
          </h1>
          <p className="v-ticket__lede">
            Every recipe the house cooks from, kept in one shared book. This pass is yours.
          </p>
          <div className="v-ticket__meta">
            <span>Cookbook</span>
            <span>Pior Labs</span>
          </div>
        </div>

        <div className="v-ticket__seam" aria-hidden="true" />

        <div className="v-ticket__stub">
          <p className="v-ticket__serial">No. 0417-COOK</p>
          <p className="lv-eyebrow">Your seat</p>
          <h2 className="v-ticket__subtitle">One tap to your recipes.</h2>

          <AuthError id={errorId} message={flow.error} />
          <SignInButton flow={flow} className="v-ticket__btn" errorId={errorId} />
          <p className="lv-note">Approved household accounts only.</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3 - Pinned Recipe Card: the ruled recipe card pinned to a corkboard */
/*     of handwritten scraps.                                          */
/* ------------------------------------------------------------------ */
function PinboardCardLogin() {
  const flow = useSignInFlow();
  const errorId = useId();

  return (
    <div className="lv-variant v-pcard">
      <div className="v-notes__board">
        <article className="v-notes__scrap v-notes__scrap--a" aria-hidden="true">
          <span className="v-notes__pin" />
          <p className="v-notes__scrap-title">lemon pasta</p>
          <p className="v-notes__scrap-body">zest + garlic, off the heat</p>
        </article>
        <article className="v-notes__scrap v-notes__scrap--b" aria-hidden="true">
          <span className="v-notes__pin" />
          <p className="v-notes__scrap-title">sunday soup</p>
          <p className="v-notes__scrap-body">double it, freeze half</p>
        </article>
        <article className="v-notes__scrap v-notes__scrap--c" aria-hidden="true">
          <span className="v-notes__pin" />
          <p className="v-notes__scrap-body">buy: basil, lemons, good bread</p>
        </article>

        <div className="v-card__sheet">
          <span className="v-notes__pin v-notes__pin--main" />
          <span className="v-card__tab">Cookbook</span>
          <header className="v-card__head">
            <Seal />
            <span className="lv-wordmark">Pior Labs</span>
          </header>

          <p className="lv-eyebrow">Household access</p>
          <h1 className="v-card__title">
            Welcome back to
            <br />
            the <em>kitchen.</em>
          </h1>
          <p className="v-card__body">
            Your household cookbook - every recipe you've saved, the notes that make them yours, and
            whatever you decide to make tonight.
          </p>

          <AuthError id={errorId} message={flow.error} />
          <SignInButton flow={flow} errorId={errorId} />
          <p className="lv-note">Private by design. Only approved household accounts can enter.</p>
        </div>
      </div>
    </div>
  );
}

export const LOGIN_VARIANTS: LoginVariant[] = [
  {
    id: 'ticket',
    name: 'Ticket Stub',
    blurb: 'A perforated pass - story on the left, your seat on the stub.',
    Component: TicketLogin,
  },
  {
    id: 'frosted-card',
    name: 'Frosted Recipe Card (live)',
    // The chosen concept, so the gallery shows the real sign-in screen rather
    // than a copy of it that could drift away from what people actually see.
    blurb: 'The ruled recipe card floated as glass over drifting mesh. Shipped as the login screen.',
    Component: LoginScreen,
  },
  {
    id: 'pinboard-card',
    name: 'Pinned Recipe Card',
    blurb: 'The ruled recipe card pinned to the corkboard of scraps.',
    Component: PinboardCardLogin,
  },
];
