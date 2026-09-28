import { useEffect, useRef } from 'react';
import { useNextStep } from 'nextstepjs';
import { UserRole } from '../types';
import { getTourStepsForRole } from '../config/tourSteps';
import { tourStepIcon } from '../config/allTourSteps';

interface OnboardingTourProps {
  userRole: UserRole;
  steps: any[];
  isOpen: boolean;
  onComplete: () => void;
}

export default function OnboardingTour({ userRole, isOpen, onComplete }: OnboardingTourProps) {
  const { startNextStep, closeNextStep, isNextStepVisible, currentStep } = useNextStep();
  const onCompleteRef = useRef(onComplete);
  const hasCompletedRef = useRef(false);
  const tourSteps = getTourStepsForRole(userRole);
  const totalSteps = tourSteps.length;

  // Update ref when onComplete changes
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Отслеживаем прогресс тура
  useEffect(() => {
    console.log('[OnboardingTour] Step progress:', { currentStep, totalSteps, isOpen, isNextStepVisible });
    
    // Если тур закрыт и был открыт, но не был завершен ранее
    if (!isNextStepVisible && isOpen && !hasCompletedRef.current && currentStep > 0) {
      console.log('[OnboardingTour] Tour closed, marking as complete');
      hasCompletedRef.current = true;
      onCompleteRef.current();
    }
    
    // Если достигли последнего шага
    if (currentStep === totalSteps && currentStep > 0 && !hasCompletedRef.current) {
      console.log('[OnboardingTour] Reached last step, will complete on close');
    }
  }, [currentStep, totalSteps, isNextStepVisible, isOpen]);

  useEffect(() => {
    if (isOpen && !isNextStepVisible) {
      // Сбрасываем флаг завершения при новом открытии
      hasCompletedRef.current = false;
      
      // Даем время DOM элементам загрузиться перед запуском тура
      const timer = setTimeout(() => {
        const tourName = `${userRole}-onboarding`;
        console.log('Starting tour:', tourName);
        
        // Debug: Check if tour elements exist
        const tourSteps = getTourStepsForRole(userRole);
        console.log('Tour steps:', tourSteps.length);
        tourSteps.forEach((step, index) => {
          const element = document.querySelector(step.target);
          console.log(`Step ${index + 1} (${step.target}):`, element ? 'Found ✓' : 'Not found ✗');
        });
        
        startNextStep(tourName);
      }, 1000); // Увеличена задержка до 1000ms
      
      return () => clearTimeout(timer);
    } else if (!isOpen && isNextStepVisible) {
      // Закрываем тур
      closeNextStep();
    }
  }, [isOpen, isNextStepVisible, startNextStep, closeNextStep, userRole]);

  // Слушаем завершение тура через события
  useEffect(() => {
    const handleTourEnd = (event: any) => {
      console.log('[OnboardingTour] Tour end event received:', event);
      if (isOpen && !hasCompletedRef.current) {
        hasCompletedRef.current = true;
        onCompleteRef.current();
      }
    };

    const handleTourComplete = (event: any) => {
      console.log('[OnboardingTour] Tour complete event received:', event);
      if (isOpen && !hasCompletedRef.current) {
        hasCompletedRef.current = true;
        onCompleteRef.current();
      }
    };

    const handleTourSkip = (event: any) => {
      console.log('[OnboardingTour] Tour skip event received:', event);
      if (isOpen && !hasCompletedRef.current) {
        hasCompletedRef.current = true;
        onCompleteRef.current();
      }
    };

    // Добавляем глобальные слушатели для различных событий завершения тура
    window.addEventListener('nextstep:complete', handleTourComplete);
    window.addEventListener('nextstep:end', handleTourEnd);
    window.addEventListener('nextstep:skip', handleTourSkip);
    
    return () => {
      window.removeEventListener('nextstep:complete', handleTourComplete);
      window.removeEventListener('nextstep:end', handleTourEnd);
      window.removeEventListener('nextstep:skip', handleTourSkip);
    };
  }, [isOpen]);

  // Компонент управляет туром через хуки, не рендерит UI
  return null;
}

// Экспортируем функцию для создания steps
export function createTourSteps(userRole: UserRole) {
  const tourSteps = getTourStepsForRole(userRole);

  return [
    {
      tour: 'onboarding',
      steps: tourSteps.map((step, index) => ({
        icon: tourStepIcon(step.title, index),
        title: step.title,
        content: step.content,
        selector: step.target,
        side: (step.placement === 'center' ? 'top' : step.placement) as 'top' | 'bottom' | 'left' | 'right',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
      })),
    },
  ];
}

