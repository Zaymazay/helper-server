const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { 
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000
});

const PORT = process.env.PORT || 3000;
const rooms = new Map();

console.log('[Server] Starting server...');

io.on('connection', (socket) => {
  console.log(`[Server] ✅ User connected: ${socket.id}`);

  socket.on('call-request', (data) => {
    const roomId = Date.now().toString();
    
    rooms.set(roomId, {
      blind: socket.id,
      helper: null,
      offer: data.offer,
      createdAt: Date.now()
    });
    
    socket.join(roomId);
    socket.emit('room-created', { roomId });
    
    socket.broadcast.emit('new-call', { 
      roomId, 
      offer: data.offer 
    });
    
    console.log(`[Server]  Call request. Room: ${roomId}`);
  });

  socket.on('webrtc-answer', (data) => {
    const room = rooms.get(data.roomId);
    
    if (!room) {
      console.warn(`[Server] ⚠️ Room ${data.roomId} not found`);
      return;
    }
    
    room.helper = socket.id;
    socket.join(data.roomId);
    
    io.to(room.blind).emit('webrtc-answer', {
      answer: data.answer,
      roomId: data.roomId
    });
    
    console.log(`[Server] ✅ Answer sent to blind in room: ${data.roomId}`);
  });

  socket.on('ice-candidate', (data) => {
    const room = rooms.get(data.roomId);
    
    if (!room) return;
    
    const targetId = room.blind === socket.id ? room.helper : room.blind;
    
    if (targetId) {
      io.to(targetId).emit('ice-candidate', {
        candidate: data.candidate,
        roomId: data.roomId
      });
    }
  });

  socket.on('call-end', (data) => {
    const room = rooms.get(data.roomId);
    
    if (room) {
      const targetId = room.blind === socket.id ? room.helper : room.blind;
      
      if (targetId) {
        io.to(targetId).emit('call-ended');
      }
      
      rooms.delete(data.roomId);
      console.log(`[Server] 🗑️ Room ${data.roomId} deleted`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Server] ❌ User disconnected: ${socket.id}`);
    
    for (const [roomId, room] of rooms.entries()) {
      if (room.blind === socket.id || room.helper === socket.id) {
        const otherId = room.blind === socket.id ? room.helper : room.blind;
        
        if (otherId) {
          io.to(otherId).emit('call-ended');
        }
        
        rooms.delete(roomId);
        console.log(`[Server] 🗑️ Room ${roomId} cleaned due to disconnect`);
        break;
      }
    }
  });

  socket.on('error', (error) => {
    console.error(`[Server] ❌ Socket error:`, error);
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', rooms: rooms.size, uptime: process.uptime() });
});

server.listen(PORT, () => {
  console.log(`[Server] 🚀 Server running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down...');
  server.close(() => {
    console.log('[Server] Server closed');
    process.exit(0);
  });
});
