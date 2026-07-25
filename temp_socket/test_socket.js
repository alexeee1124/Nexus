const { io } = require("socket.io-client");

console.log("Connecting to Render Socket.io server...");
const socket = io("https://nexus-sb6l.onrender.com", {
    transports: ["websocket", "polling"]
});

socket.on("connect", () => {
    console.log("--> CONNECTED TO SOCKET! ID:", socket.id);
});

socket.on("connect_error", (err) => {
    console.log("--> CONNECT ERROR:", err.message);
});

socket.on("newMessage", (data) => {
    console.log("--> LIVE NEW MESSAGE RECEIVED OVER SOCKET:", data);
});

setTimeout(() => {
    console.log("Stopping socket diagnostic listener...");
    process.exit();
}, 20000);
