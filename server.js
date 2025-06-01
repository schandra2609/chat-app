import net from "net";
import os from "os";
import chalk from "chalk";

const clients = new Map();

const fetchIPv4 = () => {
    const interfaces = os.networkInterfaces();
    for (const interfaceName in interfaces) {
        const var_interface = interfaces[interfaceName];
        if (var_interface) {
            for (const net_info of var_interface) {
                if (net_info.family === 'IPv4' && !net_info.internal) { return net_info.address; }
            }
        }
    }
    return '127.0.0.1';
}

const sendJson = (socket, data) => {
    if (socket && socket.writable) {
        try {
            socket.write(JSON.stringify(data) + '\n');
        } catch (e) {
            console.error(chalk.red(`Error sending JSON data to ${socket.remoteAddress}:${socket.remotePort}: ${e.message}`));
        }
    }
};

const server = net.createServer((socket) => {
    const clientIdentifier = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(chalk.blue(`Connection attempt from: ${clientIdentifier}`));
    socket.setEncoding('utf8');

    let clientBuffer = "";

    socket.on("data", (data) => {
        clientBuffer += data.toString();
        let boundary = clientBuffer.indexOf("\n");

        while(boundary !== -1) {
            const singleMessageString = clientBuffer.substring(0, boundary);
            clientBuffer = clientBuffer.substring(boundary + 1);

            try {
                const message = JSON.parse(singleMessageString);
                console.log(chalk.gray(`RCVD from ${clientIdentifier}:`), message);

                switch(message.type) {
                    case 'REGISTER':
                        clients.set(clientIdentifier, {
                            socket,
                            name: message.name || '',
                            public_key: message.public_key
                        });
                        socket.identifier = clientIdentifier;
                        const clientDisplayName = message.name || clientIdentifier;
                        console.log(chalk.greenBright(`Client ${chalk.bold(clientDisplayName)} registered with public key.`));
                        sendJson(socket, { type: "REGISTER_ACK", identifier: clientIdentifier });
                        break;
                    case 'LIST_REQUEST':
                        const clientList = [];
                        clients.forEach((clientData, id) => {
                            clientList.push({ identifier: id, name: clientData.name });
                        });
                        sendJson(socket, { type: 'CLIENT_LIST', list: clientList });
                        console.log(chalk.cyan(`Sent client list to ${clients.get(clientIdentifier)?.name || clientIdentifier}`));
                        break;
                    case "START_CHAT_REQUEST_PK":
                        const requesterInfo = clients.get(clientIdentifier);
                        const targetIdentifier = message.targetIdentifier;
                        let targetClientData = clients.get(targetIdentifier);

                        if (!targetClientData && targetIdentifier) {
                            for (const [id, clientEntry] of clients.entries()) {
                                if (clientEntry.name === targetIdentifier && id !== clientIdentifier) {
                                    targetClientData = clientEntry;
                                    message.targetIdentifier = id;
                                    break;
                                }
                            }
                        }

                        if (targetClientData) {
                            sendJson(socket, {
                                type: 'START_CHAT_INFO',
                                identifier: message.targetIdentifier,
                                name: targetClientData.name,
                                public_key: targetClientData.public_key
                            });
                            console.log(chalk.magenta(`Sent public key of ${targetClientData.name || message.targetIdentifier} to ${requesterInfo?.name || clientIdentifier}`));
                        } else {
                            sendJson(socket, {
                                type: 'TARGET_NOT_FOUND',
                                identifier: message.targetIdentifier,
                                message: 'Receiver not found or offline.'
                            });
                            console.log(chalk.yellow(`Target "${message.targetIdentifier}" not found for ${requesterInfo?.name || clientIdentifier}`));
                        }
                        break;
                    case "MESSAGE":
                        const { receiver, encryptedMessage } = message;
                        const senderIdentifier = clientIdentifier;
                        const senderClient = clients.get(senderIdentifier);
                        const receiverClient = clients.get(receiver);

                        if (!senderClient) {
                            console.log(chalk.red(`Message from unregistered/unknown sender socket ${senderIdentifier}. Ignoring.`));
                            return;
                        }

                        console.log(chalk.blueBright('\n--- Encrypted Message Transaction ---'));
                        console.log(chalk.blue(`From: ${senderClient.name || senderIdentifier}`));

                        const encryptedContentPreview = Array.isArray(encryptedMessage)
                                ? `[${encryptedMessage.slice(0, 3).join(', ')}${encryptedMessage.length > 3 ? ', ...' : ''}] (Length: ${encryptedMessage.length})`
                                : `${String(encryptedMessage).substring(0, 50)}...`;
                        console.log(chalk.yellow(`Content (Encrypted): ${encryptedContentPreview}`));
                        console.log(chalk.blue(`To: ${receiverClient ? (receiverClient.name || receiver) : receiver}`));
                        console.log(chalk.blueBright('-----------------------------------\n'));
                        
                        if (receiverClient && receiverClient.socket.writable) {
                            sendJson(receiverClient.socket, {
                                type: 'INCOMING_MESSAGE',
                                sender: senderIdentifier,
                                senderName: senderClient.name,
                                encryptedMessage: encryptedMessage
                            });
                        } else {
                            if (senderClient.socket.writable) {
                                sendJson(senderClient.socket, {
                                    type: 'DELIVERY_ERROR',
                                    recipient: receiver,
                                    reason: 'User is offline or does not exist.'
                                });
                            }
                            console.log(chalk.red(`Message for ${receiver} could not be delivered. User offline or does not exist.`));
                        }
                        break;
                    default:
                        console.log(chalk.yellow(`Unknown message type from ${clientIdentifier}: ${message.type}`));
                        sendJson(socket, { type: 'ERROR', message: `Unknown command type: ${message.type}` });
                }
            } catch(e) {
                console.error(chalk.red(`Error processing data from ${clientIdentifier}: ${e.message} (Data: "${singleMessageString}")`));
                sendJson(socket, { type: 'ERROR', message: 'Invalid message format from client.' });
            }
            boundary = clientBuffer.indexOf('\n');
        }
    });

    socket.on('end', () => {
        const clientData = clients.get(socket.identifier || clientIdentifier);
        if (clientData) {
            clients.delete(socket.identifier || clientIdentifier);
            const clientName = clientData.name || (socket.identifier || clientIdentifier);
            console.log(chalk.redBright(`${clientName} disconnected.`));
        } else {
            console.log(chalk.redBright(`Socket ${clientIdentifier} (unregistered or already removed) ended connection.`));
        }
    });

    socket.on('error', (err) => {
        const clientData = clients.get(socket.identifier || clientIdentifier);
        const clientName = clientData ? (clientData.name || (socket.identifier || clientIdentifier)) : clientIdentifier;
        console.error(chalk.red(`Socket error for ${clientName}: ${err.message}`));
        if (clients.has(socket.identifier || clientIdentifier)) {
            clients.delete(socket.identifier || clientIdentifier);
            console.log(chalk.redBright(`${clientName} connection dropped due to error.`));
        }
    });

    socket.on('close', (hadError) => {
        console.log(chalk.gray(`Socket ${clientIdentifier} connection closed. Had error: ${hadError}`));
    });
});

const PORT = 8000;
const HOST = "0.0.0.0";
const IP = fetchIPv4();

server.listen(PORT, HOST, () => {
    console.log(chalk.white('>>>'), chalk.bgWhiteBright.black('  RSA Secure Chat Server running on', chalk.rgb(100, 170, 0).bold(`${IP}:${PORT}  `)));
    console.log(chalk.yellow('Waiting for clients to connect...'));
});

process.on("SIGINT", () => {
    console.log(chalk.yellow('\nShutting down server...'));
    clients.forEach(client => {
        if (client.socket) {
            sendJson(client.socket, { type: 'SERVER_MESSAGE', message: 'Server is shutting down.' });
            client.socket.end();
        }
    });

    server.close(() => {
        console.log(chalk.red('Server closed.'));
        process.exit(0);
    });
});