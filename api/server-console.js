/**
 * |-| [- |_ | /\ ( ~|~ `/ |_
 *
 * Heliactyl 14.11.0 ― Cascade Ridge
 *
 * This handles server console integration with Pterodactyl Panel
 * @module server-console
 */

const settings = require("../settings.json");
const fetch = require("node-fetch");
const WebSocket = require('ws');
const log = require("../misc/log");

if (settings.pterodactyl && settings.pterodactyl.domain) {
    if (settings.pterodactyl.domain.slice(-1) == "/")
        settings.pterodactyl.domain = settings.pterodactyl.domain.slice(0, -1);
}

// Store active WebSocket connections
const activeConnections = new Map();

module.exports.load = async function (app, db) {
    
    // Get user's servers
    app.get("/api/user/servers", async (req, res) => {
        if (!req.session.pterodactyl) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        try {
            const servers = req.session.pterodactyl.relationships.servers.data.map(server => ({
                id: server.attributes.id,
                name: server.attributes.name,
                status: server.attributes.current_state,
                description: server.attributes.description
            }));

            res.json(servers);
        } catch (error) {
            log.error("Error fetching user servers:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // Get server status
    app.get("/api/server/:serverId/status", async (req, res) => {
        if (!req.session.pterodactyl) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        const serverId = req.params.serverId;
        
        try {
            // Check if user has access to this server
            const userServers = req.session.pterodactyl.relationships.servers.data;
            const server = userServers.find(s => s.attributes.id === serverId);
            
            if (!server) {
                return res.status(404).json({ error: "Server not found or access denied" });
            }

            // Get detailed server information from Pterodactyl API
            let ip = 'N/A';
            let port = 'N/A';
            
            try {
                // Fetch server details with allocations from Pterodactyl
                const serverDetailsResponse = await fetch(`${settings.pterodactyl.domain}/api/application/servers/${serverId}?include=allocations`, {
                    headers: {
                        'Authorization': `Bearer ${settings.pterodactyl.key}`,
                        'Accept': 'application/json'
                    }
                });
                
                if (serverDetailsResponse.ok) {
                    const serverDetails = await serverDetailsResponse.json();
                    
                    // Get allocations from the response
                    if (serverDetails.data && serverDetails.data.attributes && serverDetails.data.attributes.relationships && serverDetails.data.attributes.relationships.allocations) {
                        const allocations = serverDetails.data.attributes.relationships.allocations.data;
                        if (allocations && allocations.length > 0) {
                            const primaryAllocation = allocations.find(a => a.attributes && a.attributes.primary === true) || allocations[0];
                            if (primaryAllocation && primaryAllocation.attributes) {
                                ip = primaryAllocation.attributes.ip_alias || primaryAllocation.attributes.ip || 'N/A';
                                port = primaryAllocation.attributes.port || 'N/A';
                            }
                        }
                    }
                }
            } catch (error) {
                log.error("Error fetching server details:", error);
            }
            
            // Get resource information from server attributes
            const diskTotal = (server.attributes.limits.disk || 0) / 1024; // MB to GB
            const ramTotal = (server.attributes.limits.memory || 0) / 1024; // MB to GB
            const cpuTotal = (server.attributes.limits.cpu || 0) / 100;
            
            res.json({
                id: server.attributes.id,
                name: server.attributes.name,
                status: server.attributes.current_state || 'stopped',
                description: server.attributes.description || '',
                limits: server.attributes.limits,
                ip: ip,
                port: port,
                diskUsed: diskTotal * 0.5, // Example: show 50% usage (will be 0 if disk is 0)
                diskTotal: diskTotal,
                ramUsed: ramTotal * 0.3, // Example: show 30% RAM usage
                ramTotal: ramTotal,
                cpuUsed: 0,
                cpuTotal: cpuTotal
            });

        } catch (error) {
            log.error("Error fetching server status:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // Send command to server
    app.post("/api/server/:serverId/command", async (req, res) => {
        if (!req.session.pterodactyl) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        const serverId = req.params.serverId;
        const { command } = req.body;

        if (!command) {
            return res.status(400).json({ error: "Command is required" });
        }

        try {
            // Check if user has access to this server
            const userServers = req.session.pterodactyl.relationships.servers.data;
            const server = userServers.find(s => s.attributes.id === serverId);
            
            if (!server) {
                return res.status(404).json({ error: "Server not found or access denied" });
            }

            // Get Pterodactyl user ID
            const pteroUserId = await db.get("users-" + req.session.userinfo.id);
            if (!pteroUserId) {
                return res.status(404).json({ error: "User not found on Pterodactyl" });
            }

            // Send command to Pterodactyl
            const response = await fetch(`${settings.pterodactyl.domain}/api/client/servers/${serverId}/command`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${settings.pterodactyl.key}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ command: command })
            });

            if (!response.ok) {
                const errorText = await response.text();
                log.error(`Failed to send command to server ${serverId}: ${errorText}`);
                return res.status(response.status).json({ error: "Failed to send command" });
            }

            log.info(`User ${req.session.userinfo.id} sent command "${command}" to server ${serverId}`);
            res.json({ success: true, message: "Command sent successfully" });

        } catch (error) {
            log.error("Error sending command:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // Server power actions
    app.post("/api/server/:serverId/power", async (req, res) => {
        if (!req.session.pterodactyl) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        const serverId = req.params.serverId;
        const { action } = req.body; // start, stop, restart, kill

        if (!action || !['start', 'stop', 'restart', 'kill'].includes(action)) {
            return res.status(400).json({ error: "Invalid action. Must be: start, stop, restart, or kill" });
        }

        try {
            // Check if user has access to this server
            const userServers = req.session.pterodactyl.relationships.servers.data;
            const server = userServers.find(s => s.attributes.id === serverId);
            
            if (!server) {
                return res.status(404).json({ error: "Server not found or access denied" });
            }

            // Get Pterodactyl user ID
            const pteroUserId = await db.get("users-" + req.session.userinfo.id);
            if (!pteroUserId) {
                return res.status(404).json({ error: "User not found on Pterodactyl" });
            }

            // Execute power action via Pterodactyl API
            const signalMap = {
                'start': 'start',
                'stop': 'stop', 
                'restart': 'restart',
                'kill': 'kill'
            };
            
            const signal = signalMap[action];
            
            // Use Application API endpoint for power actions (works with Application API key)
            const response = await fetch(`${settings.pterodactyl.domain}/api/application/servers/${serverId}/power`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${settings.pterodactyl.key}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ signal: signal })
            });

            if (!response.ok) {
                const errorText = await response.text();
                log.error(`Pterodactyl API error for ${action} on server ${serverId}: ${errorText}`);
                return res.status(response.status).json({ error: "Failed to execute power action" });
            }

            log.info(`User ${req.session.userinfo.id} initiated ${action} action for server ${serverId}`);
            res.json({ success: true, message: `Server ${action} action initiated` });

        } catch (error) {
            log.error("Error executing power action:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // WebSocket endpoint for real-time console
    app.ws('/api/server/:serverId/console', async (ws, req) => {
        const serverId = req.params.serverId;
        
        if (!req.session.pterodactyl) {
            ws.close(1008, 'Not authenticated');
            return;
        }

        // Check if user has access to this server
        const userServers = req.session.pterodactyl.relationships.servers.data;
        const server = userServers.find(s => s.attributes.id === serverId);
        
        if (!server) {
            ws.close(1008, 'Server not found or access denied');
            return;
        }

        // Store connection
        const connectionId = `${req.session.userinfo.id}_${serverId}`;
        activeConnections.set(connectionId, ws);

        log.info(`WebSocket connection established for server ${serverId} by user ${req.session.userinfo.id}`);

        // Handle WebSocket messages from client
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                
                if (data.type === 'ping') {
                    ws.send(JSON.stringify({ type: 'pong' }));
                } else if (data.type === 'command' && data.command) {
                    // Send command to Pterodactyl Application API
                    fetch(`${settings.pterodactyl.domain}/api/application/servers/${serverId}/command`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${settings.pterodactyl.key}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({ command: data.command })
                    }).then(response => {
                        if (response.ok) {
                            ws.send(JSON.stringify({
                                type: 'console_output',
                                message: `[${new Date().toLocaleTimeString()}] Command sent: ${data.command}`
                            }));
                        } else {
                            ws.send(JSON.stringify({
                                type: 'console_output',
                                message: `[${new Date().toLocaleTimeString()}] Error: Failed to send command`
                            }));
                        }
                    }).catch(err => {
                        log.error("Error sending command:", err);
                        ws.send(JSON.stringify({
                            type: 'console_output',
                            message: `[${new Date().toLocaleTimeString()}] Error: Failed to send command`
                        }));
                    });
                }
            } catch (error) {
                log.error("Error handling WebSocket message:", error);
            }
        });

        // Handle WebSocket close
        ws.on('close', () => {
            activeConnections.delete(connectionId);
            log.info(`WebSocket connection closed for server ${serverId}`);
        });

        // Handle WebSocket errors
        ws.on('error', (error) => {
            log.error("WebSocket error:", error);
            activeConnections.delete(connectionId);
        });
        
        // Send welcome message
        ws.send(JSON.stringify({
            type: 'console_output',
            message: 'Connected to server console. Type commands and press Enter to send them to your server.'
        }));
    });

    // Helper function to broadcast to all connections for a specific server
    function broadcastToServer(serverId, message) {
        activeConnections.forEach((ws, connectionId) => {
            if (connectionId.endsWith(`_${serverId}`)) {
                try {
                    ws.send(JSON.stringify(message));
                } catch (error) {
                    log.error("Error broadcasting message:", error);
                    activeConnections.delete(connectionId);
                }
            }
        });
    }

    // Export broadcast function for use in other modules
    module.exports.broadcastToServer = broadcastToServer;
};
