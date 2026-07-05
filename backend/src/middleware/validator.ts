import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validateBody = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMsg = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
        res.status(400).json({
          success: false,
          error: errorMsg
        });
        return;
      }
      next(error);
    }
  };
};

export default validateBody;
