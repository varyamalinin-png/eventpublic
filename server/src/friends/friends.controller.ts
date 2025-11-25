import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RequestUser } from '../shared/decorators/request-user.decorator';
import { RespondFriendRequestDto } from './dto/respond-friend-request.dto';

@UseGuards(JwtAuthGuard)
@Controller('friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  list(@RequestUser('userId') userId: string) {
    return this.friendsService.listFriends(userId);
  }

  @Post(':friendId')
  addFriend(@RequestUser('userId') userId: string, @Param('friendId') friendId: string) {
    return this.friendsService.addFriend(userId, friendId);
  }

  @Delete(':friendId')
  async removeFriend(
    @RequestUser('userId') userId: string,
    @Param('friendId') friendId: string,
  ) {
    await this.friendsService.removeFriend(userId, friendId);
    return this.friendsService.listFriends(userId);
  }

  @Get('requests')
  listRequests(@RequestUser('userId') userId: string) {
    return this.friendsService.listRequests(userId);
  }

  @Patch('requests/:requestId')
  respondToRequest(
    @RequestUser('userId') userId: string,
    @Param('requestId') requestId: string,
    @Body() dto: RespondFriendRequestDto,
  ) {
    return this.friendsService.respondToRequest(userId, requestId, dto.accept);
  }
}
