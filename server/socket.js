// Singleton — holds the io instance so routes can emit without circular imports
import { Server } from 'socket.io';

let _io = null;

export function initSocket(httpServer) {
  _io = new Server(httpServer, {
    cors: { origin: '*' },
  });
  _io.on('connection', (socket) => {
    console.log(`[socket] client connected: ${socket.id}`);
    socket.on('disconnect', () => console.log(`[socket] client disconnected: ${socket.id}`));
  });
  return _io;
}

export function broadcast(event, data) {
  if (_io) _io.emit(event, data);
}
