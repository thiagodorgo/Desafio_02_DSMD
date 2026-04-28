import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';

@Controller('health')
export class NotificationsController {
  @Get()
  @HttpCode(HttpStatus.OK)
  health() {
    return { status: 'ok', service: 'notification-service' };
  }
}
