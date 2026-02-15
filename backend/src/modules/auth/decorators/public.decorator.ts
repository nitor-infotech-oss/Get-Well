import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator to mark a route as public (no JWT required).
 * Used for login, register, health checks, and webhooks.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
