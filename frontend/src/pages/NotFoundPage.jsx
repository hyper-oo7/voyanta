import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface text-on-surface">
      <div className="text-center space-y-6">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 80 }}>map</span>
        <h1 className="text-display-lg font-bold font-heading">404</h1>
        <h2 className="text-headline-md">Looks like you're lost.</h2>
        <p className="text-on-surface-variant font-body-md max-w-sm mx-auto">
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </p>
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 px-xl py-md bg-primary text-on-primary rounded-full font-label-lg hover:opacity-90 transition-all shadow-md"
        >
          <span className="material-symbols-outlined text-sm">home</span>
          Return Home
        </Link>
      </div>
    </div>
  );
}
