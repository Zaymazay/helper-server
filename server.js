const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;
const rooms = {};

io.on('connection', (socket) => {
console.log('User connected:', socket.id);

// Слепой создал звонок и отправил Offer
socket.on('call-request', (data) => {
const roomId = Date.now().toString();
rooms[roomId] = { blind: socket.id, helper: null, offer: data.offer };

socket.join(roomId);
socket.emit('room-created', { roomId });

// 🔥 ВАЖНО: Отправляем помощникам roomId И Offer
socket.broadcast.emit('new-call', { roomId, offer: data.offer });

console.log('Call request received:', roomId);
});

// Помощник ответил (создал Answer)
socket.on('webrtc-answer', (data) => {
const room = rooms[data.roomId];
if (room) {
room.helper = socket.id;
socket.join(data.roomId);
io.to(room.blind).emit('webrtc-answer', data.answer);
console.log('Answer sent to blind user');
}
});

// Обмен ICE кандидатами
socket.on('ice-candidate', (data) => {
const room = rooms[data.roomId];
if (room) {
const targetId = room.blind === socket.id ? room.helper : room.blind;
if (targetId) io.to(targetId).emit('ice-candidate', data.candidate);
}
});

socket.on('call-end', (data) => {
const room = rooms[data.roomId];
if (room) {
const targetId = room.blind === socket.id ? room.helper : room.blind;
if (targetId) io.to(targetId).emit('call-ended');
delete rooms[data.roomId];
}
});

socket.on('disconnect', () => {
console.log('User disconnected');
});
});

server.listen(PORT, () => console.log('Server running on port', PORT));
