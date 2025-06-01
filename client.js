import net from "net";
import chalk from "chalk";
import readline from "readline";
import RSA from "./utils/rsa.js";
import HammingCode74 from "./utils/hamming.js";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const INITIAL_ME_STATE = {
    socket: null,
    receiver: null,
    keys: null,
    name: "",
    identifier: "",
    server: { host: null, port: null },
    isConnected: false,
};

const ME_INIT = JSON.parse(JSON.stringify(INITIAL_ME_STATE));
let ME = JSON.parse(JSON.stringify(INITIAL_ME_STATE));


// ===============<< Prompt Management >>===============
const getPromptString = () => chalk.cyan.bold(`${ME.name ||ME.identifier || "YOU"}>> `);
const updatePrompt = () => {
    rl.setPrompt(getPromptString());
    rl.prompt(true);
};


// ===============<< Display Message >>===============
const displayMessage = (sender, message, color = chalk.whiteBright) => {
    const currentLine = rl.line;
    const currentCursorPos = rl.cursor;

    readline.cursorTo(process.stdout, 0);
    readline.clearLine(process.stdout, 0);

    console.log(color(sender.toUpperCase() === "SYSTEM" ? message : `${sender} :: ${message}`));
    updatePrompt();

    if (currentLine !== undefined) {
        rl.write(currentLine);
        readline.cursorTo(process.stdout, rl.getPrompt().length + currentCursorPos);
    }
};

const showHelp = () => {
    const helpText = `
${chalk.yellowBright.bold('Available Commands:')}
  ${chalk.cyan('>--connect {SERVER_IP:PORT}--<')}           Connects to the specified server.
  ${chalk.cyan('>--list--<')}                               Lists connected clients (must be connected to server).
  ${chalk.cyan('>--start chat {CLIENT_IP:PORT}--<')}        Starts an encrypted chat with the client identified.
  ${chalk.cyan('>--stop chat--<')}                          Stops the current private chat.
  ${chalk.cyan('>--clear--<')}                              Clears the terminal window.
  ${chalk.cyan('>--disconnect--<')}                         Disconnects from the server.
  ${chalk.cyan('>--terminate--<')}                          Exits the chat client application.
  ${chalk.cyan('>--help--<')}                               Shows this help message.

${chalk.gray('Any other input is treated as a message to the current chat partner (if active).')}
`;
    displayMessage("SYSTEM", helpText, chalk.white);
};


// ===============<< Client State Manager >>===============
const resetClientState = (preserveKeysAndName = true) => {
    const tempKeys = preserveKeysAndName ? ME.keys : null;
    const tempName = preserveKeysAndName ? ME.name : "";

    ME = JSON.parse(JSON.stringify(ME_INIT));

    ME.keys = tempKeys;
    ME.name = tempName;

    if(ME.socket) {
        ME.socket.destroy();
        ME.socket = null;
    }

    displayMessage('SYSTEM', 'Disconnected from server.', chalk.yellow);
    updatePrompt();
};


// ===============<< Command Handlers >>===============

