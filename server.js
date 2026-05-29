const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
cors: {
origin: "*",
methods: ["GET", "POST"]
}
});

const PORT = process.env.PORT || 3000;
const rooms = {};

io.on('connection', (socket) => {
console.log('User connected:', socket.id);

// 🔥 СЛЕПОЙ НАЖАЛ КНОПКУ "ПОМОЩЬ"
socket.on('call-request', () => {
const roomId = Date.now().toString();
rooms[roomId] = {
blind: socket.id,
helper: null
};

socket.join(roomId);
socket.emit('room-created', { roomId });

// 🔥 ОТПРАВЛЯЕМ ВСЕМ ПОМОЩНИКАМ
socket.broadcast.emit('new-call', { roomId });
console.log('📞 Call request received, room:', roomId);
});

// Помощник принял вызов
socket.on('call-accepted', (data) => {
const room = rooms[data.roomId];
if (room) {
room.helper = socket.id;
socket.join(data.roomId);

// Сообщаем слепому
io.to(room.blind).emit('call-accepted');
console.log('✅ Call accepted in room:', data.roomId);
}
});

// WebRTC Offer
socket.on('webrtc-offer', (data) => {
socket.to(data.roomId).emit('webrtc-offer', data.offer);
});

// WebRTC Answer
socket.on('webrtc-answer', (data) => {
socket.to(data.roomId).emit('webrtc-answer', data.answer);
});

// ICE Candidate
socket.on('ice-candidate', (data) => {
socket.to(data.roomId).emit('ice-candidate', data.candidate);
});

// Отключение
socket.on('disconnect', () => {
console.log('User disconnected:', socket.id);
});
});

server.listen(PORT, () => {
console.log('Server running on port', PORT);
});
