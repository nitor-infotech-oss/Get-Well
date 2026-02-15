import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Decorator to restrict access to specific roles.
 * @example @Roles('admin', 'supervisor')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
