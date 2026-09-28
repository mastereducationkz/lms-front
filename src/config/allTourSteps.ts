// Tour steps provider for NextStep.js
import { Tour } from 'nextstepjs';
import { getTourStepsForRole } from './tourSteps';
import type { UserRole } from '../types';
import { createElement, type ReactNode } from 'react';
import { BarChart3, BookOpen, GraduationCap, Hand, Lightbulb, Users, type LucideIcon } from 'lucide-react';

/** The tour card's icon: drawn from lucide (one stroke, one size), never an emoji. */
export function tourStepIcon(title: string, index: number): ReactNode {
  const Icon: LucideIcon =
    index === 0 ? Hand :
    title.includes('User') ? Users :
    title.includes('Group') ? GraduationCap :
    title.includes('Course') ? BookOpen :
    title.includes('Analytics') ? BarChart3 : Lightbulb;
  return createElement(Icon, { className: 'h-5 w-5 text-primary', 'aria-hidden': true });
}

export function getAllTourSteps(): Tour[] {
  const roles: UserRole[] = ['student', 'teacher', 'admin', 'curator'];
  
  return roles.map(role => {
    const tourSteps = getTourStepsForRole(role);
    
    return {
      tour: `${role}-onboarding`,
      steps: tourSteps.map((step, index) => {
        // For center placement steps (like welcome screens), omit selector
        const isCenterPlacement = step.placement === 'center';
        
        const stepConfig: any = {
          icon: tourStepIcon(step.title, index),
          title: step.title,
          content: step.content,
          showControls: true,
          showSkip: true,
          pointerPadding: 10,
          pointerRadius: 8,
        };
        
        // Only add selector and side for non-centered steps
        if (!isCenterPlacement) {
          stepConfig.selector = step.target;
          stepConfig.side = step.placement || 'bottom';
        }
        
        return stepConfig;
      }),
    };
  });
}
