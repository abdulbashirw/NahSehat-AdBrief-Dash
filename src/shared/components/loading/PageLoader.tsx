/**
 * PageLoader — full-page loading spinner.
 */
import LoadingSpinner from './LoadingSpinner';

export default function PageLoader({ message = 'Loading...' }: { message?: string }) {
  return <LoadingSpinner message={message} fullScreen />;
}