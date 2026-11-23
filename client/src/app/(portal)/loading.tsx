/** Shown instantly while the next page is being rendered on the server. */
export default function Loading() {
  return (
    <div className="page-loading" role="status" aria-label="Loading">
      <div className="skeleton skeleton-row" />
      <div className="skeleton-metrics">
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
      <div className="skeleton skeleton-panel" />
    </div>
  );
}
