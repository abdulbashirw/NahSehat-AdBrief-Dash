/**
 * Validation middleware — zod-based request validation (P2.2 / H6).
 *
 * Replaces untyped `req.body as SomeType` casts with strict schemas:
 *   - Unknown fields are stripped (prevents mass-assignment).
 *   - Wrong types / oversized payloads are rejected with 400.
 *   - Validated (and coerced) data replaces the raw body/query.
 *
 * Usage: router.post('/', validateBody(createUserSchema), handler)
 */
import type { Request, Response, NextFunction } from 'express';
import { z, type ZodType } from 'zod';
import { createError } from './errorHandler';

type ValidationTarget = 'body' | 'query';

function validate(target: ValidationTarget, schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `${i.path.join('.') || target}: ${i.message}`)
        .join('; ');
      return next(createError(400, `Validation failed: ${issues}`));
    }
    // Express 5: req.query is a getter — replace contents in place.
    if (target === 'query') {
      const parsed = result.data as Record<string, unknown>;
      for (const key of Object.keys(req.query as Record<string, unknown>)) {
        delete (req.query as Record<string, unknown>)[key];
      }
      Object.assign(req.query as Record<string, unknown>, parsed);
    } else {
      req.body = result.data;
    }
    next();
  };
}

/** Validate & sanitize req.body against a zod schema (400 on failure). */
export function validateBody(schema: ZodType) {
  return validate('body', schema);
}

/** Validate & sanitize req.query against a zod schema (400 on failure). */
export function validateQuery(schema: ZodType) {
  return validate('query', schema);
}

/** Re-export z so route files can import schemas from one place. */
export { z };