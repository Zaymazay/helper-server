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

let helperSocketId = null;

io.on('connection', (socket) => {
console.log('Connected:', socket.id);

socket.on('register-helper', () => {
helperSocketId = socket.id;
console.log('Helper registered:', socket.id);
});

socket.on('call-request', () => {
console.log('Call request received');
if (helperSocketId) {
io.to(helperSocketId).emit('call-request');
}
});

socket.on('webrtc-offer', (data) => io.emit('webrtc-offer', data));
socket.on('webrtc-answer', (data) => io.emit('webrtc-answer', data));
socket.on('ice-candidate', (data) => io.emit('ice-candidate', data));
socket.on('call-end', () => io.emit('call-ended'));
});

app.post('/trigger-call', (req, res) => {
console.log('Trigger call from external');
io.emit('call-request');
res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
console.log(`Server is running on port ${PORT}`);
});
