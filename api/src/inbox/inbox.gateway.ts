import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';

/**
 * InboxGateway: Real-time WebSocket gateway for vendor lead inbox.
 *
 * - No port argument: shares the HTTP port (NestJS + Socket.IO on same port).
 * - JWT auth via afterInit socket middleware (NOT in handleConnection to avoid
 *   server crash on auth failure — NestJS issue #2028).
 * - Authenticated vendors join room `vendor:{vendorId}` on connection.
 * - emitToVendor() is called by RoutingService (wired in Plan 04-03) after
 *   assignment creation, and by other services for real-time notifications.
 */
@Injectable()
@WebSocketGateway({ cors: { origin: '*', credentials: true } })
export class InboxGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(InboxGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * afterInit: Register socket middleware for JWT authentication.
   *
   * CRITICAL: JWT validation must happen here, not in handleConnection.
   * Throwing in handleConnection crashes the NestJS process (issue #2028).
   * The middleware calls next(new Error(...)) to safely reject the connection.
   */
  afterInit(server: Server) {
    server.use(async (socket: Socket, next) => {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) {
        return next(new Error('Missing auth token'));
      }
      try {
        const payload = this.jwtService.verify<JwtPayload>(token);
        // Attach decoded payload; handleConnection will use this
        socket.data.jwtPayload = payload;
        next();
      } catch {
        next(new Error('Invalid or expired token'));
      }
    });
    this.logger.log('InboxGateway initialized — JWT socket middleware registered');
  }

  /**
   * handleConnection: Join the vendor's personal room after auth.
   *
   * If jwtPayload is absent (auth middleware failed), disconnect and return.
   * Never throw here — only call client.disconnect(true).
   */
  async handleConnection(client: Socket) {
    const payload = client.data.jwtPayload as JwtPayload | undefined;
    if (!payload) {
      client.disconnect(true);
      return;
    }

    // Resolve vendorId from userId in the JWT payload
    const vendor = await this.prisma.vendorProfile.findUnique({
      where: { userId: payload.userId },
      select: { id: true },
    });

    if (!vendor) {
      this.logger.warn(
        `No vendor profile found for userId ${payload.userId} — disconnecting`,
      );
      client.disconnect(true);
      return;
    }

    const room = `vendor:${vendor.id}`;
    await client.join(room);
    client.data.vendorId = vendor.id;
    this.logger.log(`Vendor ${vendor.id} connected — joined room ${room}`);
  }

  /**
   * handleDisconnect: Log vendor disconnect.
   */
  handleDisconnect(client: Socket) {
    const vendorId = client.data?.vendorId as string | undefined;
    this.logger.log(`Vendor ${vendorId ?? 'unknown'} disconnected`);
  }

  /**
   * emitToVendor: Emit an event to a vendor's personal room.
   *
   * Called by RoutingService (Plan 04-03) after assignment creation to deliver
   * the `new_lead` event. Also called by other services for notifications.
   * Customer phone is NEVER included here — revealed only after vendor accepts.
   */
  emitToVendor(vendorId: string, event: string, data: unknown): void {
    this.server.to(`vendor:${vendorId}`).emit(event, data);
    this.logger.debug(`Emitted '${event}' to vendor:${vendorId}`);
  }
}
