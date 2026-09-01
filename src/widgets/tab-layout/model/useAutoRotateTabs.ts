/**
 * useAutoRotateTabs — automatically advances to the next tab on a fixed interval.
 *
 * The timer resets whenever the active route changes (either by auto-advance
 * or by a manual user click), so manual navigation never fights the automation:
 * every navigation restarts the countdown from zero.
 *
 * Rotation is skipped when:
 *   - The user has disabled it via Settings → Display (autoRotateStore)
 *   - There are fewer than 2 tabs (nothing to rotate)
 *
 * The interval is read from the autoRotateStore (user-configurable, default 150 s).
 *
 * @param tabPaths Ordered list of tab paths to cycle through.
 */
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAutoRotateSettings } from './useAutoRotateEnabled';

export function useAutoRotateTabs(tabPaths: string[]) {
  const location = useLocation();
  const navigate = useNavigate();
  const { enabled: autoRotateEnabled, intervalSeconds } = useAutoRotateSettings();

  // Keep the latest tabPaths without re-triggering the rotation effect on
  // every render. The ref is updated in an effect (not during render) per
  // the react-hooks/refs rule.
  const pathsRef = useRef(tabPaths);
  useEffect(() => {
    pathsRef.current = tabPaths;
  }, [tabPaths]);

  useEffect(() => {
    // Nothing to rotate when there are fewer than 2 tabs.
    if (pathsRef.current.length < 2) return;

    // Respect the user's preference — no timer when disabled.
    if (!autoRotateEnabled) return;

    const intervalMs = intervalSeconds * 1000;

    const id = setTimeout(() => {
      const paths = pathsRef.current;
      const current = location.pathname;
      const currentIndex = paths.findIndex(
        (p) => current === p || current.startsWith(p + '/'),
      );
      const nextIndex = (currentIndex + 1) % paths.length;
      navigate(paths[nextIndex]);
    }, intervalMs);

    // Re-run (and reset the timer) whenever the route changes, the
    // enabled preference toggles, or the interval changes.
    return () => clearTimeout(id);
  }, [location.pathname, navigate, autoRotateEnabled, intervalSeconds]);
}