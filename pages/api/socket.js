// Socket.io API Route para Vercel
import { Server } from 'socket.io';

export default function handler(req, res) {
  if (res.socket.server.io) {
    console.log('Socket.io already running');
    res.end();
    return;
  }

  const io = new Server(res.socket.server, {
    path: '/socket.io',
    addTrailingSlash: false,
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  res.socket.server.io = io;

  // Lógica do Socket.io
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join-game', (data) => {
      socket.join(data.gameCode);
      socket.to(data.gameCode).emit('player-joined', data);
    });

    socket.on('start-game', (data) => {
      socket.to(data.gameCode).emit('game-started');
    });

    socket.on('answer-question', (data) => {
      socket.to(data.gameCode).emit('answer-received', data);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  console.log('Socket.io server started');
  res.end();
}
