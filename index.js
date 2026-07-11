const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode-terminal');
const axios = require('axios');

// यह URL सर्वर की एनवायरनमेंट सेटिंग से आएगा
const SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('--- QR CODE READY ---');
            QRCode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed, reconnecting:', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('WhatsApp connected successfully and running 24/7!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        if (m.type === 'notify') {
            for (const msg of m.messages) {
                // सिर्फ आने वाले (Incoming) टेक्स्ट मैसेजेस के लिए
                if (!msg.key.fromMe && msg.message?.conversation) {
                    const fromNumber = msg.key.remoteJid.split('@')[0];
                    const senderName = msg.pushName || "Unknown";
                    const messageText = msg.message.conversation;

                    console.log(`New Message: ${fromNumber} - ${messageText}`);

                    if (SCRIPT_URL) {
                        try {
                            await axios.post(SCRIPT_URL, {
                                from: fromNumber,
                                name: senderName,
                                message: messageText
                            });
                            console.log('Data successfully sent to Google Sheet.');
                        } catch (err) {
                            console.error('Error sending to Sheet:', err.message);
                        }
                    }
                }
            }
        }
    });
}

connectToWhatsApp();
