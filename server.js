const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
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

// 🔥 Слепой создал звонок с Offer
socket.on('call-request', (data) => {
const roomId = Date.now().toString();
rooms[roomId] = {
blind: socket.id,
helper: null,
offer: data.offer
};

socket.join(roomId);
socket.emit('room-created', { roomId });

// 🔥 Отправляем ВСЕМ остальным (помощникам)
socket.broadcast.emit('new-call', { roomId, offer: data.offer });

console.log('Call request received, room:', roomId);
});

// 🔥 Помощник принял и создал Answer
socket.on('webrtc-answer', (data) => {
const room = rooms[data.roomId];
if (room) {
room.helper = socket.id;
socket.join(data.roomId);

// Отправляем Answer СЛЕПОМУ
io.to(room.blind).emit('webrtc-answer', data.answer);
console.log('Answer sent to blind user');
}
});

// ICE кандидаты
socket.on('ice-candidate', (data) => {
const room = rooms[data.roomId];
if (room) {
const targetId = room.blind === socket.id ? room.helper : room.blind;
if (targetId) {
io.to(targetId).emit('ice-candidate', data.candidate);
}
}
});

// Завершение звонка
socket.on('call-end', (data) => {
const room = rooms[data.roomId];
if (room) {
const targetId = room.blind === socket.id ? room.helper : room.blind;
if (targetId) {
io.to(targetId).emit('call-ended');
}
delete rooms[data.roomId];
}
});

socket.on('disconnect', () => {
console.log('User disconnected');
});
});

server.listen(PORT, () => {
console.log('Server running on port', PORT);
});
