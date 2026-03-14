import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';

export interface FeedQueryDto {
  category?: string;
  city?: string;
  page?: number;
  limit?: number;
  authorId?: string;
}

@Injectable()
export class FeedService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get paginated public feed posts. Only ACTIVE posts are returned.
   */
  async getPosts(query: FeedQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 50);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { status: 'ACTIVE' };

    if (query.category) {
      where.category = query.category;
    }
    if (query.city) {
      where.city = { equals: query.city, mode: 'insensitive' };
    }
    if (query.authorId) {
      where.authorId = query.authorId;
    }

    const [posts, total] = await Promise.all([
      this.prisma.feedPost.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          body: true,
          category: true,
          city: true,
          eventDate: true,
          budgetPaise: true,
          mediaUrls: true,
          likesCount: true,
          createdAt: true,
          authorId: true,
          authorRole: true,
          author: {
            select: { id: true, name: true },
          },
          _count: {
            select: { comments: true },
          },
        },
      }),
      this.prisma.feedPost.count({ where }),
    ]);

    return {
      data: posts.map((p) => ({
        ...p,
        commentCount: p._count.comments,
        _count: undefined,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Create a new feed post for the authenticated user.
   */
  async createPost(authorId: string, authorRole: string, dto: CreatePostDto) {
    return this.prisma.feedPost.create({
      data: {
        authorId,
        authorRole,
        title: dto.title,
        body: dto.body,
        category: dto.category ?? 'GENERAL',
        city: dto.city,
        eventDate: dto.eventDate ? new Date(dto.eventDate) : undefined,
        budgetPaise: dto.budgetPaise,
      },
      select: {
        id: true,
        title: true,
        body: true,
        category: true,
        city: true,
        eventDate: true,
        budgetPaise: true,
        status: true,
        createdAt: true,
      },
    });
  }

  /**
   * Soft-delete a feed post (set status to DELETED).
   * Only the author can delete their own post.
   */
  async deletePost(id: string, userId: string) {
    const post = await this.prisma.feedPost.findUnique({ where: { id } });
    if (!post || post.status === 'DELETED') {
      throw new NotFoundException('Feed post not found');
    }
    if (post.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own posts');
    }
    await this.prisma.feedPost.update({
      where: { id },
      data: { status: 'DELETED' },
    });
    return { message: 'Post deleted successfully' };
  }

  /**
   * Get all ACTIVE comments for a post.
   */
  async getComments(postId: string) {
    const post = await this.prisma.feedPost.findUnique({
      where: { id: postId },
    });
    if (!post || post.status === 'DELETED') {
      throw new NotFoundException('Feed post not found');
    }

    return this.prisma.feedComment.findMany({
      where: { postId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        body: true,
        createdAt: true,
        authorId: true,
        author: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Add a comment to a post.
   */
  async createComment(postId: string, authorId: string, dto: CreateCommentDto) {
    const post = await this.prisma.feedPost.findUnique({ where: { id: postId } });
    if (!post || post.status === 'DELETED') {
      throw new NotFoundException('Feed post not found');
    }

    return this.prisma.feedComment.create({
      data: {
        postId,
        authorId,
        body: dto.body,
      },
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Soft-delete a comment (set status to DELETED).
   * Only the author can delete their own comment.
   */
  async deleteComment(id: string, userId: string) {
    const comment = await this.prisma.feedComment.findUnique({ where: { id } });
    if (!comment || comment.status === 'DELETED') {
      throw new NotFoundException('Comment not found');
    }
    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }
    await this.prisma.feedComment.update({
      where: { id },
      data: { status: 'DELETED' },
    });
    return { message: 'Comment deleted successfully' };
  }

  /**
   * Admin: hide or unhide a feed post.
   */
  async toggleHidePost(id: string) {
    const post = await this.prisma.feedPost.findUnique({ where: { id } });
    if (!post) {
      throw new NotFoundException('Feed post not found');
    }
    const newStatus = post.status === 'HIDDEN' ? 'ACTIVE' : 'HIDDEN';
    return this.prisma.feedPost.update({
      where: { id },
      data: { status: newStatus },
      select: { id: true, status: true },
    });
  }

  /**
   * Admin: hard-delete a feed post.
   */
  async adminDeletePost(id: string) {
    const post = await this.prisma.feedPost.findUnique({ where: { id } });
    if (!post) {
      throw new NotFoundException('Feed post not found');
    }
    await this.prisma.feedPost.delete({ where: { id } });
    return { message: 'Post permanently deleted' };
  }
}
