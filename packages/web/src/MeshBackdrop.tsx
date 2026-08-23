// The design system's drifting mesh and grain (effects.css), the ambient layer
// every Cookbook screen sits on. It is fixed and inert: blobs at z-index 0,
// grain at 1, so any content that wants to be above it takes z-index 2.
export function MeshBackdrop() {
  return (
    <>
      <div className="theme-mesh" aria-hidden="true">
        <div className="theme-blob b1" />
        <div className="theme-blob b2" />
        <div className="theme-blob b3" />
        <div className="theme-blob b4" />
        <div className="theme-blob b5" />
      </div>
      <div className="theme-grain" aria-hidden="true" />
    </>
  );
}
