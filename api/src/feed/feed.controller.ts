import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { FeedService } from './feed.service';

@ApiTags('Feed')
@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  /**
   * GET /feed — public, no auth required.
   */
  @Get()
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'authorId', required: false })
  getPosts(
    @Query('category') category?: string,
    @Query('city') city?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('authorId') authorId?: string,
  ) {
    return this.feedService.getPosts({
      category,
      city,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      authorId,
    });
  }

  /**
   * POST /feed — create post (JWT required).
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  createPost(
    @CurrentUser() user: { id: string; activeRole: string },
    @Body() dto: CreatePostDto,
  ) {
    return this.feedService.createPost(user.id, user.activeRole ?? 'CUSTOMER', dto);
  }

  /**
   * DELETE /feed/comments/:id — delete own comment (JWT required).
   * Note: this route must be before DELETE /feed/:id to avoid conflict.
   */
  @Delete('comments/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  deleteComment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.feedService.deleteComment(id, user.id);
  }

  /**
   * DELETE /feed/:id — delete own post (JWT required).
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  deletePost(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.feedService.deletePost(id, user.id);
  }

  /**
   * GET /feed/:id/comments — public.
   */
  @Get(':id/comments')
  getComments(@Param('id', ParseUUIDPipe) id: string) {
    return this.feedService.getComments(id);
  }

  /**
   * POST /feed/:id/comments — add comment (JWT required).
   */
  @Post(':id/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  createComment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreateCommentDto,
  ) {
    return this.feedService.createComment(id, user.id, dto);
  }
}
