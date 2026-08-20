import { useId, type ReactElement } from 'react';
import { AuthError, MeshBackdrop, Seal, SignInButton, useSignInFlow } from './parts';

export interface LoginVariant {
  id: string;
  name: string;
  blurb: string;
  Component: () => ReactElement;
}

/* ------------------------------------------------------------------ */
/* 1 - Index Card: a ruled recipe card with a divider tab.            */
/* ------------------------------------------------------------------ */
function IndexCardLogin() {
  const flow = useSignInFlow();
  const errorId = useId();

  return (
    <div className="lv-variant v-card">
      <div className="v-card__sheet">
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
  );
}

/* ------------------------------------------------------------------ */
/* 2 - Mesh Atmosphere: the package's mesh + grain behind glass.      */
/* ------------------------------------------------------------------ */
function MeshLogin() {
  const flow = useSignInFlow();
  const errorId = useId();

  return (
    <div className="lv-variant v-mesh">
      <MeshBackdrop />

      <div className="v-mesh__card theme-glass">
        <header className="v-mesh__head">
          <Seal />
          <span className="lv-eyebrow">Pior Labs Cookbook</span>
        </header>

        <p className="v-mesh__hand">
          What are we
          <br />
          making tonight?
        </p>
        <p className="v-mesh__sub">
          Sign in to open your household cookbook and pick up right where you left off.
        </p>

        <AuthError id={errorId} message={flow.error} />
        <SignInButton flow={flow} className="v-mesh__btn" errorId={errorId} />
        <p className="lv-note">Private household access</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3 - Ticket Stub: a perforated pass, story on the left, seat right. */
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
/* 4 - Pinned Notes: handwritten scraps on a board, sign-in up front. */
/* ------------------------------------------------------------------ */
function PinnedNotesLogin() {
  const flow = useSignInFlow();
  const errorId = useId();

  return (
    <div className="lv-variant v-notes">
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

        <article className="v-notes__main">
          <span className="v-notes__pin v-notes__pin--main" />
          <header className="v-notes__head">
            <Seal />
            <span className="lv-eyebrow">The household cookbook</span>
          </header>
          <h1 className="v-notes__title">
            Come cook
            <br />
            with us.
          </h1>
          <p className="v-notes__body">
            Everything the household is cooking, kept in one shared book you can reach for anywhere.
          </p>

          <AuthError id={errorId} message={flow.error} />
          <SignInButton flow={flow} className="v-notes__btn" errorId={errorId} />
          <p className="lv-note">Private by design.</p>
        </article>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 5 - Bill of Fare: a menu with dotted leaders, quiet and editorial. */
/* ------------------------------------------------------------------ */
function MenuLogin() {
  const flow = useSignInFlow();
  const errorId = useId();

  return (
    <div className="lv-variant v-menu">
      <div className="v-menu__sheet">
        <header className="v-menu__masthead">
          <span className="lv-eyebrow">Pior Labs</span>
          <Seal />
          <span className="lv-eyebrow">The cookbook</span>
        </header>

        <h1 className="v-menu__title">Bill of fare</h1>

        <ul className="v-menu__list">
          <li>
            <span>Saved recipes</span>
            <i aria-hidden="true" />
            <span>yours</span>
          </li>
          <li>
            <span>Tonight's plan</span>
            <i aria-hidden="true" />
            <span>shared</span>
          </li>
          <li>
            <span>The whole household</span>
            <i aria-hidden="true" />
            <span>invited</span>
          </li>
        </ul>

        <AuthError id={errorId} message={flow.error} className="v-menu__error" />
        <SignInButton flow={flow} className="v-menu__btn" label="Take a seat with Pior Labs" errorId={errorId} />
        <p className="lv-note">Reservations for approved household accounts.</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 6 - Frosted Recipe Card: the ruled card (1) rendered on glass (2).  */
/* ------------------------------------------------------------------ */
function FrostedCardLogin() {
  const flow = useSignInFlow();
  const errorId = useId();

  return (
    <div className="lv-variant v-fcard">
      <MeshBackdrop />

      <div className="v-fcard__sheet">
        <span className="v-card__tab">Cookbook</span>
        <div className="v-fcard__inner">
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

/* ------------------------------------------------------------------ */
/* 7 - Frosted Ticket: the perforated pass (3) rendered on glass (2).  */
/* ------------------------------------------------------------------ */
function FrostedTicketLogin() {
  const flow = useSignInFlow();
  const errorId = useId();

  return (
    <div className="lv-variant v-ftk">
      <MeshBackdrop />

      <div className="v-ftk__card">
        <div className="v-ftk__brand">
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

        <div className="v-ftk__seam" aria-hidden="true" />

        <div className="v-ftk__stub">
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
/* 8 - Pinned Recipe Card: the board (4) with the ruled card (1).      */
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
    id: 'index-card',
    name: 'Index Card',
    blurb: 'A ruled recipe card with a divider tab and offset shadow.',
    Component: IndexCardLogin,
  },
  {
    id: 'mesh',
    name: 'Mesh Atmosphere',
    blurb: 'Drifting mesh and grain from the package, behind frosted glass.',
    Component: MeshLogin,
  },
  {
    id: 'ticket',
    name: 'Ticket Stub',
    blurb: 'A perforated pass - story on the left, your seat on the stub.',
    Component: TicketLogin,
  },
  {
    id: 'pinned-notes',
    name: 'Pinned Notes',
    blurb: 'Handwritten scraps on a board, sign-in pinned up front.',
    Component: PinnedNotesLogin,
  },
  {
    id: 'bill-of-fare',
    name: 'Bill of Fare',
    blurb: 'A quiet menu with dotted leaders and editorial serif.',
    Component: MenuLogin,
  },
  {
    id: 'frosted-card',
    name: 'Frosted Recipe Card',
    blurb: 'The ruled recipe card floated as glass over drifting mesh.',
    Component: FrostedCardLogin,
  },
  {
    id: 'frosted-ticket',
    name: 'Frosted Ticket',
    blurb: 'The perforated pass as frosted glass over drifting mesh.',
    Component: FrostedTicketLogin,
  },
  {
    id: 'pinboard-card',
    name: 'Pinned Recipe Card',
    blurb: 'The ruled recipe card pinned to the corkboard of scraps.',
    Component: PinboardCardLogin,
  },
];
