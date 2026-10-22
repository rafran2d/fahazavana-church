import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

/** Toutes les erreurs au format RFC 7807 (application/problem+json). */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let detail: unknown = 'Erreur interne';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      detail = typeof body === 'string' ? body : (body as { message?: unknown }).message ?? body;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        detail = 'Cette ressource existe déjà';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        detail = 'Ressource introuvable';
      }
    }

    if (status >= 500) this.logger.error(exception);

    response
      .status(status)
      .type('application/problem+json')
      .json({
        type: 'about:blank',
        title: HttpStatus[status] ?? 'Error',
        status,
        detail,
        instance: request.url,
      });
  }
}
