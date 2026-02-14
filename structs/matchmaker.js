const { createHash } = require("crypto");
const WebSocketServer = require("ws").Server;
const express = require("express");

const port = 100;
const wss = new WebSocketServer({ noServer: true });
const app = express();

let matchmakerState = {
    connectedClients: 0,
    matchId: "",
    sessionId: "",
    postRequestReceived: false,
    queueOpen: true,
    gameOpen: false,
    players: 0,
};

wss.on('listening', () => {});

async function handleConnection(ws, req) {
    if (ws.protocol && ws.protocol.toLowerCase().includes("xmpp")) {
        return ws.close();
    }

    const clientIp = (req && req.socket && req.socket.remoteAddress) || (ws._socket && ws._socket.remoteAddress) || "0.0.0.0";
    matchmakerState.connectedClients++;

    const ticketId = createHash('md5').update(`1${Date.now()}`).digest('hex');
    const matchId = createHash('md5').update(`2${Date.now()}`).digest('hex');
    const sessionId = createHash('md5').update(`3${Date.now()}`).digest('hex');

    setTimeout(() => logAndExecute(Connecting), 20);
    setTimeout(() => logAndExecute(Waiting), 40);
    setTimeout(() => logAndExecute(Queued), 60);
    setTimeout(() => logAndExecute(SessionAssignment), 80);

    async function Connecting() {
        ws.send(JSON.stringify({
            payload: { state: "Connecting" },
            name: "StatusUpdate"
        }));
        console.log(`[${clientIp}] QUEUED`);
    }

    async function Waiting() {
        ws.send(JSON.stringify({
            payload: {
                totalPlayers: 1,
                connectedPlayers: matchmakerState.connectedClients,
                state: "Waiting"
            },
            name: "StatusUpdate"
        }));
    }

    async function Queued() {
        if (matchmakerState.queueOpen) {
            const queuedPlayers = matchmakerState.connectedClients;
            const estimatedWaitSec = queuedPlayers * 2;
            const status = queuedPlayers === 0 ? 2 : 3;
            const refresh = queuedPlayers > 0;
            ws.send(JSON.stringify({
                payload: {
                    ticketId: ticketId,
                    queuedPlayers: queuedPlayers,
                    estimatedWaitSec: estimatedWaitSec,
                    status: status,
                    state: "Queued"
                },
                name: "StatusUpdate"
            }));
            if (refresh) {
                setTimeout(() => logAndExecute(Queued), 1800);
            }
        } else {
        }
    }

    async function SessionAssignment() {
        while (!matchmakerState.gameOpen) {
            await new Promise((resolve) => setTimeout(resolve, 200));
        }

        ws.send(JSON.stringify({
            payload: {
                matchId: matchId,
                state: "SessionAssignment"
            },
            name: "StatusUpdate"
        }));

        setTimeout(() => logAndExecute(Join), 20);
    }

    async function Join() {
        if (matchmakerState.gameOpen) {
            ws.send(JSON.stringify({
                payload: {
                    matchId: matchId,
                    sessionId: sessionId,
                    joinDelaySec: 3
                },
                name: "Play"
            }));
        } else {
        }
    }

    async function logAndExecute(callback) {
        callback();
    }

    ws.on('close', () => {
        matchmakerState.connectedClients--;
    });
}

wss.on('connection', handleConnection);

const server = app.listen(port, () => {
    server.on('upgrade', (request, socket, head) => {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    });
});

app.get('/start', (req, res) => {
    if (matchmakerState.gameOpen && matchmakerState.postRequestReceived) {
        res.json({
            error: 'Already started',
            success: false
        });
        return;
    }
    matchmakerState.gameOpen = true;
    matchmakerState.postRequestReceived = true;
    res.json({ success: true });
});

app.get('/close', (req, res) => {
    if (!matchmakerState.gameOpen && !matchmakerState.postRequestReceived) {
        res.json({
            error: 'Already closed',
            success: false
        });
        return;
    }
    matchmakerState.gameOpen = false;
    matchmakerState.postRequestReceived = false;
    res.json({ success: true });
});

module.exports = (ws, req) => handleConnection(ws, req);