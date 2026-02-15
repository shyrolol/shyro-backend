const express = require("express");
const functions = require("../structs/functions.js");
const log = require("../structs/log.js");
const WebSocket = require('ws');
const http = require('http');

const serversMap = new Map();
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

function setServerConfig(host, port, playlist) {
    const serverId = `${host}:${port}:${playlist}`;
    
    let existingQueue = [];
    
    const pendingPlaylistId = `pending:${playlist}`;
    if (serversMap.has(pendingPlaylistId)) {
        existingQueue = serversMap.get(pendingPlaylistId).queue;
        existingQueue.forEach(player => {
            player.serverId = serverId;
        });
        serversMap.delete(pendingPlaylistId);
    }
    
    const pendingDefaultId = 'pending:default';
    const pendingAllId = 'pending:all';
    const pendingSources = [pendingDefaultId, pendingAllId];
    
    for (const pendingId of pendingSources) {
        if (serversMap.has(pendingId)) {
            const pendingQueue = serversMap.get(pendingId).queue;
            if (pendingQueue.length > 0) {
                pendingQueue.forEach(player => {
                    player.serverId = serverId;
                    existingQueue.push(player);
                });
                serversMap.delete(pendingId);
            }
        }
    }
    
    if (!serversMap.has(serverId)) {
        serversMap.set(serverId, {
            host,
            port,
            playlist,
            queue: existingQueue,
            isReady: false,
            gsConfig: { host, port, playlist }
        });
    }
}

async function mmStart(host, port, playlist) {
    const serverId = `${host}:${port}:${playlist}`;
    const server = serversMap.get(serverId);
    
    if (!server) {
        return;
    }
    
    server.isReady = true;
    processQueue(serverId);
}

async function mmClose(host, port, playlist) {
    const serverId = `${host}:${port}:${playlist}`;
    const server = serversMap.get(serverId);
    
    if (!server) {
        return;
    }
    
    server.isReady = false;
}

async function processQueue(serverId) {
    const server = serversMap.get(serverId);
    
    if (!server || !server.isReady || server.queue.length === 0) {
        return;
    }
    
    const matchPlayers = [...server.queue];
    server.queue = [];
    
    for (const player of matchPlayers) {
        if (player.ws.readyState === 1) {
            const sessionData = {
                matchId: player.matchId,
                sessionId: player.sessionId,
                accountId: player.accountId,
                playlist: server.playlist,
                server: {
                    host: server.host,
                    port: server.port,
                    address: `${server.host}:${server.port}`
                },
                createdAt: new Date().toISOString()
            };
            await global.kv.set(`matchmakingSession:${player.sessionId}`, JSON.stringify(sessionData));
            await global.kv.set(`matchmakingSession:${player.matchId}`, JSON.stringify(sessionData));
            
            SessionAssignment(player.ws, player.matchId);
            await functions.sleep(50);
            Join(player.ws, player.matchId, player.sessionId);
        }
    }
}

function Connecting(ws) {
    if (ws.readyState !== 1) return;
    ws.send(JSON.stringify({
        "payload": { "state": "Connecting" },
        "name": "StatusUpdate"
    }));
}

function Waiting(ws) {
    if (ws.readyState !== 1) return;
    ws.send(JSON.stringify({
        "payload": {
            "totalPlayers": 1,
            "connectedPlayers": 1,
            "state": "Waiting"
        },
        "name": "StatusUpdate"
    }));
}

function Queued(ws, ticketId, queuedCount) {
    if (ws.readyState !== 1) return;
    ws.send(JSON.stringify({
        "payload": {
            "ticketId": ticketId,
            "queuedPlayers": queuedCount,
            "estimatedWaitSec": 0,
            "status": {},
            "state": "Queued"
        },
        "name": "StatusUpdate"
    }));
}

function SessionAssignment(ws, matchId) {
    if (ws.readyState !== 1) return;
    ws.send(JSON.stringify({
        "payload": {
            "matchId": matchId,
            "state": "SessionAssignment"
        },
        "name": "StatusUpdate"
    }));
}

