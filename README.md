# 🔐 Encrypted Chat (Console-Based)

> Real-time, RSA-secured, end-to-end encrypted chat application with built-in Hamming (7,4) error detection and correction — all in the terminal.

This is a terminal-based encrypted messaging system built with Node.js and TCP sockets. It allows clients to communicate privately over a network using **asymmetric RSA encryption** and ensures data integrity using the **Hamming (7,4) code**. The server knows **only your public key** — the private key never leaves the client.

---

## 🚀 Features

- 🛡️ **End-to-End RSA Encryption**  
  Messages are encrypted with the recipient's public key and decrypted with your private key.

- 🧠 **Hamming (7,4) Error Correction**  
  Every character is encoded with Hamming Code to detect and correct single-bit transmission errors.

- 🧑‍🤝‍🧑 **Peer-to-Peer Private Chat**  
  Start encrypted chats with any connected client by their `IP:PORT` or name.

- 📜 **No Server Snooping**  
  The server only knows your IP, name (optional), and RSA public key. No message content is ever visible to it.

- 🧼 **Clean Terminal UI**  
  Built with `chalk` and `readline` for a reactive, colored CLI experience.

---

## 🧱 Tech Stack

- **Language**: JavaScript (Node.js)
- **Networking**: TCP sockets via `net` module
- **Crypto**: Native RSA key generation + encryption logic
- **Error Correction**: Hamming (7,4) implementation from scratch
- **CLI Styling**: `chalk`, `readline`

---

## 🛠️ Setup Instructions

### **1. Install Prerequisites**
Make sure Node.js is installed
```bash
node --version
npm --version
```

### **2. Clone the Repository**
```bash
git clone https://github.com/your-username/EncryptedChatApp.git
cd EncryptedChatApp
```

### **3. Install Dependencies**
```bash
npm install
```

### **4. Start the Server**
```bash
npm run server
```

### **5. Start the Clients (in a new terminal window)**
```bash
npm run client
```

### **6. Connect & Chat**
- Use the in-app prompt to connect to the server:
```bash
>--connect {SERVER_IP:PORT}--<
```

- List connected clients:
```bash
>--list--<
```

- Start an encrypted chat:
```bash
>--start chat {CLIENT_IP:PORT}--<
```

- Begin sending secure messages 🔐

---

## 💬 Supported Commands (Client Side)
| Command                        | Description                 |
|--------------------------------|-----------------------------|
| `>--connect {IP:PORT}--<`      | Connect to a server         |
| `>--list--<`                   | View list of online clients |
| `>--start chat {IP:PORT}--<`   | Start a secure private chat |
| `>--stop chat--<`              | End the current chat        |
| `>--clear--<`                  | Clear the terminal          |
| `>--disconnect--<`             | Disconnect from server      |
| `>--terminate--<`              | Exit the client app         |
| `>--help--<`                   | Show help menu              |

---

## 🧪 Under the Hood
- **RSA Encryption:** Hand-rolled key pair generation (`e`, `d`, `n`), message encryption per char.
- **Hamming (7, 4):** Encodes every 4-bit nibble of a char into a 7-bit codeword. Decodes with error correction.
- **Client Identity:** Based on IP:PORT + optional name.
- **No Group Chat:** This version is purely 1-to-1 secure chat.

---

## 🔐 Security Note
- Private keys never leave the client.
- All messages are encrypted using the recipient's public key before being sent.
- Server acts only as a broker — it never sees or stores plaintext data.

---

## ✍️ Author
### Sayan Chandra
Feel free to reach out with questions or suggestions:
- [📧 E-mail](mailto:sayanchandra89@gmail.com)
- [🐙 GitHub](https://github.com/schandra2609)
- [📱 WhatsApp](https://wa.me/919883126020)
- 📞 +91-9883126020

---

## 🧠 Final Note
This is not just a toy — it’s a playground for exploring real cryptography, network communication, and error correction all wrapped into one dope terminal app.