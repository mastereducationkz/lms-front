import { useEffect, useCallback, useState, useContext } from 'react';
import { useNavigate, UNSAFE_NavigationContext } from 'react-router-dom';
import { useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/sharedUi';

interface UseUnsavedChangesWarningOptions {
  hasUnsavedChanges: boolean;
  message?: string;
  onConfirmLeave?: () => void;
  shouldBlockNavigation?: (currentPath: string, nextPath: string) => boolean;
}

/**
 * Custom hook to warn users about unsaved changes before they navigate away or close the page
 * Works with both BrowserRouter and data routers
 * 
 * @param hasUnsavedChanges - Boolean indicating if there are unsaved changes
 * @param message - Optional custom warning message
 * @param onConfirmLeave - Optional callback to execute when user confirms leaving
 */
export function useUnsavedChangesWarning({
  hasUnsavedChanges,
  message: customMessage,
  onConfirmLeave,
  shouldBlockNavigation
}: UseUnsavedChangesWarningOptions) {
  const t = useT();
  const message = customMessage ?? t('sharedUi.unsavedChanges.leave');
  const [showPrompt, setShowPrompt] = useState(false);
  const [confirmedNavigation, setConfirmedNavigation] = useState(false);
  const [lastLocation, setLastLocation] = useState<any>(null);
  
  const navigate = useNavigate();
  const navigationContext = useContext(UNSAFE_NavigationContext);

  // Handle beforeunload event (page reload, close, or external navigation)
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Most modern browsers ignore custom messages and show their own
      e.preventDefault();
      e.returnValue = message; // Required for Chrome
      return message; // Required for some older browsers
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges, message]);

  // Block navigation when there are unsaved changes (works with BrowserRouter)
  useEffect(() => {
    if (!hasUnsavedChanges || !navigationContext?.navigator) return;

    const { navigator } = navigationContext;
    const originalPush = navigator.push.bind(navigator);
    const originalReplace = navigator.replace.bind(navigator);

    navigator.push = (to: any, state?: any) => {
      if (confirmedNavigation) {
        originalPush(to, state);
      } else {
        const currentPath = window.location.pathname;
        const nextPath = typeof to === 'string' ? to : to.pathname || '';
        
        // Check if navigation should be blocked
        const shouldBlock = shouldBlockNavigation 
          ? shouldBlockNavigation(currentPath, nextPath)
          : true;
        
        if (shouldBlock) {
          setLastLocation(to);
          setShowPrompt(true);
        } else {
          originalPush(to, state);
        }
      }
    };

    navigator.replace = (to: any, state?: any) => {
      if (confirmedNavigation) {
        originalReplace(to, state);
      } else {
        const currentPath = window.location.pathname;
        const nextPath = typeof to === 'string' ? to : to.pathname || '';
        
        // Check if navigation should be blocked
        const shouldBlock = shouldBlockNavigation 
          ? shouldBlockNavigation(currentPath, nextPath)
          : true;
        
        if (shouldBlock) {
          setLastLocation(to);
          setShowPrompt(true);
        } else {
          originalReplace(to, state);
        }
      }
    };

    return () => {
      navigator.push = originalPush;
      navigator.replace = originalReplace;
    };
  }, [hasUnsavedChanges, confirmedNavigation, navigationContext, shouldBlockNavigation]);

  // Navigate when confirmed
  useEffect(() => {
    if (confirmedNavigation && lastLocation) {
      navigate(lastLocation.pathname || lastLocation, { replace: false });
      setConfirmedNavigation(false);
    }
  }, [confirmedNavigation, lastLocation, navigate]);

  // Provide a function to manually confirm leaving
  const confirmLeave = useCallback(() => {
    if (onConfirmLeave) {
      onConfirmLeave();
    }
    setShowPrompt(false);
    setConfirmedNavigation(true);
  }, [onConfirmLeave]);

  // Provide a function to cancel leaving
  const cancelLeave = useCallback(() => {
    setShowPrompt(false);
    setLastLocation(null);
  }, []);

  return {
    confirmLeave,
    cancelLeave,
    isBlocked: showPrompt
  };
}

export default useUnsavedChangesWarning;