const handleConnectCommand = (args) => {
    if (ME.isConnected) {
        displayMessage('SYSTEM', 'Already connected. Use >--disconnect--< first.', chalk.yellow);
        return;
    }

    const parts = args.split(':');
    if (parts.length !== 2 || !parts[0] || !parts[1] || isNaN(parseInt(parts[1]))) {
        displayMessage('SYSTEM', 'Invalid format. Use: >--connect {SERVER_IP:PORT}--<', chalk.red);
        return;
    }

    const host = parts[0], port = parseInt(parts[1]);
    ME.server = { host, port };
    displayMessage('SYSTEM', `Attempting to connect to ${host}:${port}...`, chalk.yellow);

    ME.socket = net.createConnection({ host, port }, () => {
        ME.isConnected = true;
        displayMessage('SYSTEM', `Connected to ${host}:${port}!`, chalk.green);
        registerWithServer();
    });

    ME.socket.setEncoding("utf-8");
    let clientBuffer = "";

    ME.socket.on("data", (data) => {
        clientBuffer += data;
        let boundary = clientBuffer.indexOf("\n");
        while(boundary !== -1) {
            const singleMessage = clientBuffer.substring(0, boundary);
            clientBuffer = clientBuffer.substring(boundary + 1);
            try {
                const serverMessage = JSON.parse(singleMessage);
                processServerData(serverMessage);
            } catch (error) {
                displayMessage('SYSTEM', `Error processing server data: ${error.message}. Raw: ${singleMessage}`, chalk.red);
            }
            boundary = clientBuffer.indexOf('\n');
        }
    });

    ME.socket.on('end', () => {
        if (ME.isConnected) {
            displayMessage('SYSTEM', 'Connection ended by server.', chalk.redBright);
            resetClientState();
        }
    });

    ME.socket.on('close', (hadError) => {
        if (ME.isConnected) {
            displayMessage('SYSTEM', `Connection closed ${hadError ? 'due to an error' : 'unexpectedly'}.`, chalk.redBright);
            resetClientState();
        }
    });

    ME.socket.on('error', (err) => {
        displayMessage('SYSTEM', `Connection error: ${err.message}`, chalk.red);
        if (err.code === 'ECONNREFUSED' && ME.server.host && ME.server.port) { displayMessage('SYSTEM', `Ensure server is running at ${ME.server.host}:${ME.server.port}.`, chalk.yellow); }
        if(ME.isConnected){ resetClientState(); }
    });
};

const handleDisconnectCommand = (showMsg = true) => {
    if(!ME.isConnected) {
        displayMessage("SYSTEM", "Not currently connected.", chalk.yellow);
        return;
    }

    if (ME.socket) {
        try {
            if (showMsg) { displayMessage('SYSTEM', 'Disconnecting from server...', chalk.blue); }
            ME.socket.end();
        } catch (e) {
            displayMessage("SYSTEM", "Error ending connection.", chalk.red);
            if (ME.socket) { ME.socket.destroy(); }
            resetClientState();
        }
    } else { resetClientState(); }
};

const handleListCommand = () => {
    if (!ME.isConnected) {
        displayMessage('SYSTEM', 'Not connected. Use >--connect--< first.', chalk.yellow);
    } else {
        ME.socket.write(JSON.stringify({ type: 'LIST_REQUEST' }) + '\n');
    }
};

const handleStartChatCommand = (args) => {
    if (!ME.isConnected) {
        displayMessage('SYSTEM', 'Not connected to the server.', chalk.yellow);
        return;
    }
    const targetIdentifier = args.trim();
    if (!targetIdentifier) {
        displayMessage('SYSTEM', 'Usage: >--start chat {CLIENT_IP:PORT}--<', chalk.yellow);
        return;
    }
    if (targetIdentifier === ME.identifier) {
        displayMessage('SYSTEM', "You cannot start a chat with yourself.", chalk.yellow);
        return;
    }
    ME.socket.write(JSON.stringify({ type: 'START_CHAT_REQUEST_PK', targetIdentifier }) + '\n');
};

const handleStopChatCommand = () => {
    if (ME.receiver) {
        const receiverName = ME.receiver.name || ME.receiver.identifier;
        displayMessage('SYSTEM', `Exiting chat with ${chalk.bold(receiverName)}.`, chalk.bgMagentaBright.black);
        ME.receiver = null;
    } else {
        displayMessage('SYSTEM', 'Not currently in a private chat.', chalk.yellow);
    }
};

const handleClearCommand = () => {
    console.clear();
    process.stdout.write('\x1B[2J\x1B[0f');
    updatePrompt();
};

const handleTerminateCommand = () => {
    displayMessage('SYSTEM', 'Terminating client application...', chalk.blue);
    rl.close();
    process.exit(0);
};

