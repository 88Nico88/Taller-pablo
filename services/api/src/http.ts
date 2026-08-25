import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from './config.js';
import type { User } from './domain.js';
import type { AppStore } from './store.js';

declare global {
  namespace Express {
    interface Request {
      user?: Omit<User, 'passwordHash'>;
    }
  }
}

export function signToken(user: User) {
  return jwt.sign({ sub: user.id, role: user.role }, config.JWT_SECRET, { expiresIn: '8h' });
}

export function requireAuth(store: AppStore) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing token' } });
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET);
      const sub = typeof decoded === 'object' ? decoded.sub : undefined;
      const user = typeof sub === 'string' ? store.users.get(sub) : undefined;
      if (!user || !user.active) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
      const { passwordHash: _passwordHash, ...safeUser } = user;
      req.user = safeUser;
      next();
    } catch {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
    }
  };
}

export function validate<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos invalidos',
          details: result.error.issues
        }
      });
    }
    req.body = result.data;
    next();
  };
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  const err = error as Error & { status?: number };
  res.status(err.status ?? 500).json({
    error: {
      code: err.status && err.status < 500 ? 'REQUEST_ERROR' : 'INTERNAL_ERROR',
      message: err.message || 'Unexpected error'
    }
  });
}
