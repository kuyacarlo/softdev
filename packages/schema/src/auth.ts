import { z } from '@hono/zod-openapi';
import { ADMIN_ROLES } from './constants.js';

export const AdminLoginSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').openapi({ example: 'admin' }),
  password: z.string().min(6, 'Password must be at least 6 characters').openapi({ example: 'admin123' }),
}).openapi('AdminLoginInput');

export const AdminUserSchema = z.object({
  adminId: z.number().int().openapi({ example: 1 }),
  username: z.string().openapi({ example: 'admin' }),
  email: z.string().email().openapi({ example: 'admin@stellascatering.com' }),
  role: z.enum(ADMIN_ROLES).openapi({ example: 'Owner' }),
  createdAt: z.string().optional().openapi({ example: '2026-09-01T12:00:00Z' }),
}).openapi('AdminUser');

export const LoginResponseSchema = z.object({
  success: z.literal(true).openapi({ example: true }),
  data: z.object({
    token: z.string().openapi({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }),
    user: AdminUserSchema,
  }),
}).openapi('LoginResponse');

export const CurrentUserResponseSchema = z.object({
  success: z.literal(true).openapi({ example: true }),
  data: AdminUserSchema,
}).openapi('CurrentUserResponse');

export const TokenPayloadSchema = z.object({
  adminId: z.number().int(),
  username: z.string(),
  email: z.string().email(),
  role: z.enum(ADMIN_ROLES),
  exp: z.number(),
});

export type AdminLoginInput = z.infer<typeof AdminLoginSchema>;
export type AdminUser = z.infer<typeof AdminUserSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export type CurrentUserResponse = z.infer<typeof CurrentUserResponseSchema>;
export type TokenPayload = z.infer<typeof TokenPayloadSchema>;
