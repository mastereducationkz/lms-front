import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { reportError } from '../lib/sentry';

/**
 * A boundary for optional widgets: if the widget crashes, it disappears and the page around
 * it keeps working. The app-wide ErrorBoundary replaces the whole screen, which is right for a
 * page but wrong for a popup — a malformed daily question took the student dashboard down
 * (LMS-FRONT-7/8/9). The crash still reaches Sentry.
 */
export default class QuietBoundary extends Component<{ name: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[QuietBoundary:${this.props.name}]`, error, info?.componentStack ?? '');
    reportError(error, { boundary: this.props.name, componentStack: info?.componentStack ?? '' });
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
