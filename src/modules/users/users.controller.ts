import { Controller, Get, Post, Delete, Body, Param, HttpStatus, HttpCode } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('api/allowed-users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getAllowedUsers() {
    return await this.usersService.listAllowedUsers();
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async addAllowedUser(
    @Body()
    body: {
      telegramId: string | number;
      firstName?: string;
      lastName?: string;
      username?: string;
    },
  ) {
    if (!body || !body.telegramId) {
      return { success: false, message: 'telegramId kiritilishi shart' };
    }
    return await this.usersService.addAllowedUser(body);
  }

  @Delete(':telegramId')
  async removeAllowedUser(@Param('telegramId') telegramId: string) {
    if (!telegramId) {
      return { success: false, message: 'telegramId kiritilishi shart' };
    }
    return await this.usersService.removeAllowedUser(telegramId);
  }
}
