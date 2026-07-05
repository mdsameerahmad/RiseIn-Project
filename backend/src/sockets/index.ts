import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';

let io: SocketServer | null = null;

export const initSockets = (server: HttpServer): SocketServer => {
  io = new SocketServer(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PATCH', 'PUT']
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log(`Socket client connected: ${socket.id}`);

    socket.on('register', (walletAddress: string) => {
      if (walletAddress) {
        const roomName = walletAddress.toLowerCase();
        socket.join(roomName);
        console.log(`Socket ${socket.id} registered to room: ${roomName}`);
        socket.emit('registered', { success: true, room: roomName });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = (): SocketServer => {
  if (!io) {
    throw new Error('Socket.io has not been initialized. Please call initSockets first.');
  }
  return io;
};

export const emitToWallet = (walletAddress: string, event: string, payload: any): void => {
  if (io && walletAddress) {
    const roomName = walletAddress.toLowerCase();
    io.to(roomName).emit(event, payload);
    console.log(`Socket emission [${event}] targeted to wallet [${roomName}]`);
  }
};