// ===============<< Network and Application Logic >>===============
const registerWithServer = () => {
    if(!ME.keys) {
        displayMessage('SYSTEM', 'Generating RSA keys...', chalk.yellow);
        try {
            ME.keys = RSA.generate_rsa_keys();
            displayMessage('SYSTEM', 'RSA keys generated.', chalk.green);
        } catch(e) {
            displayMessage('SYSTEM', `Critical error generating RSA keys: ${e.message}. Disconnecting...`, chalk.red);
            handleDisconnectCommand(false);
            return;
        }
    }

    if(ME.name === "") {
        rl.question(chalk.blue("Enter your name (press Enter to skip): "), (nameInput) => {
            ME.name = nameInput.trim();
            if (ME.socket && ME.socket.writable) {
                ME.socket.write(JSON.stringify({
                    type: 'REGISTER',
                    name: ME.name,
                    public_key: ME.keys.public_key
                }) + '\n');
            } else {
                displayMessage('SYSTEM', 'Connection lost before completing registration.', chalk.red);
                if (ME.isConnected) { resetClientState(); }
            }
            updatePrompt();
        });
    } else {
        if (ME.socket && ME.socket.writable) {
            ME.socket.write(JSON.stringify({
                type: 'REGISTER',
                name: ME.name,
                public_key: ME.keys.public_key
            }) + '\n');
        }
    }
};


const processServerData = (serverMessage) => {
    switch(serverMessage.type) {
        case "REGISTER_ACK":
            ME.identifier = serverMessage.identifier;
            displayMessage('SYSTEM', `Successfully registered with server as ${chalk.bold(ME.name || ME.identifier)}.`, chalk.greenBright);
            break;
        case "CLIENT_LIST":
            let listOutput = chalk.yellow('\n--- Connected Clients ---');
            if (!serverMessage.list || serverMessage.list.length === 0) {
                listOutput += `\n${chalk.italic('No other clients connected or list is empty.')}`;
            } else {
                let otherClientsCount = 0;
                serverMessage.list.forEach((c) => {
                    if (c.identifier !== ME.identifier) {
                        otherClientsCount++;
                        listOutput += `\n${chalk.whiteBright.bold((otherClientsCount < 10 ? "0" : "") + `${otherClientsCount}. ${c.name || 'Unnamed'} (${c.identifier})`)}`;
                    }
                });
                if (otherClientsCount === 0 && ME.identifier) { listOutput += `\n${chalk.italic.gray('You are the only one connected.')}`; }
                else if (otherClientsCount === 0) listOutput += `\n${chalk.italic.gray('No other clients available.')}`;
            }
            listOutput += chalk.yellow('\n-------------------------');
            displayMessage('SYSTEM', listOutput);
            break;
        case 'START_CHAT_INFO':
            ME.receiver = {
                identifier: serverMessage.identifier,
                name: serverMessage.name,
                public_key: serverMessage.public_key
            };
            const receiverDisplayName = ME.receiver.name || ME.receiver.identifier;
            displayMessage('SYSTEM', `Entering chat with ${chalk.bold(receiverDisplayName)}. Encrypted chat active.`, chalk.bgMagenta.black.bold);
            break;
        case 'TARGET_NOT_FOUND':
            displayMessage('SYSTEM', `Could not start chat with ${serverMessage.identifier}: ${serverMessage.message}`, chalk.red);
            break;
        case 'INCOMING_MESSAGE':
            const { sender, senderName, encryptedMessage } = serverMessage;
            if (!ME.keys || !ME.keys.private_key) {
                displayMessage('SYSTEM', 'Error: Your private key is not available for decryption.', chalk.red);
                return;
            }
            try {
                const decryptedHamming = RSA.decrypt_message(encryptedMessage, ME.keys.private_key);
                let decryptedMessage = "";
                try {
                    decryptedMessage = HammingCode74.decodeMessage(decryptedHamming);
                } catch (err) {
                    displayMessage('SYSTEM', 'Hamming decode failed: ' + err.message, chalk.red);
                    return;
                }
                const displaySenderName = senderName || sender;
                if (ME.receiver && ME.receiver.identifier === sender) { displayMessage(chalk.yellowBright(displaySenderName), decryptedMessage); }
                else { displayMessage(chalk.magenta(`Message from ${sender} (${displaySenderName})`), decryptedMessage); }
            } catch (e) {
                displayMessage('SYSTEM', `Failed to decrypt message from ${senderName || sender}: ${e.message}`, chalk.red);
            }
            break;
        case 'DELIVERY_ERROR':
            displayMessage('SYSTEM', `Message to ${serverMessage.recipient} failed: ${serverMessage.reason}`, chalk.red);
            break;
        case 'SERVER_MESSAGE':
            displayMessage('SERVER', serverMessage.message, chalk.blueBright);
            break;
        // case ''
        default:
            displayMessage('SERVER (unknown type)', JSON.stringify(serverMessage), chalk.gray);
    }
    updatePrompt();
};

