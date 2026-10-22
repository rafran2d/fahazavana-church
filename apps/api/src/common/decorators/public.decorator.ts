import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Route accessible sans jeton (inscription, connexion, santé, webhooks). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
