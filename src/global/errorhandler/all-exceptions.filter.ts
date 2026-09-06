import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    try {
      const type = host.getType();

      if (type === 'http') {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Ichki server xatoligi';

        if (exception instanceof HttpException) {
          status = exception.getStatus();
          const res = exception.getResponse();
          if (typeof res === 'string') {
            message = res;
          } else if (typeof res === 'object' && res !== null && 'message' in res) {
            message = (res as any).message;
          }
        }

        this.logger.error(`HTTP Xatolik: ${request.method} ${request.url} - Status: ${status}`, exception);

        response.status(status).json({
          statusCode: status,
          timestamp: new Date().toISOString(),
          path: request.url,
          message,
        });
      } else {
        this.logger.error('Noma\'lum xatolik ro\'y berdi:', exception);
      }
    } catch (err) {
      this.logger.error('AllExceptionsFilter ichida xatolik:', err);
    }
  }
}
