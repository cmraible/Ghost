import type { RefObject } from 'react';
import { Button } from '@tryghost/shade/components';
import { Grid, Stack } from '@tryghost/shade/primitives';
import { cn, LucideIcon } from '@tryghost/shade/utils';

interface ChartErrorProps {
  title: string;
  description: string;
  onRetry: () => Promise<void>;
  recoveryFocusRef: RefObject<HTMLElement | null>;
  isRetrying: boolean;
  className?: string;
  variant?: 'panel' | 'inline';
}

export function ChartError({
  title,
  description,
  onRetry,
  isRetrying,
  className,
  variant = 'panel',
  recoveryFocusRef,
}: ChartErrorProps) {
  const handleRetry = async () => {
    if (isRetrying) {
      return;
    }
    const focusedElement = document.activeElement;
    await onRetry();
    // Successful recovery removes this button. Restore focus only if the user
    // has not moved it elsewhere while the request was pending.
    requestAnimationFrame(() => {
      if (
        focusedElement &&
        !focusedElement.isConnected &&
        document.activeElement === document.body
      ) {
        recoveryFocusRef.current?.focus();
      }
    });
  };

  return (
    <Grid
      align="center"
      className={cn(
        variant === 'panel'
          ? 'content-center justify-items-center text-center'
          : 'grid-cols-[auto_1fr] text-left sm:grid-cols-[auto_1fr_auto]',
        className,
      )}
      gap="md"
    >
      <LucideIcon.TriangleAlert aria-hidden="true" className="size-5 text-muted-foreground" />
      <Stack aria-atomic="true" aria-live="polite" gap="xs" role="status">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </Stack>
      <Button
        aria-disabled={isRetrying}
        className={
          variant === 'inline' ? 'col-start-2 justify-self-start sm:col-start-auto' : undefined
        }
        size="sm"
        variant="outline"
        onClick={() => void handleRetry()}
      >
        {isRetrying ? 'Trying again…' : 'Try again'}
      </Button>
    </Grid>
  );
}
