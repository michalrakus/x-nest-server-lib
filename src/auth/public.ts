import { SetMetadata } from '@nestjs/common';

// Public decorator - api metody oznacene tymto decoratorom maju vypnutu autentifikaciu - pozri JwtAuthGuard
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);