function Join(ws, matchId, sessionId) {
    if (ws.readyState !== 1) return;
    ws.send(JSON.stringify({
        "payload": {
            "matchId": matchId,
            "sessionId": sessionId,
            "joinDelaySec": 1
        },
        "name": "Play"
    }));
}

app.get('/start/:host/:port/:playlist', (req, res) => {
    const { host, port: gsPort, playlist } = req.params;
    
    setServerConfig(host, parseInt(gsPort), playlist);
    mmStart(host, parseInt(gsPort), playlist);
    
    res.json({ 
        success: true, 
        message: "Server started, processing queue" 
    });
});

app.get('/close/:host/:port/:playlist', (req, res) => {
    const { host, port: gsPort, playlist } = req.params;
    mmClose(host, parseInt(gsPort), playlist);
    
    res.json({ 
        success: true, 
        message: "Server close acknowledged" 
    });
});

app.get('/status', (req, res) => {
    res.json({ 
        status: "online", 
        port: 100,
        message: "Matchmaker is up and running", 
    });
});

server.on('upgrade', (request, socket, head) => {
    if (request.url.includes('playlist_') || request.url.match(/\/[\w]+\/playlist/)) {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wsHandler(ws, request);
        });
    } else {
        socket.destroy();
    }
});

server.listen(100, () => {
    log.matchmaker(`Matchmaker started listening on port 100`);
});

const wsHandler = async (ws, req) => {
    let playlist = null;
    let accountId = null;
    
    if (req && req.url) {
        const pathParts = req.url.split('?')[0].split('/').filter(p => p);

        if (pathParts.length >= 2) {
            accountId = pathParts[pathParts.length - 2];
            playlist = pathParts[pathParts.length - 1];
        }
        
        if (!playlist || !accountId) {
            const urlParams = new URLSearchParams(req.url.split('?')[1] || '');
            if (!playlist) playlist = urlParams.get('playlist');
            if (!accountId) accountId = urlParams.get('accountId');
        }
        
    }
    
    if (!playlist) {
        let serverId = 'pending:default';
        if (!serversMap.has(serverId)) {
            serversMap.set(serverId, {
                host: null,
                port: null,
                playlist: 'default',
                queue: [],
                isReady: false,
                gsConfig: null
            });
        }
    } else {
        let serverId = Array.from(serversMap.keys()).find(id => id.endsWith(`:${playlist}`));
        
        if (!serverId) {
            serverId = `pending:${playlist}`;
            if (!serversMap.has(serverId)) {
                serversMap.set(serverId, {
                    host: null,
                    port: null,
                    playlist: playlist,
                    queue: [],
                    isReady: false,
                    gsConfig: null
                });
            }
        }
    }
    
    let serverId = playlist ? 
        (Array.from(serversMap.keys()).find(id => id.endsWith(`:${playlist}`)) || `pending:${playlist}`) :
        'pending:default';
    
    const server = serversMap.get(serverId);
    
    const ticketId = functions.MakeID().replace(/-/ig, "");
    const matchId = functions.MakeID().replace(/-/ig, "");
    const sessionId = functions.MakeID().replace(/-/ig, "");

    const player = {
        ws,
        ticketId,
        matchId,
        sessionId,
        accountId,
        state: "Connecting",
        serverId
    };

    server.queue.push(player);

    ws.on('close', () => {
        server.queue = server.queue.filter(p => p.ws !== ws);
    });

Connecting(ws);
await functions.sleep(20);
Waiting(ws);
await functions.sleep(20);
player.state = "Queued";
Queued(ws, player.ticketId, server.queue.length);

    if (server.isReady) {
        await functions.sleep(20);
        await processQueue(serverId);
    }
};

module.exports.setServerConfig = setServerConfig;
module.exports.mmStart = mmStart;
module.exports.mmClose = mmClose;
module.exports.processQueue = processQueue;
module.exports.getServersMap = () => serversMap;