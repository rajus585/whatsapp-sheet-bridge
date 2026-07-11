const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const axios = require('axios');

const SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('\n==================================================');
            console.log('👉 QR कोड तैयार है! नीचे दिए गए लिंक को कॉपी करके ब्राउज़र में खोलें और स्कैन करें:');
            console.log(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`);
            console.log('==================================================\n');
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('कनेक्शन बंद हुआ, दोबारा कनेक्ट कर रहे हैं:', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('बधाई हो! WhatsApp सफलतापूर्वक कनेक्ट हो गया है।');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        if (m.type === 'notify') {
            for (const msg of m.messages) {
                if (!msg.key.fromMe && msg.message?.conversation) {
                    const fromNumber = msg.key.remoteJid.split('@')[0];
                    const senderName = msg.pushName || "Unknown";
                    const messageText = msg.message.conversation;

                    console.log(`नया मैसेज: ${fromNumber} - ${messageText}`);

                    if (SCRIPT_URL) {
                        try {
                            await axios.post(SCRIPT_URL, {
                                from: fromNumber,
                                name: senderName,
                                message: messageText
                            });
                            console.log('डेटा Google Sheet में सेव हो गया।');
                        } catch (err) {
                            console.error('Sheet में भेजने में त्रुटि:', err.message);
                        }
                    }
                }
            }
        }
    });
}

connectToWhatsApp();