const sendChatMessage = (text) => {
    if (!ME.isConnected) {
        displayMessage('SYSTEM', "Not connected. Cannot send message.", chalk.yellow);
        return;
    }
    if (!ME.receiver || !ME.receiver.public_key) {
        displayMessage('SYSTEM', "No active chat partner or partner's key missing.", chalk.yellow);
        return;
    }
    if (!ME.keys || !ME.keys.public_key) {
        displayMessage('SYSTEM', "Your public key is missing. Cannot identify sender.", chalk.red);
        return;
    }
    try {
        const hammingEncoded = HammingCode74.encodeMessage(text);
        const encryptedMessage = RSA.encrypt_message(hammingEncoded, ME.receiver.public_key);
        ME.socket.write(JSON.stringify({
            type: 'MESSAGE',
            receiver: ME.receiver.identifier,
            encryptedMessage: encryptedMessage
        }) + '\n');

        const senderDisplayName = ME.name || "YOU";
        displayMessage(senderDisplayName, text, chalk.greenBright);

        readline.moveCursor(process.stdout, 0, -1);
        readline.clearLine(process.stdout, 0);
    } catch (e) {
        displayMessage('SYSTEM', `Error encrypting message: ${e.message}`, chalk.red);
    }
};



// ===============<< Main Readline Event Handler >>===============

rl.on("line", (line) => {
    const input = line.trim();
    const commandMatch = input.match(/^>--(\w+)(?:\s+(.*?))?--<$/);

    if(commandMatch) {
        const command = commandMatch[1].toLowerCase();
        const args = commandMatch[2] || "";

        switch(command) {
            case "connect":
                handleConnectCommand(args);
                break;
            case "disconnect":
                handleDisconnectCommand();
                break;
            case "list":
                handleListCommand();
                break;
            case "start":
                if(args.toLowerCase().startsWith("chat ")) { handleStartChatCommand(args.substring(5)); }
                else { displayMessage('SYSTEM', `Invalid command. Enter '>--help--<' for help.`, chalk.red); }
                break;
            case "stop":
                if (args.toLowerCase() === 'chat') { handleStopChatCommand(); }
                else { displayMessage('SYSTEM', `Invalid command. Enter '>--help--<' for help.`, chalk.red); }
                break;
            case "clear":
                handleClearCommand();
                break;
            case "terminate":
                handleTerminateCommand();
                break;
            case "help":
                showHelp();
                break;
            default:
                displayMessage('SYSTEM', `Invalid command entered. Enter '>--help--<' for help.`, chalk.red);
        }
    } else {
        if (input === '') {
            // Just an enter press, do nothing, prompt will redraw
        } else if (ME.receiver) {
            sendChatMessage(input);
        } else if (ME.isConnected) {
            displayMessage('SYSTEM', "No active chat. Use '>--start chat {CLIENT_IP:PORT}--<' or '>--help--<'.", chalk.yellow);
        } else {
            displayMessage('SYSTEM', "Not connected. Use '>--connect {SERVER_IP:PORT}--<' or '>--help--<'.", chalk.yellow);
        }
    }
    updatePrompt();
});

rl.on('close', () => {
    displayMessage('SYSTEM', '\nExiting chat client. Goodbye!', chalk.blue);
    if (ME.socket) { ME.socket.destroy(); }
    process.exit(0);
});


// ===============<< Initial Execution >>===============
console.log(chalk.bold.cyan("--- RSA Secure Chat Client ---"));
console.log(chalk.gray("Type '>--help--<' for a list of commands."));
updatePrompt();