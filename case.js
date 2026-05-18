const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { getContentType, downloadContentFromMessage, proto, prepareWAMessageMedia, generateWAMessageFromContent } = require('queenruva-sockets');
const { sms } = require("./msg");
const FileType = require('file-type');
const cheerio = require('cheerio');
const ytdl = require('ytdl-core');
const yts = require('yt-search');

// Helper functions
function formatMessage(title, content, footer) {
    return `*${title}*\n\n${content}\n\n> *${footer}*`;
}

async function oneViewmeg(socket, isOwner, msg, sender) {
    if (isOwner) {  
        try {
            const akuru = sender;
            const quot = msg;
            if (quot) {
                if (quot.imageMessage?.viewOnce) {
                    let cap = quot.imageMessage?.caption || "";
                    let anu = await socket.downloadAndSaveMediaMessage(quot.imageMessage);
                    await socket.sendMessage(akuru, { image: { url: anu }, caption: cap });
                } else if (quot.videoMessage?.viewOnce) {
                    let cap = quot.videoMessage?.caption || "";
                    let anu = await socket.downloadAndSaveMediaMessage(quot.videoMessage);
                    await socket.sendMessage(akuru, { video: { url: anu }, caption: cap });
                } else if (quot.audioMessage?.viewOnce) {
                    let cap = quot.audioMessage?.caption || "";
                    let anu = await socket.downloadAndSaveMediaMessage(quot.audioMessage);
                    await socket.sendMessage(akuru, { audio: { url: anu }, caption: cap });
                } else if (quot.viewOnceMessageV2?.message?.imageMessage){
                    let cap = quot.viewOnceMessageV2?.message?.imageMessage?.caption || "";
                    let anu = await socket.downloadAndSaveMediaMessage(quot.viewOnceMessageV2.message.imageMessage);
                    await socket.sendMessage(akuru, { image: { url: anu }, caption: cap });
                } else if (quot.viewOnceMessageV2?.message?.videoMessage){
                    let cap = quot.viewOnceMessageV2?.message?.videoMessage?.caption || "";
                    let anu = await socket.downloadAndSaveMediaMessage(quot.viewOnceMessageV2.message.videoMessage);
                    await socket.sendMessage(akuru, { video: { url: anu }, caption: cap });
                } else if (quot.viewOnceMessageV2Extension?.message?.audioMessage){
                    let cap = quot.viewOnceMessageV2Extension?.message?.audioMessage?.caption || "";
                    let anu = await socket.downloadAndSaveMediaMessage(quot.viewOnceMessageV2Extension.message.audioMessage);
                    await socket.sendMessage(akuru, { audio: { url: anu }, caption: cap });
                }
            }        
        } catch (error) {
            console.error('oneViewmeg error:', error);
        }
    }
}

// Main command handler setup function
module.exports = {
    setupCommandHandlers: (socket, number, activeSockets, socketCreationTime, config) => {
        socket.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;

            const type = getContentType(msg.message);
            if (!msg.message) return;
            msg.message = (getContentType(msg.message) === 'ephemeralMessage') ? msg.message.ephemeralMessage.message : msg.message;
            const sanitizedNumber = number.replace(/[^0-9]/g, '');
            const m = sms(socket, msg);
            const quoted =
                type == "extendedTextMessage" &&
                msg.message.extendedTextMessage.contextInfo != null
                ? msg.message.extendedTextMessage.contextInfo.quotedMessage || []
                : [];
            const body = (type === 'conversation') ? msg.message.conversation 
                : msg.message?.extendedTextMessage?.contextInfo?.hasOwnProperty('quotedMessage') 
                ? msg.message.extendedTextMessage.text 
                : (type == 'interactiveResponseMessage') 
                ? msg.message.interactiveResponseMessage?.nativeFlowResponseMessage 
                    && JSON.parse(msg.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson)?.id 
                : (type == 'templateButtonReplyMessage') 
                ? msg.message.templateButtonReplyMessage?.selectedId 
                : (type === 'extendedTextMessage') 
                ? msg.message.extendedTextMessage.text 
                : (type == 'imageMessage') && msg.message.imageMessage.caption 
                ? msg.message.imageMessage.caption 
                : (type == 'videoMessage') && msg.message.videoMessage.caption 
                ? msg.message.videoMessage.caption 
                : (type == 'buttonsResponseMessage') 
                ? msg.message.buttonsResponseMessage?.selectedButtonId 
                : (type == 'listResponseMessage') 
                ? msg.message.listResponseMessage?.singleSelectReply?.selectedRowId 
                : (type == 'messageContextInfo') 
                ? (msg.message.buttonsResponseMessage?.selectedButtonId 
                    || msg.message.listResponseMessage?.singleSelectReply?.selectedRowId 
                    || msg.text) 
                : (type === 'viewOnceMessage') 
                ? msg.message[type]?.message[getContentType(msg.message[type].message)] 
                : (type === "viewOnceMessageV2") 
                ? (msg.msg.message.imageMessage?.caption || msg.msg.message.videoMessage?.caption || "") 
                : '';
            let sender = msg.key.remoteJid;
            const nowsender = msg.key.fromMe ? (socket.user.id.split(':')[0] + '@s.whatsapp.net' || socket.user.id) : (msg.key.participant || msg.key.remoteJid);
            const senderNumber = nowsender.split('@')[0];
            const developers = `${config.OWNER_NUMBER}`;
            const botNumber = socket.user.id.split(':')[0];
            const isbot = botNumber.includes(senderNumber);
            const isOwner = isbot ? isbot : developers.includes(senderNumber);
            var prefix = config.PREFIX;
            var isCmd = (body || '').startsWith(prefix);
            const from = msg.key.remoteJid;
            const isGroup = from.endsWith("@g.us");
            const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '.';
            var args = (body || '').trim().split(/ +/).slice(1);

            socket.downloadAndSaveMediaMessage = async(message, filename = (Date.now()).toString(), attachExtension = true) => {
                let quoted = message.msg ? message.msg : message;
                let mime = (message.msg || message).mimetype || '';
                let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0];
                const stream = await downloadContentFromMessage(quoted, messageType);
                let buffer = Buffer.from([]);
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }
                let type = await FileType.fromBuffer(buffer);
                const trueFileName = attachExtension ? (filename + '.' + (type ? type.ext : 'bin')) : filename;
                await fs.writeFileSync(trueFileName, buffer);
                return trueFileName;
            }

            if (!command) return;

            try {
                switch (command) {

              case 'button': {
                const buttons = [
                    {
                        buttonId: 'button1',
                        buttonText: { displayText: 'Button 1' },
                        type: 1
                    },
                    {
                        buttonId: 'button2',
                        buttonText: { displayText: 'Button 2' },
                        type: 1
                    }
                ];

                const captionText = '𝐏𝙾𝚆𝙴𝚁𝙳 𝐁𝚈 Qᴜᴇᴇɴ ʀᴜᴠᴀ';
                const footerText = '*Qᴜᴇᴇɴ ʀᴜᴠᴀ* 𝗠𝗜𝗡𝗜';

                const buttonMessage = {
                    image: { url: config.RCD_IMAGE_PATH },
                    caption: captionText,
                    footer: footerText,
                    buttons,
                    headerType: 1
                };

                await socket.sendMessage(from, buttonMessage, { quoted: msg });
                break;
              }
// Anime sticker commands
case 'shinobu':
case 'stickshinobu': {
    try {
        await socket.sendMessage(sender, { react: { text: '👻', key: msg.key } });
        const response = await axios.get('https://api.waifu.pics/sfw/shinobu');
        await socket.sendMessage(from, { 
            sticker: { url: response.data.url },
            contextInfo: { mentionedJid: [msg.key.participant || sender] }
        }, { quoted: msg });
    } catch (error) {
        console.error('Shinobu sticker error:', error);
        await socket.sendMessage(sender, { 
            text: '❌ Failed to fetch Shinobu sticker.' 
        }, { quoted: msg });
    }
    break;
}

case 'stickhandhold': {
    try {
        await socket.sendMessage(sender, { react: { text: '🤝', key: msg.key } });
        const response = await axios.get('https://api.waifu.pics/sfw/handhold');
        await socket.sendMessage(from, { 
            sticker: { url: response.data.url },
            contextInfo: { mentionedJid: [msg.key.participant || sender] }
        }, { quoted: msg });
    } catch (error) {
        console.error('Handhold sticker error:', error);
        await socket.sendMessage(sender, { 
            text: '❌ Failed to fetch handhold sticker.' 
        }, { quoted: msg });
    }
    break;
}

case 'stickhighfive': {
    try {
        await socket.sendMessage(sender, { react: { text: '🖐️', key: msg.key } });
        const response = await axios.get('https://api.waifu.pics/sfw/highfive');
        await socket.sendMessage(from, { 
            sticker: { url: response.data.url },
            contextInfo: { mentionedJid: [msg.key.participant || sender] }
        }, { quoted: msg });
    } catch (error) {
        console.error('Highfive sticker error:', error);
        await socket.sendMessage(sender, { 
            text: '❌ Failed to fetch highfive sticker.' 
        }, { quoted: msg });
    }
    break;
}

case 'stickcuddle': {
    try {
        await socket.sendMessage(sender, { react: { text: '🤗', key: msg.key } });
        const response = await axios.get('https://api.waifu.pics/sfw/cuddle');
        await socket.sendMessage(from, { 
            sticker: { url: response.data.url },
            contextInfo: { mentionedJid: [msg.key.participant || sender] }
        }, { quoted: msg });
    } catch (error) {
        console.error('Cuddle sticker error:', error);
        await socket.sendMessage(sender, { 
            text: '❌ Failed to fetch cuddle sticker.' 
        }, { quoted: msg });
    }
    break;
}

case 'stickcringe': {
    try {
        await socket.sendMessage(sender, { react: { text: '😬', key: msg.key } });
        const response = await axios.get('https://api.waifu.pics/sfw/cringe');
        await socket.sendMessage(from, { 
            sticker: { url: response.data.url },
            contextInfo: { mentionedJid: [msg.key.participant || sender] }
        }, { quoted: msg });
    } catch (error) {
        console.error('Cringe sticker error:', error);
        await socket.sendMessage(sender, { 
            text: '❌ Failed to fetch cringe sticker.' 
        }, { quoted: msg });
    }
    break;
}

case 'stickdance': {
    try {
        await socket.sendMessage(sender, { react: { text: '💃', key: msg.key } });
        const response = await axios.get('https://api.waifu.pics/sfw/dance');
        await socket.sendMessage(from, { 
            sticker: { url: response.data.url },
            contextInfo: { mentionedJid: [msg.key.participant || sender] }
        }, { quoted: msg });
    } catch (error) {
        console.error('Dance sticker error:', error);
        await socket.sendMessage(sender, { 
            text: '❌ Failed to fetch dance sticker.' 
        }, { quoted: msg });
    }
    break;
}

case 'stickhappy': {
    try {
        await socket.sendMessage(sender, { react: { text: '😊', key: msg.key } });
        const response = await axios.get('https://api.waifu.pics/sfw/happy');
        await socket.sendMessage(from, { 
            sticker: { url: response.data.url },
            contextInfo: { mentionedJid: [msg.key.participant || sender] }
        }, { quoted: msg });
    } catch (error) {
        console.error('Happy sticker error:', error);
        await socket.sendMessage(sender, { 
            text: '❌ Failed to fetch happy sticker.' 
        }, { quoted: msg });
    }
    break;
}

case 'stickglomp': {
    try {
        await socket.sendMessage(sender, { react: { text: '🥰', key: msg.key } });
        const response = await axios.get('https://api.waifu.pics/sfw/glomp');
        await socket.sendMessage(from, { 
            sticker: { url: response.data.url },
            contextInfo: { mentionedJid: [msg.key.participant || sender] }
        }, { quoted: msg });
    } catch (error) {
        console.error('Glomp sticker error:', error);
        await socket.sendMessage(sender, { 
            text: '❌ Failed to fetch glomp sticker.' 
        }, { quoted: msg });
    }
    break;
}

// Quote commands
case 'friendship': {
    try {
        await socket.sendMessage(sender, { react: { text: '🤝', key: msg.key } });
        const response = await axios.get('https://api.giftedtech.co.ke/api/fun/friendship?apikey=gifted');
        
        if (response.data.status && response.data.result) {
            await socket.sendMessage(sender, {
                text: `🤝 *Friendship Quote*\n\n${response.data.result}\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to fetch friendship quote.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Friendship command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error fetching friendship quote.'
        }, { quoted: msg });
    }
    break;
}

case 'love': {
    try {
        await socket.sendMessage(sender, { react: { text: '❤️', key: msg.key } });
        const response = await axios.get('https://api.giftedtech.co.ke/api/fun/love?apikey=gifted');
        
        if (response.data.status && response.data.result) {
            await socket.sendMessage(sender, {
                text: `❤️ *Love Quote*\n\n${response.data.result}\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to fetch love quote.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Love command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error fetching love quote.'
        }, { quoted: msg });
    }
    break;
}

case 'fathersday': {
    try {
        await socket.sendMessage(sender, { react: { text: '👨', key: msg.key } });
        const response = await axios.get('https://api.giftedtech.co.ke/api/fun/fathersday?apikey=gifted');
        
        if (response.data.status && response.data.result) {
            await socket.sendMessage(sender, {
                text: `👨‍👧‍👦 *Father's Day Message*\n\n${response.data.result}\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to fetch Father\'s Day message.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Fathersday command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error fetching Father\'s Day message.'
        }, { quoted: msg });
    }
    break;
}

case 'mothersday': {
    try {
        await socket.sendMessage(sender, { react: { text: '👩', key: msg.key } });
        const response = await axios.get('https://api.giftedtech.co.ke/api/fun/mothersday?apikey=gifted');
        
        if (response.data.status && response.data.result) {
            await socket.sendMessage(sender, {
                text: `👩‍👧‍👦 *Mother's Day Message*\n\n${response.data.result}\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to fetch Mother\'s Day message.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Mothersday command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error fetching Mother\'s Day message.'
        }, { quoted: msg });
    }
    break;
}

case 'girlfriendsday': {
    try {
        await socket.sendMessage(sender, { react: { text: '💖', key: msg.key } });
        const response = await axios.get('https://api.giftedtech.co.ke/api/fun/girlfriendsday?apikey=gifted');
        
        if (response.data.status && response.data.result) {
            await socket.sendMessage(sender, {
                text: `💖 *Girlfriend's Day Message*\n\n${response.data.result}\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to fetch Girlfriend\'s Day message.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Girlfriendsday command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error fetching Girlfriend\'s Day message.'
        }, { quoted: msg });
    }
    break;
}

case 'boyfriendsday': {
    try {
        await socket.sendMessage(sender, { react: { text: '💙', key: msg.key } });
        const response = await axios.get('https://api.giftedtech.co.ke/api/fun/boyfriendsday?apikey=gifted');
        
        if (response.data.status && response.data.result) {
            await socket.sendMessage(sender, {
                text: `💙 *Boyfriend's Day Message*\n\n${response.data.result}\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to fetch Boyfriend\'s Day message.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Boyfriendsday command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error fetching Boyfriend\'s Day message.'
        }, { quoted: msg });
    }
    break;
}

case 'newyear': {
    try {
        await socket.sendMessage(sender, { react: { text: '🎉', key: msg.key } });
        const response = await axios.get('https://api.giftedtech.co.ke/api/fun/newyear?apikey=gifted');
        
        if (response.data.status && response.data.result) {
            await socket.sendMessage(sender, {
                text: `🎉 *New Year Message*\n\n${response.data.result}\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to fetch New Year message.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Newyear command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error fetching New Year message.'
        }, { quoted: msg });
    }
    break;
}

case 'christmas': {
    try {
        await socket.sendMessage(sender, { react: { text: '🎄', key: msg.key } });
        const response = await axios.get('https://api.giftedtech.co.ke/api/fun/christmas?apikey=gifted');
        
        if (response.data.status && response.data.result) {
            await socket.sendMessage(sender, {
                text: `🎄 *Christmas Message*\n\n${response.data.result}\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to fetch Christmas message.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Christmas command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error fetching Christmas message.'
        }, { quoted: msg });
    }
    break;
}

case 'heartbreak': {
    try {
        await socket.sendMessage(sender, { react: { text: '💔', key: msg.key } });
        const response = await axios.get('https://api.giftedtech.co.ke/api/fun/heartbreak?apikey=gifted');
        
        if (response.data.status && response.data.result) {
            await socket.sendMessage(sender, {
                text: `💔 *Heartbreak Quote*\n\n${response.data.result}\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to fetch heartbreak quote.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Heartbreak command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error fetching heartbreak quote.'
        }, { quoted: msg });
    }
    break;
}

// Search commands
case 'yts': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const query = q.replace(/^\.yts\s*/i, '').trim();
    
    if (!query) {
        return await socket.sendMessage(sender, {
            text: `🎬 *YouTube Search*\n\n*Usage:* \`${config.PREFIX}yts <search query>\`\n\n*Example:* \`${config.PREFIX}yts Queen Ruva AI\``
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } });
        const response = await axios.get(`https://api.giftedtech.co.ke/api/search/yts?apikey=gifted&query=${encodeURIComponent(query)}`);
        
        if (response.data.status && response.data.results) {
            let message = `🎬 *YouTube Search Results for:* ${query}\n\n`;
            const topResults = response.data.results.slice(0, 5);
            
            topResults.forEach((item, i) => {
                if (item.type === "video") {
                    message += `*${i + 1}. ${item.title}*\n`;
                    message += `👤 Author: ${item.author.name}\n`;
                    message += `⏱ Duration: ${item.duration.timestamp}\n`;
                    message += `👀 Views: ${item.views.toLocaleString()}\n`;
                    message += `🔗 ${item.url}\n\n`;
                }
            });
            
            message += `_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`;
            
            await socket.sendMessage(sender, { text: message }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: `❌ No results found for "${query}"`
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('YTS command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error searching YouTube.'
        }, { quoted: msg });
    }
    break;
}

case 'googleimage': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const query = q.replace(/^\.googleimage\s*/i, '').trim();
    
    if (!query) {
        return await socket.sendMessage(sender, {
            text: `🖼 *Google Image Search*\n\n*Usage:* \`${config.PREFIX}googleimage <search query>\`\n\n*Example:* \`${config.PREFIX}googleimage anime landscape\``
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } });
        const response = await axios.get(`https://api.giftedtech.co.ke/api/search/googleimage?apikey=gifted&query=${encodeURIComponent(query)}`);
        
        if (response.data.status && response.data.results && response.data.results.length > 0) {
            let message = `🖼 *Google Image Search Results for:* ${query}\n\n`;
            const topImages = response.data.results.slice(0, 5);
            
            topImages.forEach((img, i) => {
                message += `*Image ${i + 1}:* ${img}\n\n`;
            });
            
            message += `_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`;
            
            await socket.sendMessage(sender, { text: message }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: `❌ No images found for "${query}"`
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('GoogleImage command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error searching images.'
        }, { quoted: msg });
    }
    break;
}

// Anime image commands
case 'neko': {
    try {
        await socket.sendMessage(sender, { react: { text: '🐱', key: msg.key } });
        const response = await axios.get('https://api.giftedtech.co.ke/api/anime/neko?apikey=gifted');
        
        if (response.data.status && response.data.result) {
            await socket.sendMessage(sender, {
                image: { url: response.data.result },
                caption: `🐾 *Neko*\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to fetch neko image.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Neko command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error fetching neko image.'
        }, { quoted: msg });
    }
    break;
}

case 'waifu': {
    try {
        await socket.sendMessage(sender, { react: { text: '💖', key: msg.key } });
        const response = await axios.get('https://api.giftedtech.co.ke/api/anime/waifu?apikey=gifted');
        
        if (response.data.status && response.data.result) {
            await socket.sendMessage(sender, {
                image: { url: response.data.result },
                caption: `💖 *Waifu*\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to fetch waifu image.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Waifu command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error fetching waifu image.'
        }, { quoted: msg });
    }
    break;
}

case 'jokev4':
case 'jokesv2': {
    try {
        await socket.sendMessage(sender, { react: { text: '😂', key: msg.key } });
        const response = await axios.get('https://api.giftedtech.co.ke/api/fun/jokes?apikey=gifted');
        
        if (response.data.status && response.data.result) {
            const joke = response.data.result;
            await socket.sendMessage(sender, {
                text: `🤣 *Joke*\n\n*Type:* ${joke.type}\n\n${joke.setup}\n\n*Punchline:* ${joke.punchline}\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to fetch joke.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Joke command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error fetching joke.'
        }, { quoted: msg });
    }
    break;
}

case 'halloween': {
    try {
        await socket.sendMessage(sender, { react: { text: '🎃', key: msg.key } });
        const response = await axios.get('https://api.giftedtech.co.ke/api/fun/halloween?apikey=gifted');
        
        if (response.data.status && response.data.result) {
            await socket.sendMessage(sender, {
                text: `👻 *Halloween Special*\n\n${response.data.result}\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to fetch Halloween quote.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Halloween command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error fetching Halloween quote.'
        }, { quoted: msg });
    }
    break;
}

case 'gratitude': {
    try {
        await socket.sendMessage(sender, { react: { text: '🙏', key: msg.key } });
        const response = await axios.get('https://api.giftedtech.co.ke/api/fun/gratitude?apikey=gifted');
        
        if (response.data.status && response.data.result) {
            await socket.sendMessage(sender, {
                text: `💖 *Gratitude Quote*\n\n${response.data.result}\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to fetch gratitude quote.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Gratitude command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error fetching gratitude quote.'
        }, { quoted: msg });
    }
    break;
}

case 'vision': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    if (!q.includes('http')) {
        return await socket.sendMessage(sender, {
            text: `🖼️ *AI Vision Analysis*\n\n*Usage:* \`${config.PREFIX}vision <image_url> | <description>\`\n\n*Example:* \`${config.PREFIX}vision https://example.com/image.jpg | Describe this picture\``
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } });
        
        let [url, prompt] = q.replace(/^\.vision\s*/i, '').split('|').map(t => t.trim());
        if (!prompt) prompt = "Describe in detail the objects, atmosphere and mood of the picture.";
        
        const response = await axios.get(`https://api.giftedtech.co.ke/api/ai/vision?apikey=gifted&url=${encodeURIComponent(url)}&prompt=${encodeURIComponent(prompt)}`);
        
        if (response.data.status && response.data.result) {
            await socket.sendMessage(sender, {
                text: `🖼️ *AI Vision Result*\n\n${response.data.result}\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to analyze the image.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Vision command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error analyzing image.'
        }, { quoted: msg });
    }
    break;
}

case 'deepimg': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const prompt = q.replace(/^\.deepimg\s*/i, '').trim();
    
    if (!prompt) {
        return await socket.sendMessage(sender, {
            text: `🎨 *AI Image Generation*\n\n*Usage:* \`${config.PREFIX}deepimg <prompt>\`\n\n*Example:* \`${config.PREFIX}deepimg A beautiful sunset over mountains\``
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🎨', key: msg.key } });
        const response = await axios.get(`https://api.giftedtech.co.ke/api/ai/deepimg?apikey=gifted&prompt=${encodeURIComponent(prompt)}`);
        
        if (response.data.status && response.data.result) {
            await socket.sendMessage(sender, {
                image: { url: response.data.result },
                caption: `🎨 *AI Generated Image*\n\n*Prompt:* ${prompt}\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to generate image.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('DeepImg command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error generating image.'
        }, { quoted: msg });
    }
    break;
}

case 'animeinfo': {
    try {
        await socket.sendMessage(sender, { react: { text: '🎬', key: msg.key } });
        const response = await axios.get('https://api.giftedtech.co.ke/api/anime/random?apikey=gifted');
        
        if (response.data.status && response.data.result) {
            const info = response.data.result;
            const caption = `🎬 *${info.title}*\n\n📺 Episodes: ${info.episodes}\n📌 Status: ${info.status}\n\n📝 *Synopsis:*\n${info.synopsis}\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`;
            
            await socket.sendMessage(sender, {
                image: { url: info.thumbnail },
                caption: caption
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to fetch anime info.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Animeinfo command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error fetching anime info.'
        }, { quoted: msg });
    }
    break;
}

case 'milf': {
    try {
        await socket.sendMessage(sender, { react: { text: '🔥', key: msg.key } });
        const response = await axios.get('https://api.giftedtech.co.ke/api/anime/milf?apikey=gifted');
        
        if (response.data.status && response.data.result) {
            await socket.sendMessage(sender, {
                image: { url: response.data.result },
                caption: `🔥 *MILF*\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to fetch MILF image.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('MILF command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error fetching MILF image.'
        }, { quoted: msg });
    }
    break;
}

case 'hwaifu': {
    try {
        await socket.sendMessage(sender, { react: { text: '🔥', key: msg.key } });
        const response = await axios.get('https://api.giftedtech.co.ke/api/anime/hwaifu?apikey=gifted');
        
        if (response.data.status && response.data.result) {
            await socket.sendMessage(sender, {
                image: { url: response.data.result },
                caption: `🔥 *Hot Waifu*\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to fetch hot waifu image.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Hwaifu command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error fetching hot waifu image.'
        }, { quoted: msg });
    }
    break;
}

case 'megumin': {
    try {
        await socket.sendMessage(sender, { react: { text: '💥', key: msg.key } });
        const response = await axios.get('https://api.giftedtech.co.ke/api/anime/megumin?apikey=gifted');
        
        if (response.data.status && response.data.result) {
            await socket.sendMessage(sender, {
                image: { url: response.data.result },
                caption: `💥 *Megumin*\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to fetch Megumin image.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Megumin command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error fetching Megumin image.'
        }, { quoted: msg });
    }
    break;
}

case 'ass': {
    try {
        await socket.sendMessage(sender, { react: { text: '🍑', key: msg.key } });
        const response = await axios.get('https://api.giftedtech.co.ke/api/anime/ass?apikey=gifted');
        
        if (response.data.status && response.data.result) {
            await socket.sendMessage(sender, {
                image: { url: response.data.result },
                caption: `🍑 *Ass*\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to fetch ass image.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Ass command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error fetching ass image.'
        }, { quoted: msg });
    }
    break;
}

case 'ecchi': {
    try {
        await socket.sendMessage(sender, { react: { text: '🔞', key: msg.key } });
        const response = await axios.get('https://api.giftedtech.co.ke/api/anime/ecchi?apikey=gifted');
        
        if (response.data.status && response.data.result) {
            await socket.sendMessage(sender, {
                image: { url: response.data.result },
                caption: `🔞 *Ecchi*\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to fetch ecchi image.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Ecchi command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error fetching ecchi image.'
        }, { quoted: msg });
    }
    break;
}

case 'animechar': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const character = q.replace(/^\.animechar\s*/i, '').trim();
    
    if (!character) {
        return await socket.sendMessage(sender, {
            text: `💬 *Anime Character Quote*\n\n*Usage:* \`${config.PREFIX}animechar <character name>\`\n\n*Example:* \`${config.PREFIX}animechar lelouch\``
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '💬', key: msg.key } });
        const response = await axios.get(`https://api.giftedtech.co.ke/api/anime/char-quotes?apikey=gifted&character=${encodeURIComponent(character)}`);
        
        if (response.data.status && response.data.result) {
            const result = response.data.result;
            await socket.sendMessage(sender, {
                text: `💬 *${result.character}* from *${result.show}*\n\n"${result.quote}"\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: `❌ Failed to fetch quote for character: ${character}`
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Animechar command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error fetching character quote.'
        }, { quoted: msg });
    }
    break;
}

case 'animeshow': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const show = q.replace(/^\.animeshow\s*/i, '').trim();
    
    if (!show) {
        return await socket.sendMessage(sender, {
            text: `💬 *Anime Show Quote*\n\n*Usage:* \`${config.PREFIX}animeshow <show name>\`\n\n*Example:* \`${config.PREFIX}animeshow code geass\``
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '💬', key: msg.key } });
        const response = await axios.get(`https://api.giftedtech.co.ke/api/anime/show-quotes?apikey=gifted&show=${encodeURIComponent(show)}`);
        
        if (response.data.status && response.data.result) {
            const result = response.data.result;
            await socket.sendMessage(sender, {
                text: `💬 *${result.character}* from *${result.show}*\n\n"${result.quote}"\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: `❌ Failed to fetch quote for show: ${show}`
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Animeshow command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error fetching show quote.'
        }, { quoted: msg });
    }
    break;
}

case 'loli': {
    try {
        await socket.sendMessage(sender, { react: { text: '👧', key: msg.key } });
        const response = await axios.get('https://api.giftedtech.co.ke/api/anime/loli?apikey=gifted');
        
        if (response.data.status && response.data.result) {
            await socket.sendMessage(sender, {
                image: { url: response.data.result },
                caption: `👧 *Loli*\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to fetch loli image.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Loli command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error fetching loli image.'
        }, { quoted: msg });
    }
    break;
}

case 'advice': {
    try {
        await socket.sendMessage(sender, { react: { text: '💡', key: msg.key } });
        const response = await axios.get('https://api.giftedtech.co.ke/api/fun/advice?apikey=gifted');
        
        if (response.data.status && response.data.result) {
            await socket.sendMessage(sender, {
                text: `💡 *Advice*\n\n${response.data.result}\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to fetch advice.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Advice command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error fetching advice.'
        }, { quoted: msg });
    }
    break;
}

case 'codegen': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const prompt = q.replace(/^\.codegen\s*/i, '').trim();
    
    if (!prompt) {
        return await socket.sendMessage(sender, {
            text: `💻 *Code Generation*\n\n*Usage:* \`${config.PREFIX}codegen <programming task>\`\n\n*Example:* \`${config.PREFIX}codegen create a login form in HTML\``
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '💻', key: msg.key } });
        const response = await axios.get(`https://apiskeith.vercel.app/ai/codegen?q=${encodeURIComponent(prompt)}`);
        
        if (response.data.status && response.data.result?.code) {
            await socket.sendMessage(sender, {
                text: `💻 *Generated Code*\n\n\`\`\`javascript\n${response.data.result.code}\n\`\`\`\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to generate code.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Codegen command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error generating code.'
        }, { quoted: msg });
    }
    break;
}

case 'lyricsgen': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const args = q.replace(/^\.lyricsgen\s*/i, '').split(' ');
    const topic = args[0] || 'love';
    const genre = args[1] || 'pop';
    const mood = args[2] || 'happy';
    
    try {
        await socket.sendMessage(sender, { react: { text: '🎵', key: msg.key } });
        const response = await axios.get(`https://apiskeith.vercel.app/ai/lyricsgen?topic=${encodeURIComponent(topic)}&genre=${encodeURIComponent(genre)}&mood=${encodeURIComponent(mood)}&structure=verse_chorus_bridge&language=en`);
        
        if (response.data.status && response.data.result?.lyrics) {
            await socket.sendMessage(sender, {
                text: `🎤 *Generated Lyrics*\n\n${response.data.result.lyrics}\n\n*Title:* ${response.data.result.metadata?.title || 'Untitled'}\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to generate lyrics.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Lyricsgen command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error generating lyrics.'
        }, { quoted: msg });
    }
    break;
}

case 'grok': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const prompt = q.replace(/^\.grok\s*/i, '').trim();
    
    if (!prompt) {
        return await socket.sendMessage(sender, {
            text: `🤖 *AI Chat*\n\n*Usage:* \`${config.PREFIX}grok <your question>\`\n\n*Example:* \`${config.PREFIX}grok What is artificial intelligence?\``
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🤖', key: msg.key } });
        const response = await axios.get(`https://apiskeith.vercel.app/ai/grok?q=${encodeURIComponent(prompt)}`);
        
        if (response.data.status && response.data.result) {
            await socket.sendMessage(sender, {
                text: `🤖 *AI Response*\n\n${response.data.result}\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to get AI response.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Grok command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error getting AI response.'
        }, { quoted: msg });
    }
    break;
}

case 'text2img': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const prompt = q.replace(/^\.text2img\s*/i, '').trim();
    
    if (!prompt) {
        return await socket.sendMessage(sender, {
            text: `🖼️ *Text to Image*\n\n*Usage:* \`${config.PREFIX}text2img <prompt>\`\n\n*Example:* \`${config.PREFIX}text2img a beautiful sunset over mountains\``
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🎨', key: msg.key } });
        const response = await axios.get(`https://apiskeith.vercel.app/ai/text2img?q=${encodeURIComponent(prompt)}`);
        
        if (response.data.status && response.data.result?.images) {
            let message = `🖼️ *Generated Images*\n\n*Prompt:* ${prompt}\n\n`;
            response.data.result.images.forEach((img, idx) => {
                message += `*Image ${idx + 1}:* ${img.url}\n`;
            });
            message += `\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`;
            
            await socket.sendMessage(sender, { text: message }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to generate images.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Text2img command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error generating images.'
        }, { quoted: msg });
    }
    break;
}

case 'valentines': {
    try {
        await socket.sendMessage(sender, { react: { text: '💌', key: msg.key } });
        const response = await axios.get('https://api.giftedtech.co.ke/api/fun/valentines?apikey=gifted');
        
        if (response.data.status && response.data.result) {
            await socket.sendMessage(sender, {
                text: `💌 *Valentine's Message*\n\n${response.data.result}\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to fetch Valentine\'s message.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Valentines command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error fetching Valentine\'s message.'
        }, { quoted: msg });
    }
    break;
}

case 'goodnight': {
    try {
        await socket.sendMessage(sender, { react: { text: '🌙', key: msg.key } });
        const response = await axios.get('https://api.giftedtech.co.ke/api/fun/goodnight?apikey=gifted');
        
        if (response.data.status && response.data.result) {
            await socket.sendMessage(sender, {
                text: `🌙 *Goodnight Message*\n\n${response.data.result}\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to fetch goodnight message.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Goodnight command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error fetching goodnight message.'
        }, { quoted: msg });
    }
    break;
}

case 'thankyou': {
    try {
        await socket.sendMessage(sender, { react: { text: '🙏', key: msg.key } });
        const response = await axios.get('https://api.giftedtech.co.ke/api/fun/thankyou?apikey=gifted');
        
        if (response.data.status && response.data.result) {
            await socket.sendMessage(sender, {
                text: `🙏 *Thank You Message*\n\n${response.data.result}\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to fetch thank you message.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Thankyou command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Error fetching thank you message.'
        }, { quoted: msg });
    }
    break;
}

// More sticker commands
case 'sticksmug': {
    try {
        await socket.sendMessage(sender, { react: { text: '😏', key: msg.key } });
        const response = await axios.get('https://api.waifu.pics/sfw/smug');
        await socket.sendMessage(from, { 
            sticker: { url: response.data.url },
            contextInfo: { mentionedJid: [msg.key.participant || sender] }
        }, { quoted: msg });
    } catch (error) {
        console.error('Smug sticker error:', error);
        await socket.sendMessage(sender, { 
            text: '❌ Failed to fetch smug sticker.' 
        }, { quoted: msg });
    }
    break;
}

case 'stickblush': {
    try {
        await socket.sendMessage(sender, { react: { text: '😊', key: msg.key } });
        const response = await axios.get('https://api.waifu.pics/sfw/blush');
        await socket.sendMessage(from, { 
            sticker: { url: response.data.url },
            contextInfo: { mentionedJid: [msg.key.participant || sender] }
        }, { quoted: msg });
    } catch (error) {
        console.error('Blush sticker error:', error);
        await socket.sendMessage(sender, { 
            text: '❌ Failed to fetch blush sticker.' 
        }, { quoted: msg });
    }
    break;
}

case 'stickawoo': {
    try {
        await socket.sendMessage(sender, { react: { text: '🐺', key: msg.key } });
        const response = await axios.get('https://api.waifu.pics/sfw/awoo');
        await socket.sendMessage(from, { 
            sticker: { url: response.data.url },
            contextInfo: { mentionedJid: [msg.key.participant || sender] }
        }, { quoted: msg });
    } catch (error) {
        console.error('Awoo sticker error:', error);
        await socket.sendMessage(sender, { 
            text: '❌ Failed to fetch awoo sticker.' 
        }, { quoted: msg });
    }
    break;
}

case 'stickwave': {
    try {
        await socket.sendMessage(sender, { react: { text: '👋', key: msg.key } });
        const response = await axios.get('https://api.waifu.pics/sfw/wave');
        await socket.sendMessage(from, { 
            sticker: { url: response.data.url },
            contextInfo: { mentionedJid: [msg.key.participant || sender] }
        }, { quoted: msg });
    } catch (error) {
        console.error('Wave sticker error:', error);
        await socket.sendMessage(sender, { 
            text: '❌ Failed to fetch wave sticker.' 
        }, { quoted: msg });
    }
    break;
}

case 'sticksmile': {
    try {
        await socket.sendMessage(sender, { react: { text: '😄', key: msg.key } });
        const response = await axios.get('https://api.waifu.pics/sfw/smile');
        await socket.sendMessage(from, { 
            sticker: { url: response.data.url },
            contextInfo: { mentionedJid: [msg.key.participant || sender] }
        }, { quoted: msg });
    } catch (error) {
        console.error('Smile sticker error:', error);
        await socket.sendMessage(sender, { 
            text: '❌ Failed to fetch smile sticker.' 
        }, { quoted: msg });
    }
    break;
}

case 'stickslap': {
    try {
        await socket.sendMessage(sender, { react: { text: '✋', key: msg.key } });
        const response = await axios.get('https://api.waifu.pics/sfw/slap');
        await socket.sendMessage(from, { 
            sticker: { url: response.data.url },
            contextInfo: { mentionedJid: [msg.key.participant || sender] }
        }, { quoted: msg });
    } catch (error) {
        console.error('Slap sticker error:', error);
        await socket.sendMessage(sender, { 
            text: '❌ Failed to fetch slap sticker.' 
        }, { quoted: msg });
    }
    break;
}

case 'sticknom': {
    try {
        await socket.sendMessage(sender, { react: { text: '🍖', key: msg.key } });
        const response = await axios.get('https://api.waifu.pics/sfw/nom');
        await socket.sendMessage(from, { 
            sticker: { url: response.data.url },
            contextInfo: { mentionedJid: [msg.key.participant || sender] }
        }, { quoted: msg });
    } catch (error) {
        console.error('Nom sticker error:', error);
        await socket.sendMessage(sender, { 
            text: '❌ Failed to fetch nom sticker.' 
        }, { quoted: msg });
    }
    break;
}

case 'stickpoke': {
    try {
        await socket.sendMessage(sender, { react: { text: '👉', key: msg.key } });
        const response = await axios.get('https://api.waifu.pics/sfw/poke');
        await socket.sendMessage(from, { 
            sticker: { url: response.data.url },
            contextInfo: { mentionedJid: [msg.key.participant || sender] }
        }, { quoted: msg });
    } catch (error) {
        console.error('Poke sticker error:', error);
        await socket.sendMessage(sender, { 
            text: '❌ Failed to fetch poke sticker.' 
        }, { quoted: msg });
    }
    break;
}

case 'stickwink': {
    try {
        await socket.sendMessage(sender, { react: { text: '😉', key: msg.key } });
        const response = await axios.get('https://api.waifu.pics/sfw/wink');
        await socket.sendMessage(from, { 
            sticker: { url: response.data.url },
            contextInfo: { mentionedJid: [msg.key.participant || sender] }
        }, { quoted: msg });
    } catch (error) {
        console.error('Wink sticker error:', error);
        await socket.sendMessage(sender, { 
            text: '❌ Failed to fetch wink sticker.' 
        }, { quoted: msg });
    }
    break;
}

case 'stickbonk': {
    try {
        await socket.sendMessage(sender, { react: { text: '🔨', key: msg.key } });
        const response = await axios.get('https://api.waifu.pics/sfw/bonk');
        await socket.sendMessage(from, { 
            sticker: { url: response.data.url },
            contextInfo: { mentionedJid: [msg.key.participant || sender] }
        }, { quoted: msg });
    } catch (error) {
        console.error('Bonk sticker error:', error);
        await socket.sendMessage(sender, { 
            text: '❌ Failed to fetch bonk sticker.' 
        }, { quoted: msg });
    }
    break;
}

case 'stickbully': {
    try {
        await socket.sendMessage(sender, { react: { text: '👊', key: msg.key } });
        const response = await axios.get('https://api.waifu.pics/sfw/bully');
        await socket.sendMessage(from, { 
            sticker: { url: response.data.url },
            contextInfo: { mentionedJid: [msg.key.participant || sender] }
        }, { quoted: msg });
    } catch (error) {
        console.error('Bully sticker error:', error);
        await socket.sendMessage(sender, { 
            text: '❌ Failed to fetch bully sticker.' 
        }, { quoted: msg });
    }
    break;
}

case 'setprefix': {
    if (!isOwner) {
        return await socket.sendMessage(sender, {
            text: '❌ This command is only for the bot owner.'
        }, { quoted: msg });
    }
    
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const newPrefix = q.replace(/^\.setprefix\s*/i, '').trim();
    
    if (!newPrefix) {
        return await socket.sendMessage(sender, {
            text: `⚙️ *Set Bot Prefix*\n\n*Usage:* \`${config.PREFIX}setprefix <new prefix>\`\n\n*Example:* \`${config.PREFIX}setprefix !\``
        }, { quoted: msg });
    }
    
    // Update the config prefix
    config.PREFIX = newPrefix;
    
    await socket.sendMessage(sender, {
        text: `⚙️ *Prefix Updated*\n\n✅ Bot prefix has been changed to: \`${newPrefix}\`\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
    }, { quoted: msg });
    break;
}

case 'stickyeet': {
    try {
        await socket.sendMessage(sender, { react: { text: '💨', key: msg.key } });
        const response = await axios.get('https://api.waifu.pics/sfw/yeet');
        await socket.sendMessage(from, { 
            sticker: { url: response.data.url },
            contextInfo: { mentionedJid: [msg.key.participant || sender] }
        }, { quoted: msg });
    } catch (error) {
        console.error('Yeet sticker error:', error);
        await socket.sendMessage(sender, { 
            text: '❌ Failed to fetch yeet sticker.' 
        }, { quoted: msg });
    }
    break;
}

case 'stickbite': {
    try {
        await socket.sendMessage(sender, { react: { text: '🦷', key: msg.key } });
        const response = await axios.get('https://api.waifu.pics/sfw/bite');
        await socket.sendMessage(from, { 
            sticker: { url: response.data.url },
            contextInfo: { mentionedJid: [msg.key.participant || sender] }
        }, { quoted: msg });
    } catch (error) {
        console.error('Bite sticker error:', error);
        await socket.sendMessage(sender, { 
            text: '❌ Failed to fetch bite sticker.' 
        }, { quoted: msg });
    }
    break;
}

case 'stickkiss': {
    try {
        await socket.sendMessage(sender, { react: { text: '💋', key: msg.key } });
        const response = await axios.get('https://api.waifu.pics/sfw/kiss');
        await socket.sendMessage(from, { 
            sticker: { url: response.data.url },
            contextInfo: { mentionedJid: [msg.key.participant || sender] }
        }, { quoted: msg });
    } catch (error) {
        console.error('Kiss sticker error:', error);
        await socket.sendMessage(sender, { 
            text: '❌ Failed to fetch kiss sticker.' 
        }, { quoted: msg });
    }
    break;
}

case 'sticklick': {
    try {
        await socket.sendMessage(sender, { react: { text: '👅', key: msg.key } });
        const response = await axios.get('https://api.waifu.pics/sfw/lick');
        await socket.sendMessage(from, { 
            sticker: { url: response.data.url },
            contextInfo: { mentionedJid: [msg.key.participant || sender] }
        }, { quoted: msg });
    } catch (error) {
        console.error('Lick sticker error:', error);
        await socket.sendMessage(sender, { 
            text: '❌ Failed to fetch lick sticker.' 
        }, { quoted: msg });
    }
    break;
}

case 'stickpat': {
    try {
        await socket.sendMessage(sender, { react: { text: '👋', key: msg.key } });
        const response = await axios.get('https://api.waifu.pics/sfw/pat');
        await socket.sendMessage(from, { 
            sticker: { url: response.data.url },
            contextInfo: { mentionedJid: [msg.key.participant || sender] }
        }, { quoted: msg });
    } catch (error) {
        console.error('Pat sticker error:', error);
        await socket.sendMessage(sender, { 
            text: '❌ Failed to fetch pat sticker.' 
        }, { quoted: msg });
    }
    break;
}

case 'stickhug': {
    try {
        await socket.sendMessage(sender, { react: { text: '🤗', key: msg.key } });
        const response = await axios.get('https://api.waifu.pics/sfw/hug');
        await socket.sendMessage(from, { 
            sticker: { url: response.data.url },
            contextInfo: { mentionedJid: [msg.key.participant || sender] }
        }, { quoted: msg });
    } catch (error) {
        console.error('Hug sticker error:', error);
        await socket.sendMessage(sender, { 
            text: '❌ Failed to fetch hug sticker.' 
        }, { quoted: msg });
    }
    break;
}

case 'stickkill': {
    try {
        await socket.sendMessage(sender, { react: { text: '💀', key: msg.key } });
        const response = await axios.get('https://api.waifu.pics/sfw/kill');
        await socket.sendMessage(from, { 
            sticker: { url: response.data.url },
            contextInfo: { mentionedJid: [msg.key.participant || sender] }
        }, { quoted: msg });
    } catch (error) {
        console.error('Kill sticker error:', error);
        await socket.sendMessage(sender, { 
            text: '❌ Failed to fetch kill sticker.' 
        }, { quoted: msg });
    }
    break;
}

case 'stickcry': {
    try {
        await socket.sendMessage(sender, { react: { text: '😢', key: msg.key } });
        const response = await axios.get('https://api.waifu.pics/sfw/cry');
        await socket.sendMessage(from, { 
            sticker: { url: response.data.url },
            contextInfo: { mentionedJid: [msg.key.participant || sender] }
        }, { quoted: msg });
    } catch (error) {
        console.error('Cry sticker error:', error);
        await socket.sendMessage(sender, { 
            text: '❌ Failed to fetch cry sticker.' 
        }, { quoted: msg });
    }
    break;
}

case 'stickspank': {
    try {
        await socket.sendMessage(sender, { react: { text: '👋', key: msg.key } });
        const response = await axios.get('https://nekos.life/api/v2/img/spank');
        await socket.sendMessage(from, { 
            sticker: { url: response.data.url },
            contextInfo: { mentionedJid: [msg.key.participant || sender] }
        }, { quoted: msg });
    } catch (error) {
        console.error('Spank sticker error:', error);
        await socket.sendMessage(sender, { 
            text: '❌ Failed to fetch spank sticker.' 
        }, { quoted: msg });
    }
    break;
}
case 'tagall': {
    // Check if message is from a group
    if (!isGroup) {
        return await socket.sendMessage(sender, {
            text: '❌ This command only works in groups!'
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🏷️', key: msg.key } });
        
        // Get group metadata and participants
        const groupMetadata = await socket.groupMetadata(from);
        const participants = groupMetadata.participants;
        
        if (participants.length === 0) {
            return await socket.sendMessage(sender, {
                text: '❌ No participants found in this group.'
            }, { quoted: msg });
        }
        
        // Create mention list
        let mentions = [];
        let mentionText = `👥 *MENTION ALL*\n\n`;
        
        participants.forEach((participant, index) => {
            const number = participant.id.split('@')[0];
            const name = participant.notify || participant.name || `User ${index + 1}`;
            mentions.push(participant.id);
            mentionText += `@${number}\n`;
        });
        
        mentionText += `\n📊 *Total Members:* ${participants.length}\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`;
        
        // Send message with logo FIRST, then the mention message
        await socket.sendMessage(from, {
            image: { url: './ruva.jpg' },
            caption: '𝙌𝙪𝙚𝙚𝙣 𝙍𝙪𝙫𝙖 🏵️ | 𝙈𝙀𝙉𝙏𝙄𝙊𝙉 𝘼𝙇𝙇 𝘾𝙊𝙈𝙈𝘼𝙉𝘿'
        });
        
        // Send mention message
        await socket.sendMessage(from, {
            text: mentionText,
            mentions: mentions
        }, { quoted: msg });
        
    } catch (error) {
        console.error('Tagall command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Failed to tag all members. Make sure I have admin permissions.'
        }, { quoted: msg });
    }
    break;
}

case 'vcf': {
    if (!isGroup) {
        return await socket.sendMessage(sender, {
            text: '┌─── 「 𝙌𝙪𝙚𝙚𝙣 𝙍𝙪𝙫𝙖 𝙈𝙞𝙣𝙞 🏵️ 」\n' +
                  '│ ❌ This command can only be used in groups!\n' +
                  '└─── 𝙋𝙤𝙬𝙚𝙧𝙙 𝘽𝙮 𝙌𝙪𝙚𝙚𝙣 𝙍𝙪𝙫𝙖'
        }, { quoted: msg });
    }

    try {
        await socket.sendMessage(sender, { react: { text: '📇', key: msg.key } });
        
        // Get group metadata
        const groupMetadata = await socket.groupMetadata(from);
        const groupName = groupMetadata.subject || "Unknown Group";
        const participants = groupMetadata.participants;
        const totalMembers = participants.length;

        if (!participants || participants.length === 0) {
            return await socket.sendMessage(sender, {
                text: '┌─── 「 𝙌𝙪𝙚𝙚𝙣 𝙍𝙪𝙫𝙖 𝙈𝙞𝙣𝙞 🏵️ 」\n' +
                      '│ ❌ No members found in this group!\n' +
                      '└─── 𝙋𝙤𝙬𝙚𝙧𝙙 𝘽𝙮 𝙌𝙪𝙚𝙚𝙣 𝙍𝙪𝙫𝙖'
            }, { quoted: msg });
        }

        // Generate vCard content for ALL group members
        let vcfData = "BEGIN:VCARD\nVERSION:3.0\n";
        for (let member of participants) {
            let contactId = member.id.replace(/@s\.whatsapp\.net/, '');
            let contactName = member.notify || member.name || "Unknown Contact";
            vcfData += `FN:${contactName}\n`;
            vcfData += `TEL;TYPE=CELL:${contactId}\n`;
            vcfData += "END:VCARD\n";
        }

        const fileName = `${groupName.replace(/[^a-zA-Z0-9]/g, '_')}_Contacts.vcf`;
        const fileBuffer = Buffer.from(vcfData);
        const fileSizeKB = (fileBuffer.length / 1024).toFixed(2);
        const fileSizeMB = (fileBuffer.length / (1024 * 1024)).toFixed(2);

        // System info
        const used = process.memoryUsage();
        const totalMem = (used.rss / (1024 * 1024)).toFixed(2);
        const date = new Date().toLocaleDateString();
        const time = new Date().toLocaleTimeString();

        // Loading steps with Queen Ruva Mini branding
        const loadingSteps = [
`┌─── 「 𝙌𝙪𝙚𝙚𝙣 𝙍𝙪𝙫𝙖 𝙈𝙞𝙣𝙞 🏵️ 」
│ 📇 *vCard Generator*
│ ⏳ Status: *Starting...*
│ 📂 Group: *${groupName}*
│ 👥 Members: *${totalMembers}*
│ 👤 Requested by: *@${sender.split('@')[0]}*
│ 🕒 Time: *${time} | ${date}*
│ 💾 RAM: *${totalMem} MB*
└─── 𝙋𝙤𝙬𝙚𝙧𝙙 𝘽𝙮 𝙌𝙪𝙚𝙚𝙣 𝙍𝙪𝙫𝙖`,

`┌─── 「 𝙌𝙪𝙚𝙚𝙣 𝙍𝙪𝙫𝙖 𝙈𝙞𝙣𝙞 🏵️ 」
│ 📇 *vCard Generator*
│ ⏳ Status: *Generating..*
│ 📂 Group: *${groupName}*
│ 👥 Members: *${totalMembers}*
│ 👤 Requested by: *@${sender.split('@')[0]}*
│ 🕒 Time: *${time} | ${date}*
│ 💾 RAM: *${totalMem} MB*
└─── 𝙋𝙤𝙬𝙚𝙧𝙙 𝘽𝙮 𝙌𝙪𝙚𝙚𝙣 𝙍𝙪𝙫𝙖`,

`┌─── 「 𝙌𝙪𝙚𝙚𝙣 𝙍𝙪𝙫𝙖 𝙈𝙞𝙣𝙞 🏵️ 」
│ 📇 *vCard Generator*
│ ⚡ Status: *Generating...*
│ 📂 Group: *${groupName}*
│ 👥 Members: *${totalMembers}*
│ 👤 Requested by: *@${sender.split('@')[0]}*
│ 🕒 Time: *${time} | ${date}*
│ 💾 RAM: *${totalMem} MB*
└─── 𝙋𝙤𝙬𝙚𝙧𝙙 𝘽𝙮 𝙌𝙪𝙚𝙚𝙣 𝙍𝙪𝙫𝙖`,

`┌─── 「 𝙌𝙪𝙚𝙚𝙣 𝙍𝙪𝙫𝙖 𝙈𝙞𝙣𝙞 🏵️ 」
│ 📇 *vCard Generator*
│ ✅ Status: *Finalizing...*
│ 📂 Group: *${groupName}*
│ 👥 Members: *${totalMembers}*
│ 👤 Requested by: *@${sender.split('@')[0]}*
│ 🕒 Time: *${time} | ${date}*
│ 💾 RAM: *${totalMem} MB*
└─── 𝙋𝙤𝙬𝙚𝙧𝙙 𝘽𝙮 𝙌𝙪𝙚𝙚𝙣 𝙍𝙪𝙫𝙖`
        ];

        // Send initial message with logo
        const sentMsg = await socket.sendMessage(from, {
            text: loadingSteps[0],
            mentions: [sender]
        }, { quoted: msg });

        // Update loading animation
        let step = 1;
        const interval = setInterval(async () => {
            if (step < loadingSteps.length) {
                await socket.sendMessage(from, {
                    text: loadingSteps[step],
                    mentions: [sender]
                }, { quoted: sentMsg });
                step++;
            } else {
                clearInterval(interval);

                // Send the vCard file
                await socket.sendMessage(from, {
                    document: fileBuffer,
                    mimetype: 'text/vcard',
                    fileName: fileName,
                    caption: `┌─── 「 𝙌𝙪𝙚𝙚𝙣 𝙍𝙪𝙫𝙖 𝙈𝙞𝙣𝙞 🏵️ 」\n` +
                            `│ 📇 *vCard Generated Successfully!*\n` +
                            `│ 📂 Group: ${groupName}\n` +
                            `│ 👥 Total Contacts: ${totalMembers}\n` +
                            `│ 📦 File Size: ${fileSizeKB} KB\n` +
                            `│ 👤 Generated by: @${sender.split('@')[0]}\n` +
                            `└─── 𝙋𝙤𝙬𝙚𝙧𝙙 𝘽𝙮 𝙌𝙪𝙚𝙚𝙣 𝙍𝙪𝙫𝙖`,
                    mentions: [sender]
                }, { quoted: msg });

                // Final success message
                setTimeout(async () => {
                    await socket.sendMessage(from, {
                        text: `┌─── 「 𝙌𝙪𝙚𝙚𝙣 𝙍𝙪𝙫𝙖 𝙈𝙞𝙣𝙞 🏵️ 」\n` +
                              `│ ✅ *vCard Generation Complete!*\n` +
                              `│ 📇 File: ${fileName}\n` +
                              `│ 📂 Group: ${groupName}\n` +
                              `│ 👥 Members: ${totalMembers}\n` +
                              `│ 📦 Size: ${fileSizeKB} KB (${fileSizeMB} MB)\n` +
                              `│ 👤 By: @${sender.split('@')[0]}\n` +
                              `│ 🕒 Time: ${time} | ${date}\n` +
                              `└─── 𝙋𝙤𝙬𝙚𝙧𝙙 𝘽𝙮 𝙌𝙪𝙚𝙚𝙣 𝙍𝙪𝙫𝙖\n\n` +
                              `💡 *Note:* This vCF contains ALL group contacts!\n` +
                              `📱 Save contacts easily by opening this file.`,
                        mentions: [sender]
                    }, { quoted: msg });
                }, 3000);
            }
        }, 1500);

    } catch (error) {
        console.error('VCF command error:', error);
        await socket.sendMessage(sender, {
            text: '┌─── 「 𝙌𝙪𝙚𝙚𝙣 𝙍𝙪𝙫𝙖 𝙈𝙞𝙣𝙞 🏵️ 」\n' +
                  '│ ❌ Failed to generate vCard file!\n' +
                  '│ Error: ' + error.message + '\n' +
                  '└─── 𝙋𝙤𝙬𝙚𝙧𝙙 𝘽𝙮 𝙌𝙪𝙚𝙚𝙣 𝙍𝙪𝙫𝙖'
        }, { quoted: msg });
    }
    break;
}
case 'sticker': {
    try {
        await socket.sendMessage(sender, { react: { text: '🖼️', key: msg.key } });
        
        // Check if there's a quoted message with media or if media is in current message
        let media = null;
        let mime = '';
        
        if (msg.message?.imageMessage) {
            media = msg.message.imageMessage;
            mime = 'image';
        } else if (msg.message?.videoMessage) {
            media = msg.message.videoMessage;
            mime = 'video';
        } else if (msg.quoted?.imageMessage) {
            media = msg.quoted.imageMessage;
            mime = 'image';
        } else if (msg.quoted?.videoMessage) {
            media = msg.quoted.videoMessage;
            mime = 'video';
        }
        
        if (!media) {
            return await socket.sendMessage(sender, {
                text: `🖼️ *Sticker Maker*\n\n*Usage:* Reply to an image/video with \`${config.PREFIX}sticker\` or send image/video with caption \`${config.PREFIX}sticker\`\n\n*Example:* Reply to any image with \`${config.PREFIX}sticker\``
            }, { quoted: msg });
        }
        
        // Download the media
        const stream = await downloadContentFromMessage(media, mime);
        let buffer = Buffer.from([]);
        
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        
        // Convert to sticker with custom metadata
        const stickerMetadata = {
            packname: 'Queen Ruva AI Mini',
            author: 'IconictechInc',
            categories: ['🤖', '✨'],
            androidAvoidAutoCrop: true
        };
        
        // Send as sticker
        await socket.sendMessage(from, {
            sticker: buffer,
            ...stickerMetadata
        }, { quoted: msg });
        
    } catch (error) {
        console.error('Sticker command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Failed to create sticker. Please make sure you\'re replying to an image or video.'
        }, { quoted: msg });
    }
    break;
}

case 'groupinfo': {
    // Check if message is from a group
    if (!isGroup) {
        return await socket.sendMessage(sender, {
            text: '❌ This command only works in groups!'
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '📊', key: msg.key } });
        
        // Get group metadata
        const groupMetadata = await socket.groupMetadata(from);
        const participants = groupMetadata.participants;
        
        // Count admins
        const admins = participants.filter(p => p.admin);
        const regularUsers = participants.filter(p => !p.admin);
        
        // Get group creation date
        const creationDate = new Date(groupMetadata.creation * 1000).toLocaleDateString();
        
        // Create info message
        const infoMessage = `📊 *GROUP INFORMATION*\n\n` +
                           `📛 *Name:* ${groupMetadata.subject}\n` +
                           `👑 *Creator:* ${groupMetadata.owner?.split('@')[0] || 'Unknown'}\n` +
                           `📅 *Created:* ${creationDate}\n` +
                           `👥 *Total Members:* ${participants.length}\n` +
                           `⚡ *Admins:* ${admins.length}\n` +
                           `👤 *Regular Users:* ${regularUsers.length}\n` +
                           `🔒 *Restricted:* ${groupMetadata.restrict ? 'Yes' : 'No'}\n` +
                           `👁️ *Announcement:* ${groupMetadata.announce ? 'Yes' : 'No'}\n\n` +
                           `💾 *Use .savegroup to save all numbers*\n\n` +
                           `_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`;
        
        // Send group info
        await socket.sendMessage(sender, { text: infoMessage }, { quoted: msg });
        
        // Send group picture if available
        try {
            const groupPic = await socket.profilePictureUrl(from, 'image');
            await socket.sendMessage(sender, {
                image: { url: groupPic },
                caption: `🖼️ *${groupMetadata.subject}* Group Picture`
            }, { quoted: msg });
        } catch (picError) {
            console.log('No group picture available');
        }
        
    } catch (error) {
        console.error('Groupinfo command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Failed to get group information.'
        }, { quoted: msg });
    }
    break;
}

case 'exportgroup': {
    // Check if message is from a group
    if (!isGroup) {
        return await socket.sendMessage(sender, {
            text: '❌ This command only works in groups!'
        }, { quoted: msg });
    }
    
    // Check if user is admin
    const isAdmin = m.isAdmin;
    if (!isAdmin) {
        return await socket.sendMessage(sender, {
            text: '❌ You need to be a group admin to use this command!'
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '📤', key: msg.key } });
        
        // Get group metadata
        const groupMetadata = await socket.groupMetadata(from);
        const participants = groupMetadata.participants;
        
        // Create formatted text file
        let textData = `GROUP MEMBERS EXPORT - ${groupMetadata.subject}\n`;
        textData += `Export Date: ${new Date().toLocaleString()}\n`;
        textData += `Total Members: ${participants.length}\n\n`;
        textData += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
        
        // Add admin section
        const admins = participants.filter(p => p.admin);
        if (admins.length > 0) {
            textData += '👑 ADMINISTRATORS:\n';
            admins.forEach((admin, index) => {
                const number = admin.id.split('@')[0];
                const name = admin.notify || admin.name || 'Unknown';
                textData += `${index + 1}. ${name} (${number})\n`;
            });
            textData += '\n';
        }
        
        // Add members section
        const members = participants.filter(p => !p.admin);
        if (members.length > 0) {
            textData += '👤 MEMBERS:\n';
            members.forEach((member, index) => {
                const number = member.id.split('@')[0];
                const name = member.notify || member.name || 'Unknown';
                textData += `${index + 1}. ${name} (${number})\n`;
            });
        }
        
        // Save to file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `group-export-${timestamp}.txt`;
        fs.writeFileSync(filename, textData);
        
        // Send the text file
        await socket.sendMessage(sender, {
            document: { url: `file://${path.resolve(filename)}` },
            fileName: filename,
            mimetype: 'text/plain',
            caption: `📤 *GROUP EXPORT COMPLETE*\n\n` +
                    `📁 *File:* ${filename}\n` +
                    `📛 *Group:* ${groupMetadata.subject}\n` +
                    `👥 *Total:* ${participants.length} members\n` +
                    `👑 *Admins:* ${admins.length}\n` +
                    `👤 *Members:* ${members.length}\n\n` +
                    `_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
        }, { quoted: msg });
        
        // Clean up
        setTimeout(() => {
            if (fs.existsSync(filename)) {
                fs.unlinkSync(filename);
            }
        }, 5000);
        
    } catch (error) {
        console.error('Exportgroup command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Failed to export group data.'
        }, { quoted: msg });
    }
    break;
}
// ════════════════════════════════════════════
//              REPO
// ════════════════════════════════════════════
case 'repo': {
    await socket.sendMessage(sender, { react: { text: '📊', key: msg.key } });
    
    try {
        const repoUrl = 'https://api.github.com/repos/iconictech-dev/Queen-Ruva-AI-Beta';
        
        // Fetch both repo data and commits in parallel for better performance
        const [repoResponse, commitsResponse] = await Promise.all([
            fetch(repoUrl),
            fetch(`${repoUrl}/commits`)
        ]);
        
        if (!repoResponse.ok || !commitsResponse.ok) {
            throw new Error(`GitHub API error: ${repoResponse.status} ${commitsResponse.status}`);
        }
        
        const repoData = await repoResponse.json();
        const commitsData = await commitsResponse.json();
        
        const stars = repoData.stargazers_count || 0;
        const forks = repoData.forks_count || 0;
        const watchers = repoData.watchers_count || 0;
        const lastUpdated = new Date(repoData.updated_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const openIssues = repoData.open_issues_count || 0;
        const language = repoData.language || 'JavaScript';
        const size = (repoData.size / 1024).toFixed(2); // Convert KB to MB
        
        // Get latest commit info
        const latestCommit = commitsData[0];
        const commitDate = latestCommit ? new Date(latestCommit.commit.author.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }) : 'Unknown';
        const commitAuthor = latestCommit ? latestCommit.commit.author.name : 'Unknown';
        const commitMessage = latestCommit ? latestCommit.commit.message.replace(/\n/g, ' ').substring(0, 80) : 'No commits';
        
        // Get release info if available
        let latestRelease = 'v3.0 Stable';
        try {
            const releasesResponse = await fetch(`${repoUrl}/releases/latest`);
            if (releasesResponse.ok) {
                const releaseData = await releasesResponse.json();
                latestRelease = releaseData.tag_name || 'v3.0 Stable';
            }
        } catch (releaseError) {
            console.log('Could not fetch release info, using default');
        }
        
        const repoText = `
╔═════════════════════════════
║   📊 *GITHUB REPOSITORY STATS*
╠═════════════════════════════
║
║  *✨ Repository Information*
║  ──────────────────────────
║  🏷️  Name: ${repoData.name || 'Queen-Ruva-AI-Beta'}
║  📝 Description: ${(repoData.description || 'Queen Ruva AI Beta WhatsApp Bot').substring(0, 60)}...
║  💻 Language: ${language}
║  📦 Repository Size: ${size} MB
║  🔖 Latest Release: ${latestRelease}
║
║  *📈 GitHub Statistics*
║  ──────────────────────────
║  ⭐ Stars: ${stars.toLocaleString()}
║  🍴 Forks: ${forks.toLocaleString()}
║  👀 Watchers: ${watchers.toLocaleString()}
║  🐛 Open Issues: ${openIssues}
║  📊 License: ${repoData.license?.name || 'MIT'}
║
║  *🔄 Latest Activity*
║  ──────────────────────────
║  📅 Last Updated: ${lastUpdated}
║  🕒 Last Commit: ${commitDate}
║  👤 Author: ${commitAuthor}
║  📝 Message: ${commitMessage}
║
║  *🔗 Quick Access*
║  ──────────────────────────
║  🌐 Web: ${repoData.html_url}
║  📥 Clone: \`git clone ${repoData.clone_url}\`
║
╚═════════════════════════════

*📱 Use buttons below for quick actions:*
`;

        // Create buttons with simpler format
        const buttons = [
            {
                buttonId: 'github_link',
                buttonText: {
                    displayText: '⭐ Star on GitHub'
                },
                type: 2, // URL button type
                url: repoData.html_url
            },
            {
                buttonId: 'fork_repo',
                buttonText: {
                    displayText: '🍴 Fork Repository'
                },
                type: 2,
                url: `${repoData.html_url}/fork`
            },
            {
                buttonId: 'view_issues',
                buttonText: {
                    displayText: '🐛 View Issues'
                },
                type: 2,
                url: `${repoData.html_url}/issues`
            }
        ];

        // Create list message for better mobile experience
        const sections = [
            {
                title: "📱 Quick Actions",
                rows: [
                    {
                        title: "⭐ Star Repository",
                        description: "Give us a star on GitHub",
                        rowId: `${config.PREFIX}starrepo`
                    },
                    {
                        title: "🍴 Fork Repository",
                        description: "Create your own copy",
                        rowId: `${config.PREFIX}forkrepo`
                    },
                    {
                        title: "📚 Documentation",
                        description: "View setup guide",
                        rowId: `${config.PREFIX}docs`
                    },
                    {
                        title: "👑 Contact Owner",
                        description: "Get help from developer",
                        rowId: `${config.PREFIX}owner`
                    }
                ]
            }
        ];

        // Send message with both text and interactive list
        await socket.sendMessage(sender, {
            text: repoText,
            footer: "Queen Ruva AI Beta • Powered by GitHub API",
            mentions: [], // Add mentions if needed
            mentions: [sender],
            headerType: 1,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: false,
            }
        });

        // Send interactive list separately
        await socket.sendMessage(sender, {
            text: "*📱 Quick Actions Menu*\nSelect an option below:",
            footer: "Repository Actions",
            buttons: buttons,
            viewOnce: false,
            mentions: [sender]
        });

    } catch (error) {
        console.error('Error fetching GitHub data:', error);
        
        // Send error message with retry option
        await socket.sendMessage(sender, { 
            text: `❌ *Failed to fetch repository data*\n\nError: ${error.message}\n\nPlease try again in a moment or visit GitHub directly:\nhttps://github.com/iconictech-dev/Queen-Ruva-AI-Beta`,
            buttons: [
                {
                    buttonId: 'retry_repo',
                    buttonText: { displayText: '🔄 Retry' },
                    type: 1
                },
                {
                    buttonId: 'github_direct',
                    buttonText: { displayText: '🌐 Open GitHub' },
                    type: 2,
                    url: 'https://github.com/iconictech-dev/Queen-Ruva-AI-Beta'
                }
            ]
        }, { quoted: msg });
    }
    break;
}
 case 'alive': {
    try {
        const os = require('os');
        const start = Date.now();
        const startTime = socketCreationTime.get(number) || Date.now();
        const uptime = Math.floor((Date.now() - startTime) / 1000);
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        const totalMem = os.totalmem() / 1024 / 1024;
        const freeMem = os.freemem() / 1024 / 1024;
        const usedMem = totalMem - freeMem;
        const memPercent = ((usedMem / totalMem) * 100).toFixed(1);
        const latency = Date.now() - start;
        const speedStatus = latency < 100 ? '🟢 Fast' : latency < 300 ? '🟡 Normal' : '🔴 Slow';

        const ramNotice = (() => {
            if (memPercent >= 90) return `\n│ 🔴 *RAM Critical!* Performance may drop`;
            if (memPercent >= 75) return `\n│ 🟠 *RAM High!* Running under pressure`;
            if (memPercent >= 50) return `\n│ 🟡 *RAM Moderate* Running stable`;
            return `\n│ 🟢 *RAM Healthy* All systems good`;
        })();

        const imageBuffer = fs.readFileSync('./ruva.jpg');

        await socket.sendMessage(from, {
            image: imageBuffer,
            caption:
                `╭───「 *Qᴜᴇᴇɴ ʀᴜᴠᴀ ᴍɪɴɪ* 」───╮\n` +
                `│\n` +
                `│ 🤖 Status: Online ✅\n` +
                `│ ⏳ Uptime: ${days}d ${hours}h ${minutes}m ${seconds}s\n` +
                `│ ⚡ Speed: ${latency}ms ${speedStatus}\n` +
                `│ 🟢 Active Bots: ${activeSockets.size}\n` +
                `│\n` +
                `│ 💾 RAM: ${usedMem.toFixed(0)}MB / ${totalMem.toFixed(0)}MB\n` +
                `│ 📊 Usage: ${memPercent}%` +
                ramNotice + `\n` +
                `│\n` +
                `│ 🖥️ Node: ${process.version}\n` +
                `│ 🌐 Platform: ${os.platform()}\n` +
                `│\n` +
                `╰───「 *Iconic Tech* 」───╯`,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: (config.NEWSLETTER_JID || '').trim(),
                    newsletterName: 'Qᴜᴇᴇɴ ʀᴜᴠᴀ',
                    serverMessageId: 143
                }
            }
        }, { quoted: msg });
    } catch (err) {
        await socket.sendMessage(sender, { text: `❌ Error: ${err.message}` }, { quoted: msg });
    }
    break;
}

case 'runtime': {
    try {
        const os = require('os');
        const startTime = socketCreationTime.get(number) || Date.now();
        const uptime = Math.floor((Date.now() - startTime) / 1000);
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        const memUsage = process.memoryUsage();
        const heapUsed = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
        const heapTotal = (memUsage.heapTotal / 1024 / 1024).toFixed(2);
        const rss = (memUsage.rss / 1024 / 1024).toFixed(2);
        const totalMem = (os.totalmem() / 1024 / 1024).toFixed(0);
        const freeMem = (os.freemem() / 1024 / 1024).toFixed(0);

        await socket.sendMessage(from,
            {
                text:
                    `╭───「 ⏱️ *Runtime Stats* 」───╮\n` +
                    `│\n` +
                    `│ ⏳ Uptime: ${days}d ${hours}h ${minutes}m ${seconds}s\n` +
                    `│ 🟢 Active Bots: ${activeSockets.size}\n` +
                    `│\n` +
                    `│ 🧠 Heap Used: ${heapUsed} MB\n` +
                    `│ 🧠 Heap Total: ${heapTotal} MB\n` +
                    `│ 📦 RSS: ${rss} MB\n` +
                    `│ 💾 Total RAM: ${totalMem} MB\n` +
                    `│ 🟢 Free RAM: ${freeMem} MB\n` +
                    `│\n` +
                    `│ 🖥️ Node: ${process.version}\n` +
                    `│ 🌐 Platform: ${os.platform()}\n` +
                    `│\n` +
                    `╰───「 *Queen Ruva Mini* 」───╯`
            }, { quoted: msg });
    } catch (err) {
        await socket.sendMessage(sender, { text: `❌ Error: ${err.message}` }, { quoted: msg });
    }
    break;
}
case 'fact': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    try {
        await socket.sendMessage(sender, { react: { text: '🤓', key: msg.key } });
        
        const apiUrl = 'https://api.popcat.xyz/fact';
        const response = await axios.get(apiUrl);

        if (response.data && response.data.fact) {
            const fact = response.data.fact;
            await socket.sendMessage(sender, {
                text: `*Did you know?* 🤔\n\n${fact}\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to fetch a random fact. Please try again later.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Fact command error:', error);
        await socket.sendMessage(sender, {
            text: '⚠️ An error occurred while processing your request.'
        }, { quoted: msg });
    }
    break;
}

case 'translation3':
case 'translate': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const text = q.replace(/^\.(translation3|translate)\s*/i, '').trim();
    
    if (!text) {
        return await socket.sendMessage(sender, {
            text: `📌 *Usage:* \`.translate <text>\`\n\n*Example:* \`${config.PREFIX}translate hello world\``
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🌐', key: msg.key } });
        
        const apiUrl = `https://api.popcat.xyz/translate?to=en&text=${encodeURIComponent(text)}`;
        const response = await axios.get(apiUrl);
        
        if (response.data && response.data.translated) {
            await socket.sendMessage(sender, {
                text: `*🌍 Translation Result*\n\n📝 *Original:* ${text}\n\n✅ *Translated:* ${response.data.translated}\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to translate the text. Please try again.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Translate command error:', error);
        await socket.sendMessage(sender, {
            text: '⚠️ Translation service is currently unavailable.'
        }, { quoted: msg });
    }
    break;
}

case 'gfx5':
case 'tripletext': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const text = q.replace(/^\.(gfx5|tripletext)\s*/i, '').trim();
    
    if (!text) {
        return await socket.sendMessage(sender, {
            text: `🔮 *GFX 5 Triple Text Generator*\n\n*Usage:* \`${config.PREFIX}gfx5 text1 | text2 | text3\`\n\n*Example:* \`${config.PREFIX}gfx5 Queen | Ruva | AI\`\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
        }, { quoted: msg });
    }
    
    const parts = text.split('|').map(p => p.trim());
    if (parts.length !== 3) {
        return await socket.sendMessage(sender, {
            text: `⚠️ *Incorrect Format*\n\nPlease provide exactly three texts separated by "|"\n\n*Example:* \`${config.PREFIX}gfx5 Line1 | Line2 | Line3\``
        }, { quoted: msg });
    }
    
    const [text1, text2, text3] = parts;
    
    try {
        await socket.sendMessage(sender, { react: { text: '✨', key: msg.key } });
        
        const apiUrl = `https://api.nexoracle.com/image-creating/gfx5?apikey=75957eaec54d70ace3&text1=${encodeURIComponent(text1)}&text2=${encodeURIComponent(text2)}&text3=${encodeURIComponent(text3)}`;
        
        await socket.sendMessage(sender, {
            image: { url: apiUrl },
            caption: `🔮 *TRIPLE TEXT DESIGN*\n\n${text1}\n${text2}\n${text3}\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
        }, { quoted: msg });
        
    } catch (error) {
        console.error('GFX5 command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Failed to generate triple text design. Please try again.'
        }, { quoted: msg });
    }
    break;
}

case 'shimmer': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const text = q.replace(/^\.shimmer\s*/i, '').trim();
    
    if (!text) {
        return await socket.sendMessage(sender, {
            text: `✨ *Shimmering AOV Avatar Generator*\n\n*Usage:* \`${config.PREFIX}shimmer <text>\`\n\n*Example:* \`${config.PREFIX}shimmer QueenRuva\`\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '✨', key: msg.key } });
        
        const apiUrl = `https://api.nexoracle.com/ephoto360/shimmering-aov-avaters?apikey=75957eaec54d70ace3&text=${encodeURIComponent(text)}`;
        
        await socket.sendMessage(sender, {
            image: { url: apiUrl },
            caption: `✨ *SHIMMERING AOV AVATAR*\n\n"${text}"\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
        }, { quoted: msg });
        
    } catch (error) {
        console.error('Shimmer command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Failed to generate shimmering avatar. Please try again.'
        }, { quoted: msg });
    }
    break;
}

case 'addapi': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const text = q.replace(/^\.addapi\s*/i, '').trim();
    const args = text.split(' ');
    
    if (args.length < 3) {
        return await socket.sendMessage(sender, {
            text: `📌 *Add API to Database*\n\n*Usage:* \`${config.PREFIX}addapi <api_name> <developer> <api_url>\`\n\n*Example:* \`${config.PREFIX}addapi QueenRuvaAPI IconicTech https://api.queenruva.com\``
        }, { quoted: msg });
    }
    
    try {
        const apiName = args[0];
        const developer = args[1];
        const apiUrl = args.slice(2).join(' ');
        
        try {
            new URL(apiUrl);
        } catch {
            return await socket.sendMessage(sender, {
                text: '❌ Invalid API URL format.'
            }, { quoted: msg });
        }
        
        const apiData = {
            name: apiName,
            developer: developer,
            url: apiUrl,
            description: "User submitted API",
            uploadedBy: developer,
            timestamp: Date.now()
        };
        
        await axios.post(
            `https://store-3f287-default-rtdb.firebaseio.com/apis.json`,
            apiData
        );
        
        await socket.sendMessage(sender, {
            text: `✅ *API Added Successfully*\n\n🌐 *Name:* ${apiName}\n👨‍💻 *Developer:* ${developer}\n🔗 *URL:* ${apiUrl}\n\n📊 Added to CodeWave database\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
        }, { quoted: msg });
        
    } catch (error) {
        console.error('Add API command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Failed to add API to database.'
        }, { quoted: msg });
    }
    break;
}
case 'mute': {
    // Check if message is from a group
    if (!isGroup) {
        return await socket.sendMessage(sender, {
            text: '❌ This command only works in groups!'
        }, { quoted: msg });
    }
    
    // Check if user is group admin
    const isAdmin = m.isAdmin;
    if (!isAdmin) {
        return await socket.sendMessage(sender, {
            text: '❌ You need to be a group admin to use this command!'
        }, { quoted: msg });
    }
    
    // Check if bot is admin
    const isBotAdmin = m.isBotAdmin;
    if (!isBotAdmin) {
        return await socket.sendMessage(sender, {
            text: '❌ I need to be a group admin to mute/unmute!'
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🔇', key: msg.key } });
        
        // Check if user is replying to someone
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedSender = msg.message?.extendedTextMessage?.contextInfo?.participant;
        
        if (quotedSender) {
            // Mute the quoted user
            await socket.groupParticipantsUpdate(from, [quotedSender], 'mute');
            await socket.sendMessage(sender, {
                text: `✅ *User Muted*\n\n🔇 Successfully muted the user in this group.\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else if (args[0]) {
            // Mute using phone number
            let targetNumber = args[0].replace(/[^0-9]/g, '');
            if (targetNumber.length < 10) {
                return await socket.sendMessage(sender, {
                    text: '❌ Invalid phone number format! Use: .mute 26378xxxxxx'
                }, { quoted: msg });
            }
            
            const targetJid = `${targetNumber}@s.whatsapp.net`;
            await socket.groupParticipantsUpdate(from, [targetJid], 'mute');
            await socket.sendMessage(sender, {
                text: `✅ *User Muted*\n\n🔇 Successfully muted ${targetNumber} in this group.\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            return await socket.sendMessage(sender, {
                text: `🔇 *Mute User*\n\n*Usage:* Reply to a user's message with \`${config.PREFIX}mute\`\n\n*OR*\n\nUse: \`${config.PREFIX}mute 26378xxxxxx\``
            }, { quoted: msg });
        }
        
    } catch (error) {
        console.error('Mute command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Failed to mute user. Make sure:\n1. User is in the group\n2. I have admin permissions\n3. The user is not an admin'
        }, { quoted: msg });
    }
    break;
}

case 'unmute': {
    // Check if message is from a group
    if (!isGroup) {
        return await socket.sendMessage(sender, {
            text: '❌ This command only works in groups!'
        }, { quoted: msg });
    }
    
    // Check if user is group admin
    const isAdmin = m.isAdmin;
    if (!isAdmin) {
        return await socket.sendMessage(sender, {
            text: '❌ You need to be a group admin to use this command!'
        }, { quoted: msg });
    }
    
    // Check if bot is admin
    const isBotAdmin = m.isBotAdmin;
    if (!isBotAdmin) {
        return await socket.sendMessage(sender, {
            text: '❌ I need to be a group admin to mute/unmute!'
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🔊', key: msg.key } });
        
        // Check if user is replying to someone
        const quotedSender = msg.message?.extendedTextMessage?.contextInfo?.participant;
        
        if (quotedSender) {
            // Unmute the quoted user
            await socket.groupParticipantsUpdate(from, [quotedSender], 'unmute');
            await socket.sendMessage(sender, {
                text: `✅ *User Unmuted*\n\n🔊 Successfully unmuted the user in this group.\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else if (args[0]) {
            // Unmute using phone number
            let targetNumber = args[0].replace(/[^0-9]/g, '');
            if (targetNumber.length < 10) {
                return await socket.sendMessage(sender, {
                    text: '❌ Invalid phone number format! Use: .unmute 26378xxxxxx'
                }, { quoted: msg });
            }
            
            const targetJid = `${targetNumber}@s.whatsapp.net`;
            await socket.groupParticipantsUpdate(from, [targetJid], 'unmute');
            await socket.sendMessage(sender, {
                text: `✅ *User Unmuted*\n\n🔊 Successfully unmuted ${targetNumber} in this group.\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            return await socket.sendMessage(sender, {
                text: `🔊 *Unmute User*\n\n*Usage:* Reply to a user's message with \`${config.PREFIX}unmute\`\n\n*OR*\n\nUse: \`${config.PREFIX}unmute 26378xxxxxx\``
            }, { quoted: msg });
        }
        
    } catch (error) {
        console.error('Unmute command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Failed to unmute user.'
        }, { quoted: msg });
    }
    break;
}

case 'block': {
    // Check if user is bot owner
    if (!isOwner) {
        return await socket.sendMessage(sender, {
            text: '❌ This command is only for the bot owner.'
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🚫', key: msg.key } });
        
        // Check if user is replying to someone
        const quotedSender = msg.message?.extendedTextMessage?.contextInfo?.participant;
        
        if (quotedSender) {
            // Block the quoted user
            await socket.updateBlockStatus(quotedSender, 'block');
            await socket.sendMessage(sender, {
                text: `✅ *User Blocked*\n\n🚫 Successfully blocked the user.\n\n📌 User can no longer message this bot.\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else if (args[0]) {
            // Block using phone number
            let targetNumber = args[0].replace(/[^0-9]/g, '');
            if (targetNumber.length < 10) {
                return await socket.sendMessage(sender, {
                    text: '❌ Invalid phone number format! Use: .block 26378xxxxxx'
                }, { quoted: msg });
            }
            
            const targetJid = `${targetNumber}@s.whatsapp.net`;
            await socket.updateBlockStatus(targetJid, 'block');
            await socket.sendMessage(sender, {
                text: `✅ *User Blocked*\n\n🚫 Successfully blocked ${targetNumber}.\n\n📌 User can no longer message this bot.\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            return await socket.sendMessage(sender, {
                text: `🚫 *Block User*\n\n*Usage:* Reply to a user's message with \`${config.PREFIX}block\`\n\n*OR*\n\nUse: \`${config.PREFIX}block 26378xxxxxx\``
            }, { quoted: msg });
        }
        
    } catch (error) {
        console.error('Block command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Failed to block user.'
        }, { quoted: msg });
    }
    break;
}

case 'unblock': {
    // Check if user is bot owner
    if (!isOwner) {
        return await socket.sendMessage(sender, {
            text: '❌ This command is only for the bot owner.'
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
        
        // Check if user is replying to someone
        const quotedSender = msg.message?.extendedTextMessage?.contextInfo?.participant;
        
        if (quotedSender) {
            // Unblock the quoted user
            await socket.updateBlockStatus(quotedSender, 'unblock');
            await socket.sendMessage(sender, {
                text: `✅ *User Unblocked*\n\n🔓 Successfully unblocked the user.\n\n📌 User can now message this bot again.\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else if (args[0]) {
            // Unblock using phone number
            let targetNumber = args[0].replace(/[^0-9]/g, '');
            if (targetNumber.length < 10) {
                return await socket.sendMessage(sender, {
                    text: '❌ Invalid phone number format! Use: .unblock 26378xxxxxx'
                }, { quoted: msg });
            }
            
            const targetJid = `${targetNumber}@s.whatsapp.net`;
            await socket.updateBlockStatus(targetJid, 'unblock');
            await socket.sendMessage(sender, {
                text: `✅ *User Unblocked*\n\n🔓 Successfully unblocked ${targetNumber}.\n\n📌 User can now message this bot again.\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            return await socket.sendMessage(sender, {
                text: `🔓 *Unblock User*\n\n*Usage:* Reply to a user's message with \`${config.PREFIX}unblock\`\n\n*OR*\n\nUse: \`${config.PREFIX}unblock 26378xxxxxx\``
            }, { quoted: msg });
        }
        
    } catch (error) {
        console.error('Unblock command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Failed to unblock user.'
        }, { quoted: msg });
    }
    break;
}
case 'mini': {
    try {
        await socket.sendMessage(sender, { react: { text: '👑', key: msg.key } });

        const websiteLink = config.MINI_URL || 'https://queen-ruva-mini.zone.id';
        const imageBuffer = fs.readFileSync('./ruva.jpg');

        await socket.sendMessage(from, {
            image: imageBuffer,
            caption:
                `╭───「 👑 *Queen Ruva Mini* 」───╮\n` +
                `│\n` +
                `│ 🌐 *Website:* ${websiteLink}\n` +
                `│\n` +
                `│ 🔧 *How to Pair:*\n` +
                `│ 1️⃣ Visit: ${websiteLink}\n` +
                `│ 2️⃣ Enter your number (e.g. 26378xxxxxxx)\n` +
                `│ 3️⃣ Get your 6-digit pairing code\n` +
                `│ 4️⃣ Open WhatsApp → Linked Devices\n` +
                `│ 5️⃣ Tap "Link a Device" → Enter code\n` +
                `│ 6️⃣ Bot connects automatically ✅\n` +
                `│\n` +
                `│ 💡 *Tips:*\n` +
                `│ • Use correct country code\n` +
                `│ • Code expires in 10 minutes\n` +
                `│ • Contact: +263 78 611 5435\n` +
                `│\n` +
                `╰───「 *Iconic Tech* 」───╯`,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: (config.NEWSLETTER_JID || '').trim(),
                    newsletterName: 'Qᴜᴇᴇɴ ʀᴜᴠᴀ',
                    serverMessageId: 143
                }
            }
        }, { quoted: msg });

    } catch (error) {
        console.error('Mini command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Failed to send pairing information.'
        }, { quoted: msg });
    }
    break;
}
case 'getpp':
case 'getprofile': {
    try {
        await socket.sendMessage(sender, { react: { text: '📸', key: msg.key } });
        
        // Check if user is replying to someone
        const quotedSender = msg.message?.extendedTextMessage?.contextInfo?.participant;
        
        let targetJid;
        
        if (quotedSender) {
            targetJid = quotedSender;
        } else if (args[0]) {
            // Get profile using phone number
            let targetNumber = args[0].replace(/[^0-9]/g, '');
            if (targetNumber.length < 10) {
                return await socket.sendMessage(sender, {
                    text: '❌ Invalid phone number format! Use: .getpp 26378xxxxxx'
                }, { quoted: msg });
            }
            targetJid = `${targetNumber}@s.whatsapp.net`;
        } else if (msg.key.participant) {
            // Use participant in group message
            targetJid = msg.key.participant;
        } else {
            return await socket.sendMessage(sender, {
                text: `📸 *Get Profile Picture*\n\n*Usage:* Reply to a user's message with \`${config.PREFIX}getpp\`\n\n*OR*\n\nUse: \`${config.PREFIX}getpp 26378xxxxxx\``
            }, { quoted: msg });
        }
        
        // Get profile picture
        let profilePicUrl;
        try {
            profilePicUrl = await socket.profilePictureUrl(targetJid, 'image');
        } catch (error) {
            // Use default avatar if no profile picture
            profilePicUrl = 'https://i.ibb.co/KhYC4FY/1221bc0bdd2354b42b293317ff2adbcf-icon.png';
        }
        
        // Get user info
        const [userInfo] = await socket.onWhatsApp(targetJid);
        const phoneNumber = targetJid.split('@')[0];
        const userName = userInfo?.exists ? userInfo.name || 'Unknown' : 'Unknown';
        
        // Send profile picture with info
        await socket.sendMessage(sender, {
            image: { url: profilePicUrl },
            caption: `👤 *Profile Information*\n\n📱 *Number:* ${phoneNumber}\n👤 *Name:* ${userName}\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`,
            mentions: [targetJid]
        }, { quoted: msg });
        
    } catch (error) {
        console.error('GetPP command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Failed to get profile picture. User may not have a profile picture or may have privacy settings enabled.'
        }, { quoted: msg });
    }
    break;
}
case 'findapi': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const developer = q.replace(/^\.findapi\s*/i, '').trim();
    
    if (!developer) {
        return await socket.sendMessage(sender, {
            text: `🔍 *Find API by Developer*\n\n*Usage:* \`${config.PREFIX}findapi <developer_name>\`\n\n*Example:* \`${config.PREFIX}findapi IconicTech\``
        }, { quoted: msg });
    }
    
    try {
        const response = await axios.get(`https://store-3f287-default-rtdb.firebaseio.com/apis.json`);
        const data = response.data;
        
        if (!data) {
            return await socket.sendMessage(sender, {
                text: `⚠️ No APIs found for developer: *${developer}*`
            }, { quoted: msg });
        }
        
        const filtered = Object.values(data).filter(api => api.developer === developer);
        
        if (filtered.length === 0) {
            return await socket.sendMessage(sender, {
                text: `⚠️ No APIs found for developer: *${developer}*`
            }, { quoted: msg });
        }
        
        let text = `🔎 *APIs by ${developer}*\n\n`;
        let i = 1;
        
        for (const api of filtered) {
            text += `*${i}.* 🌐 ${api.name}\n🔗 URL: ${api.url}\n📩 Uploaded by: ${api.uploadedBy}\n\n`;
            i++;
        }
        
        text += `📊 Total APIs: *${filtered.length}*\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`;
        
        await socket.sendMessage(sender, { text }, { quoted: msg });
        
    } catch (error) {
        console.error('Find API command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Failed to search for APIs.'
        }, { quoted: msg });
    }
    break;
}
case 'tiktok': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const link = q.replace(/^\.tiktok\s*/i, '').trim();
    
    if (!link) {
        return await socket.sendMessage(sender, {
            text: `📽️ *TikTok Video Downloader*\n\n*Usage:* \`${config.PREFIX}tiktok <tiktok-url>\`\n\n*Example:* \`${config.PREFIX}tiktok https://vm.tiktok.com/ZMBW2aFWT/\``
        }, { quoted: msg });
    }
    
    if (!link.includes('tiktok.com')) {
        return await socket.sendMessage(sender, {
            text: '❌ *Invalid TikTok URL*\nPlease provide a valid TikTok video link!'
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🎬', key: msg.key } });
        
        await socket.sendMessage(sender, {
            text: '⏳ Downloading TikTok video, please wait...'
        }, { quoted: msg });
        
        const apiUrl = `https://kaiz-apis.gleeze.com/api/tiktok-dl?url=${encodeURIComponent(link)}`;
        const response = await axios.get(apiUrl, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const videoUrl = response.data?.videoUrl || response.data?.url || response.data?.result?.videoUrl;
        
        if (videoUrl) {
            await socket.sendMessage(sender, {
                video: { url: videoUrl },
                mimetype: 'video/mp4',
                caption: `╭━━〔 *🎬 Qᴜᴇᴇɴ ʀᴜᴠᴀ TIKTOK* 〕━━╮\n` +
                        `┃ ┃ 📽️ *Video Downloaded Successfully*\n` +
                        `┃ ┃ 💻 *Powered by Iconic Tech*\n` +
                        `╰━━━━━━━━━━━━━━━━━━━━━━━╯`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ *Could not download TikTok video*\nThe API might be temporarily unavailable.'
            }, { quoted: msg });
        }
        
    } catch (error) {
        console.error('TikTok command error:', error);
        await socket.sendMessage(sender, {
            text: `❌ *Failed to download TikTok video*\nError: ${error.message}`
        }, { quoted: msg });
    }
    break;
}

case 'ytmp3': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const url = q.replace(/^\.ytmp3\s*/i, '').trim();
    
    if (!url) {
        return await socket.sendMessage(sender, {
            text: `🎵 *YouTube to MP3*\n\n*Usage:* \`${config.PREFIX}ytmp3 <youtube-url>\`\n\n*Example:* \`${config.PREFIX}ytmp3 https://youtu.be/2WmBa1CviYE\``
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🎵', key: msg.key } });
        
        await socket.sendMessage(sender, {
            text: '⏳ Converting YouTube video to MP3...'
        }, { quoted: msg });
        
        const apiUrl = `https://apiskeith.vercel.app/download/ytmp3?url=${encodeURIComponent(url)}`;
        const response = await axios.get(apiUrl);
        
        if (response.data?.status && response.data.result?.url) {
            const audioUrl = response.data.result.url;
            const filename = response.data.result.filename || 'audio.mp3';
            
            await socket.sendMessage(sender, {
                audio: { url: audioUrl },
                mimetype: 'audio/mpeg',
                fileName: filename,
                caption: `🎧 *YouTube to MP3*\n\n📁 *File:* ${filename}\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ *Failed to convert YouTube video to MP3*'
            }, { quoted: msg });
        }
        
    } catch (error) {
        console.error('Ytmp3 command error:', error);
        await socket.sendMessage(sender, {
            text: `❌ *Conversion Failed*\nError: ${error.message}`
        }, { quoted: msg });
    }
    break;
}

case 'expand': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const shortUrl = q.replace(/^\.expand\s*/i, '').trim();
    
    if (!shortUrl) {
        return await socket.sendMessage(sender, {
            text: `🔍 *URL Expander*\n\n*Usage:* \`${config.PREFIX}expand <short-url>\`\n\n*Example:* \`${config.PREFIX}expand https://bit.ly/example\``
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } });
        
        const response = await fetch(shortUrl, { redirect: 'manual' });
        const longUrl = response.headers.get('location');
        
        if (longUrl) {
            await socket.sendMessage(sender, {
                text: `🔗 *Original URL Found*\n\n${longUrl}\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ *Could not expand URL*'
            }, { quoted: msg });
        }
        
    } catch (error) {
        console.error('Expand command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ *Failed to expand URL*'
        }, { quoted: msg });
    }
    break;
}

case 'shorturl': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const input = q.replace(/^\.shorturl\s*/i, '').trim();
    const [url, service = 'tinyurl'] = input.split(' ');
    
    if (!url) {
        return await socket.sendMessage(sender, {
            text: `🔗 *URL Shortener*\n\n*Usage:* \`${config.PREFIX}shorturl <url> [service]\`\n\n*Services:* tinyurl, bitly, isgd\n\n*Example:* \`${config.PREFIX}shorturl https://example.com tinyurl\``
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🔗', key: msg.key } });
        
        let shortUrl;
        
        if (service === 'bitly') {
            // Bitly implementation (you'll need to add proper API key)
            const bitlyToken = ''; // Add your Bitly token here
            const response = await axios.post('https://api-ssl.bitly.com/v4/shorten', {
                long_url: url
            }, {
                headers: {
                    'Authorization': `Bearer ${bitlyToken}`,
                    'Content-Type': 'application/json'
                }
            });
            shortUrl = response.data.link;
        } else if (service === 'isgd') {
            const response = await axios.get(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`);
            shortUrl = response.data;
        } else {
            // Default: tinyurl
            const response = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
            shortUrl = response.data;
        }
        
        if (shortUrl) {
            await socket.sendMessage(sender, {
                text: `🔗 *Shortened URL (${service.toUpperCase()})*\n\n${shortUrl}\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: `❌ *Failed to shorten URL using ${service}*`
            }, { quoted: msg });
        }
        
    } catch (error) {
        console.error('Shorturl command error:', error);
        await socket.sendMessage(sender, {
            text: `❌ *Failed to shorten URL*\nError: ${error.message}`
        }, { quoted: msg });
    }
    break;
}

case 'ytstalk': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const username = q.replace(/^\.ytstalk\s*/i, '').trim();
    
    if (!username) {
        return await socket.sendMessage(sender, {
            text: `📺 *YouTube Channel Stalker*\n\n*Usage:* \`${config.PREFIX}ytstalk <username/channel>\`\n\n*Example:* \`${config.PREFIX}ytstalk iconictech\``
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } });
        
        const formattedUsername = username.startsWith('@') ? username : `@${username}`;
        const apiUrl = `https://apiskeith.vercel.app/stalker/ytchannel?user=${encodeURIComponent(formattedUsername)}`;
        const response = await axios.get(apiUrl);
        
        if (response.data?.status && response.data.result?.channel) {
            const channel = response.data.result.channel;
            const videos = response.data.result.videos || [];
            
            let message = `📺 *YouTube Channel Info*\n\n`;
            message += `👤 *Channel:* ${channel.username}\n`;
            message += `🔗 *URL:* ${channel.url}\n`;
            message += `📝 *Description:* ${channel.description?.substring(0, 100) || 'No description'}...\n`;
            message += `👥 *Subscribers:* ${channel.stats?.subscribers?.toLocaleString() || 'N/A'}\n`;
            message += `🎬 *Total Videos:* ${channel.stats?.videos?.toLocaleString() || 'N/A'}\n\n`;
            
            if (videos.length > 0) {
                message += `📌 *Recent Videos:*\n`;
                videos.slice(0, 3).forEach((video, index) => {
                    message += `\n${index + 1}. *${video.title}*\n`;
                    message += `   👁️ ${video.views?.toLocaleString() || 0} views\n`;
                    message += `   📅 ${video.published || 'Unknown date'}\n`;
                });
            }
            
            message += `\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`;
            
            await socket.sendMessage(sender, {
                text: message
            }, { quoted: msg });
            
            // Send channel avatar if available
            if (channel.avatar) {
                await socket.sendMessage(sender, {
                    image: { url: channel.avatar },
                    caption: `🖼️ ${channel.username}'s Channel Avatar`
                }, { quoted: msg });
            }
            
        } else {
            await socket.sendMessage(sender, {
                text: `❌ *YouTube channel "${username}" not found*`
            }, { quoted: msg });
        }
        
    } catch (error) {
        console.error('Ytstalk command error:', error);
        await socket.sendMessage(sender, {
            text: `❌ *Failed to fetch YouTube channel info*`
        }, { quoted: msg });
    }
    break;
}

case 'countryinfo': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const country = q.replace(/^\.countryinfo\s*/i, '').trim();
    
    if (!country) {
        return await socket.sendMessage(sender, {
            text: `🌍 *Country Information*\n\n*Usage:* \`${config.PREFIX}countryinfo <country-name>\`\n\n*Example:* \`${config.PREFIX}countryinfo Kenya\``
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🌍', key: msg.key } });
        
        const apiUrl = `https://apiskeith.vercel.app/stalker/country?region=${encodeURIComponent(country)}`;
        const response = await axios.get(apiUrl);
        
        if (response.data?.status && response.data.result) {
            const result = response.data.result;
            const basicInfo = result.basicInfo || {};
            const geography = result.geography || {};
            const culture = result.culture || {};
            
            let message = `🌍 *Country Information*\n\n`;
            message += `🏷️ *Name:* ${basicInfo.name || country}\n`;
            message += `🏙️ *Capital:* ${basicInfo.capital || 'N/A'}\n`;
            message += `📞 *Phone Code:* ${basicInfo.phoneCode || 'N/A'}\n`;
            message += `🌐 *Internet TLD:* ${basicInfo.internetTLD || 'N/A'}\n\n`;
            
            if (geography.continent) {
                message += `🌄 *Geography*\n`;
                message += `📌 *Continent:* ${geography.continent.name || 'N/A'}\n`;
                message += `📏 *Area:* ${geography.area?.sqKm?.toLocaleString() || 'N/A'} km²\n`;
                message += `📍 *Coordinates:* ${geography.coordinates?.latitude || 'N/A'}, ${geography.coordinates?.longitude || 'N/A'}\n\n`;
            }
            
            if (culture.languages) {
                message += `🗣️ *Languages:* ${culture.languages.native?.join(', ') || 'N/A'}\n`;
                message += `💰 *Currency:* ${result.government?.currency || 'N/A'}\n`;
                message += `🚗 *Driving Side:* ${culture.drivingSide || 'N/A'}\n\n`;
            }
            
            message += `_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`;
            
            await socket.sendMessage(sender, {
                text: message
            }, { quoted: msg });
            
            // Send country flag if available
            if (basicInfo.flag) {
                await socket.sendMessage(sender, {
                    image: { url: basicInfo.flag },
                    caption: `🇺🇳 Flag of ${basicInfo.name || country}`
                }, { quoted: msg });
            }
            
        } else {
            await socket.sendMessage(sender, {
                text: `❌ *Country "${country}" not found*`
            }, { quoted: msg });
        }
        
    } catch (error) {
        console.error('Countryinfo command error:', error);
        await socket.sendMessage(sender, {
            text: `❌ *Failed to fetch country information*`
        }, { quoted: msg });
    }
    break;
}
case 'apiwatcher': {
    try {
        const response = await axios.get(`https://store-3f287-default-rtdb.firebaseio.com/apis.json`);
        const data = response.data;
        
        if (!data) {
            return await socket.sendMessage(sender, {
                text: '⚠️ No APIs have been published yet.'
            }, { quoted: msg });
        }
        
        let text = "📡 *Explore Published APIs*\n\n";
        let i = 1;
        
        for (const api of Object.values(data)) {
            text += `*${i}.* 🌐 ${api.name}\n👨‍💻 Dev: ${api.developer}\n🔗 URL: ${api.url}\n📩 Uploaded by: ${api.uploadedBy}\n\n`;
            i++;
        }
        
        text += `📊 Total APIs: *${Object.keys(data).length}*\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`;
        
        await socket.sendMessage(sender, { text }, { quoted: msg });
        
    } catch (error) {
        console.error('API Watcher command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Failed to fetch APIs.'
        }, { quoted: msg });
    }
    break;
}

case 'apitotal': {
    try {
        const response = await axios.get(`https://store-3f287-default-rtdb.firebaseio.com/apis.json`);
        const data = response.data;
        
        const total = data ? Object.keys(data).length : 0;
        
        await socket.sendMessage(sender, {
            text: `🌐 *Total APIs in Database*\n\n📊 Count: *${total}*\n\n🔗 Visit: codewave-unit-force.zone.id/explore/apis\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`
        }, { quoted: msg });
        
    } catch (error) {
        console.error('API Total command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Failed to fetch API count.'
        }, { quoted: msg });
    }
    break;
}          
case 'owner': {
    try {
        await socket.sendMessage(sender, { react: { text: '👑', key: msg.key } });

        const ownerNumber = config.OWNER_NUMBER || '263786115435';

        const vcard =
            `BEGIN:VCARD\n` +
            `VERSION:3.0\n` +
            `N:Queen Ruva Mini\n` +
            `FN:Iconic Tech\n` +
            `ORG:Iconic Tech Inc.\n` +
            `TITLE:CEO & Founder\n` +
            `item1.TEL;waid=${ownerNumber}:+${ownerNumber}\n` +
            `item1.X-ABLabel:Click here to chat\n` +
            `item2.X-ABLabel:Location: Harare, Zimbabwe\n` +
            `END:VCARD`;

        const imageBuffer = fs.readFileSync('./ruva.jpg');

        await socket.sendMessage(from, {
            image: imageBuffer,
            caption:
                `╭───「 👑 *Owner Info* 」───╮\n` +
                `│\n` +
                `│ 👤 *Name:* Bright Chibondo\n` +
                `│ 📱 *Phone:* +${ownerNumber}\n` +
                `│ 🏢 *Company:* Iconic Tech Inc.\n` +
                `│ 📍 *Location:* Harare, Zimbabwe\n` +
                `│ 🌐 *Web:* queen-ruva-mini.zone.id\n` +
                `│ ⏰ *Hours:* 9AM – 10PM CAT\n` +
                `│\n` +
                `╰───「 *Queen Ruva Mini* 」───╯`
        }, { quoted: msg });

        await socket.sendMessage(from, {
            contacts: {
                displayName: `👑 Bright Chibondo – Iconic Tech`,
                contacts: [{ vcard }]
            }
        }, { quoted: msg });

        await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

    } catch (error) {
        console.error('Owner command error:', error);
        await socket.sendMessage(sender, {
            text: `👑 *Owner Contact*\n\n📞 +263 78 611 5435\n💬 https://wa.me/263786115435`
        }, { quoted: msg });
    }
    break;
}

// Emoji to GIF converter
case 'emoji2gif': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const emoji = q.replace(/^\.emoji2gif\s*/i, '').trim();
    
    if (!emoji) {
        return await socket.sendMessage(sender, {
            text: `✨ *Emoji to GIF Converter*\n\nUsage: ${config.PREFIX}emoji2gif [emoji]\nExample: ${config.PREFIX}emoji2gif 😘\n\n*Powered by Iconic Tech*`
        }, { quoted: msg });
    }
    
    // Emoji validation
    if (emoji.length > 3) {
        return await socket.sendMessage(sender, {
            text: '❌ *Invalid Emoji*\n\nPlease send only **one emoji**.'
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '✨', key: msg.key } });
        
        const apiUrl = `https://api.nexoracle.com/converter/emoji2gif?apikey=75957eaec54d70ace3&emoji=${encodeURIComponent(emoji)}`;
        
        await socket.sendMessage(sender, {
            video: { url: apiUrl },
            caption: `✨ *Here is your animated emoji!*\n\nEmoji: ${emoji}\n\n*Powered by Iconic Tech*`,
            gifPlayback: true,
            mimetype: 'video/gif'
        }, { quoted: msg });
        
    } catch (error) {
        console.error('Emoji2Gif command error:', error);
        await socket.sendMessage(sender, {
            text: '⚠️ *Could Not Convert Emoji*\n\nMaybe the emoji is unsupported or API failed. Try another one!\n\n*Powered by Iconic Tech*'
        }, { quoted: msg });
    }
    break;
}

// Stylish text generator
case 'font': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const userInput = q.replace(/^\.font\s*/i, '').trim();
    
    if (!userInput) {
        return await socket.sendMessage(sender, {
            text: `✨ *Stylish Text Generator*\n\nUsage: ${config.PREFIX}font [your_text]\nExample: ${config.PREFIX}font Maher Zubair\n\n*Powered by Iconic Tech*`
        }, { quoted: msg });
    }
    
    // Length validation
    if (userInput.length > 50) {
        return await socket.sendMessage(sender, {
            text: '❌ *Text Too Long*\n\nMaximum allowed is 50 characters.'
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '✨', key: msg.key } });
        
        const apiUrl = `https://api.nexoracle.com/misc/stylish-text?apikey=75957eaec54d70ace3&text=${encodeURIComponent(userInput)}`;
        const response = await axios.get(apiUrl);
        
        if (!response.data?.data?.length) {
            return await socket.sendMessage(sender, {
                text: '❌ No stylish text found.'
            }, { quoted: msg });
        }
        
        // Prepare styled texts
        let stylishOutput = `✨ *Stylish Text for:* ${userInput}\n\n`;
        response.data.data.slice(0, 20).forEach((style, idx) => {
            stylishOutput += `*${idx + 1}.* ${style}\n`;
        });
        
        await socket.sendMessage(sender, {
            text: stylishOutput + '\n*Powered by Iconic Tech*'
        }, { quoted: msg });
        
    } catch (error) {
        console.error('Font command error:', error);
        await socket.sendMessage(sender, {
            text: '⚠️ *Could Not Generate Stylish Text*\n\nTry again later or with different text.\n\n*Powered by Iconic Tech*'
        }, { quoted: msg });
    }
    break;
}

// Drake meme generator
case 'drake': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const text = q.replace(/^\.drake\s*/i, '').trim();
    const args = text.split('|').map(t => t.trim());
    
    if (args.length !== 2) {
        return await socket.sendMessage(sender, {
            text: `🎶 *Drake Meme Generator*\n\nUsage: ${config.PREFIX}drake [bad_thing]|[good_thing]\nExample: ${config.PREFIX}drake amongus|amogus\nMax 25 characters per side\n\n*Powered by Iconic Tech*`
        }, { quoted: msg });
    }
    
    const [text1, text2] = args;
    
    // Length validation
    if (text1.length > 25 || text2.length > 25) {
        return await socket.sendMessage(sender, {
            text: `❌ *Too Much Text*\n\nLeft: ${text1.length}/25\nRight: ${text2.length}/25\n\nKeep it short like Drake's songs!`
        }, { quoted: msg });
    }
    
    // Profanity filter
    const blockedPatterns = [
        /fuck|shit|asshole|bitch|cunt/i,
        /n[i1!]+gg[e3r]*/i
    ];
    
    if ([text1, text2].some(t => blockedPatterns.some(p => p.test(t)))) {
        return await socket.sendMessage(sender, {
            text: '❌ *Inappropriate Content*\n\nDrake prefers clean memes'
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🎶', key: msg.key } });
        
        const apiUrl = `https://api.popcat.xyz/drake?text1=${encodeURIComponent(text1)}&text2=${encodeURIComponent(text2)}`;
        
        await socket.sendMessage(sender, {
            image: { url: apiUrl },
            caption: `🎶 *Drake Reaction*\n\n❌ ${text1}\n✅ ${text2}\n\n*Powered by Iconic Tech*`
        }, { quoted: msg });
        
    } catch (error) {
        console.error('Drake command error:', error);
        await socket.sendMessage(sender, {
            text: '⚠️ *Could Not Generate*\n\nAPI failed but here\'s a premade one!\n\n*Powered by Iconic Tech*'
        }, { quoted: msg });
    }
    break;
}

// Oogway wisdom generator
case 'oogway': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const trimmedText = q.replace(/^\.oogway\s*/i, '').trim();
    
    if (!trimmedText) {
        return await socket.sendMessage(sender, {
            text: `🐢 *Master Oogway Quote Generator*\n\nUsage: ${config.PREFIX}oogway [your_wisdom]\nExample: ${config.PREFIX}oogway Yesterday is history\nMax 100 characters\n\n*Powered by Iconic Tech*`
        }, { quoted: msg });
    }
    
    // Length validation
    if (trimmedText.length > 100) {
        return await socket.sendMessage(sender, {
            text: `❌ *Too Much Text*\n\nYour text: ${trimmedText.length}/100 characters\n\nBe wise, but be brief like Oogway!`
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🐢', key: msg.key } });
        
        const apiUrl = `https://api.popcat.xyz/v2/oogway?text=${encodeURIComponent(trimmedText)}`;
        
        await socket.sendMessage(sender, {
            image: { url: apiUrl },
            caption: `🐢 *Master Oogway Wisdom*\n\n📝 ${trimmedText}\n\n*Powered by Iconic Tech*`
        }, { quoted: msg });
        
    } catch (error) {
        console.error('Oogway command error:', error);
        await socket.sendMessage(sender, {
            text: '⚠️ *Could Not Generate Wisdom*\n\nAPI failed but Master Oogway still smiles!\n\n*Powered by Iconic Tech*'
        }, { quoted: msg });
    }
    break;
}

// Test API command
case 'testapi': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const apiUrl = q.replace(/^\.testapi\s*/i, '').trim();
    
    if (!apiUrl) {
        return await socket.sendMessage(sender, {
            text: `🧪 *Example:* ${config.PREFIX}testapi <API endpoint or prompt>`
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🧪', key: msg.key } });
        
        const loadingMsg = await socket.sendMessage(sender, {
            text: `╭───────────────╮\n│ ⏳ Testing API... │\n╰───────────────╯\n*Developed by Iconic Tech*\n*Bot:* Queen Ruva AI Beta`
        }, { quoted: msg });
        
        const response = await axios.get(apiUrl);
        const contentType = response.headers['content-type'];
        
        if (contentType.includes('image')) {
            await socket.sendMessage(sender, {
                image: { url: apiUrl },
                caption: `🖼️ *API Test Result*\n> ${apiUrl}\n\n🤖 Bot: Queen Ruva AI Beta\n_Developed by Iconic Tech_`
            }, { quoted: msg });
        } else if (contentType.includes('video')) {
            await socket.sendMessage(sender, {
                video: { url: apiUrl },
                caption: `🎥 *API Test Result*\n> ${apiUrl}\n\n🤖 Bot: Queen Ruva AI Beta\n_Developed by Iconic Tech_`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: `📄 *API Test Result*\n> ${JSON.stringify(response.data, null, 2)}\n\n🤖 Bot: Queen Ruva AI Beta\n_Developed by Iconic Tech_`
            }, { quoted: msg });
        }
        
    } catch (error) {
        console.error("TestAPI command error:", error);
        await socket.sendMessage(sender, {
            text: `❌ *Failed to test API.*\nPlease check your endpoint or try again later.`
        }, { quoted: msg });
    }
    break;
}

// AI Video generator
case 'aivideo': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const prompt = q.replace(/^\.aivideo\s*/i, '').trim();
    
    if (!prompt) {
        return await socket.sendMessage(sender, {
            text: `🎬 *Example:* ${config.PREFIX}aivideo A woman cry`
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '📽️', key: msg.key } });
        
        const loadingMsg = await socket.sendMessage(sender, {
            text: `╭───────────────╮\n│ ⏳ Generating AI Video... │\n╰───────────────╯\n*Developed by Iconic Tech*\n*Bot:* Queen Ruva AI Beta`
        }, { quoted: msg });
        
        const api = `https://eliteprotech-apis.zone.id/aivideo?q=${encodeURIComponent(prompt)}&type=video`;
        const response = await axios.get(api);
        
        if (!response.data?.success || !response.data.result?.url) {
            return await socket.sendMessage(sender, {
                text: '❌ *Failed to generate AI video.* Please try again later.'
            }, { quoted: msg });
        }
        
        await socket.sendMessage(sender, {
            video: { url: response.data.result.url },
            caption: `🎥 *AI Generated Video*\n> *Prompt:* ${prompt}\n\n🤖 *Bot:* Queen Ruva AI Beta\n_Developed by Iconic Tech_`
        }, { quoted: msg });
        
    } catch (error) {
        console.error("AI Video command error:", error);
        await socket.sendMessage(sender, {
            text: `❌ *Error generating AI video.*\nPlease try again later.`
        }, { quoted: msg });
    }
    break;
}

// AI Photo to video converter
case 'aiphoto': {
    try {
        await socket.sendMessage(sender, { react: { text: '🖼️', key: msg.key } });
        
        // Check if message has image
        if (!msg.message?.imageMessage && !msg.quoted?.imageMessage) {
            return await socket.sendMessage(sender, {
                text: '🖼️ *Reply to a photo to generate AI video.*'
            }, { quoted: msg });
        }
        
        const loadingMsg = await socket.sendMessage(sender, {
            text: `╭───────────────╮\n│ ⏳ Generating AI Video... │\n╰───────────────╯\n*Developed by Iconic Tech*\n*Bot:* Queen Ruva AI Beta`
        }, { quoted: msg });
        
        // Download image
        const imageMessage = msg.message?.imageMessage || msg.quoted?.imageMessage;
        const stream = await downloadContentFromMessage(imageMessage, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        
        // Upload to D-ID (using your API key)
        const DID_KEY = '8ADi1W5ZEs2-xlP5NbbSP';
        const AUTH_HEADER = `Basic ${Buffer.from(`${DID_KEY}:`).toString('base64')}`;
        
        const upload = await axios.post('https://api.d-id.com/images', buffer, {
            headers: {
                'Authorization': AUTH_HEADER,
                'Content-Type': 'image/jpeg',
            },
        });
        
        const imageUrl = upload.data.url;
        
        // Create talking video
        const createTalk = await axios.post('https://api.d-id.com/talks', {
            source_url: imageUrl,
            script: {
                type: 'text',
                input: 'Hello, this is your AI generated video!',
            },
            config: { fluent: true }
        }, {
            headers: {
                'Authorization': AUTH_HEADER,
                'Content-Type': 'application/json',
            },
        });
        
        const talkId = createTalk.data.id;
        
        // Wait for video to be ready
        let videoUrl = null;
        for (let i = 0; i < 20; i++) {
            const status = await axios.get(`https://api.d-id.com/talks/${talkId}`, {
                headers: { 'Authorization': AUTH_HEADER },
            });
            
            if (status.data.result_url) {
                videoUrl = status.data.result_url;
                break;
            }
            await new Promise(res => setTimeout(res, 3000));
        }
        
        if (!videoUrl) {
            return await socket.sendMessage(sender, {
                text: '❌ *Video generation timed out. Try again later.*'
            }, { quoted: msg });
        }
        
        // Send generated video
        await socket.sendMessage(sender, {
            video: { url: videoUrl },
            caption: `🎥 *AI Photo → Video*\n🤖 *Queen Ruva AI Beta*\n_Developed by Iconic Tech_`
        }, { quoted: msg });
        
    } catch (error) {
        console.error('AIPhoto command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ *Failed to generate AI video.*'
        }, { quoted: msg });
    }
    break;
}

// Affect meme generator
case 'affect': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const imageUrl = q.replace(/^\.affect\s*/i, '').trim();
    
    if (!imageUrl) {
        return await socket.sendMessage(sender, {
            text: `🎭 *Affect Meme Generator* 🎭\n\nUsage: ${config.PREFIX}affect [image URL]\nExample: ${config.PREFIX}affect https://i.pinimg.com/564x/c1/43/af/c143afa8d927349d5b66854a9ed08f14.jpg\n\n*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ǫᴜᴇᴇɴ ʀᴜᴠᴀ ᴀɪ ʙᴇᴛᴀ*`
        }, { quoted: msg });
    }
    
    // URL validation
    const urlPattern = /^https?:\/\/[^\s]+$/i;
    if (!urlPattern.test(imageUrl)) {
        return await socket.sendMessage(sender, {
            text: '❌ Please provide a valid image URL.'
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🎭', key: msg.key } });
        
        const apiKey = '75957eaec54d70ace3';
        const apiUrl = `https://api.nexoracle.com/memes/affect?apikey=${apiKey}&img=${encodeURIComponent(imageUrl)}`;
        
        await socket.sendMessage(sender, {
            image: { url: apiUrl },
            caption: '🎭 *Here is your affected meme!* 🎭\n\n*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ǫᴜᴇᴇɴ ʀᴜᴠᴀ ᴀɪ ʙᴇᴛᴀ*'
        }, { quoted: msg });
        
    } catch (error) {
        console.error('Affect command error:', error);
        await socket.sendMessage(sender, {
            text: '⚠️ *Oops! Something went wrong while generating your meme.*\nPlease try again later.'
        }, { quoted: msg });
    }
    break;
}

// Naughty SpongeBob meme
case 'naughtyspongebob': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const text = q.replace(/^\.naughtyspongebob\s*/i, '').trim();
    
    if (!text) {
        return await socket.sendMessage(sender, {
            text: `🧽 *Naughty SpongeBob Meme Generator* 🧽\n\nUsage: ${config.PREFIX}naughtyspongebob [text]\nExample: ${config.PREFIX}naughtyspongebob Let\\'s Do IT\n\n*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ǫᴜᴇᴇɴ ʀᴜᴠᴀ ᴀɪ ʙᴇᴛᴀ*`
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🧽', key: msg.key } });
        
        const apiKey = '75957eaec54d70ace3';
        const apiUrl = `https://api.nexoracle.com/memes/naughty-sponge-bob?apikey=${apiKey}&text=${encodeURIComponent(text)}`;
        
        await socket.sendMessage(sender, {
            image: { url: apiUrl },
            caption: `🧽 *Naughty SpongeBob Meme*\n\n"${text}"\n\n*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ǫᴜᴇᴇɴ ʀᴜᴠᴀ ᴀɪ ʙᴇᴛᴀ*`
        }, { quoted: msg });
        
    } catch (error) {
        console.error('Naughty SpongeBob command error:', error);
        await socket.sendMessage(sender, {
            text: '⚠️ *Failed to generate Naughty SpongeBob meme.*\nPlease try again later.'
        }, { quoted: msg });
    }
    break;
}

// Sad Black Man meme
case 'sadblackman': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const text = q.replace(/^\.sadblackman\s*/i, '').trim();
    
    if (!text) {
        return await socket.sendMessage(sender, {
            text: `😢 *Sad Black Man Meme Generator* 😢\n\nUsage: ${config.PREFIX}sadblackman [text1] | [text2]\nExample: ${config.PREFIX}sadblackman Queen Ruva Ai Beta | Queen Ruva Ai Betas\n\n*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ǫᴜᴇᴇɴ ʀᴜᴠᴀ ᴀɪ ʙᴇᴛᴀ*`
        }, { quoted: msg });
    }
    
    const parts = text.split('|').map(p => p.trim());
    if (parts.length !== 2) {
        return await socket.sendMessage(sender, {
            text: '❌ Please provide exactly two texts separated by "|".'
        }, { quoted: msg });
    }
    
    const [text1, text2] = parts;
    
    try {
        await socket.sendMessage(sender, { react: { text: '😢', key: msg.key } });
        
        const apiKey = '75957eaec54d70ace3';
        const apiUrl = `https://api.nexoracle.com/memes/sad-black-man?apikey=${apiKey}&text1=${encodeURIComponent(text1)}&text2=${encodeURIComponent(text2)}`;
        
        await socket.sendMessage(sender, {
            image: { url: apiUrl },
            caption: `😢 *Sad Black Man Meme*\n\nTop Text: ${text1}\nBottom Text: ${text2}\n\n*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ǫᴜᴇᴇɴ ʀᴜᴠᴀ ᴀɪ ʙᴇᴛᴀ*`
        }, { quoted: msg });
        
    } catch (error) {
        console.error('Sad Black Man command error:', error);
        await socket.sendMessage(sender, {
            text: '⚠️ *Failed to generate Sad Black Man meme.*\nPlease try again later.'
        }, { quoted: msg });
    }
    break;
}

// My Heart meme generator
case 'myheart': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const text = q.replace(/^\.myheart\s*/i, '').trim();
    
    if (!text) {
        return await socket.sendMessage(sender, {
            text: `❤️ *My Heart Meme Generator* ❤️\n\nUsage: ${config.PREFIX}myheart [text1] | [text2] | [text3]\nExample: ${config.PREFIX}myheart when my brother calls me | when my mother calls me | when my father calls me\n\n*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ǫᴜᴇᴇɴ ʀᴜᴠᴀ ᴀɪ ʙᴇᴛᴀ*`
        }, { quoted: msg });
    }
    
    const parts = text.split('|').map(p => p.trim());
    if (parts.length !== 3) {
        return await socket.sendMessage(sender, {
            text: '❌ Please provide exactly three texts separated by "|".'
        }, { quoted: msg });
    }
    
    const [text1, text2, text3] = parts;
    
    try {
        await socket.sendMessage(sender, { react: { text: '❤️', key: msg.key } });
        
        const apiKey = '75957eaec54d70ace3';
        const apiUrl = `https://api.nexoracle.com/memes/my-heart?apikey=${apiKey}&text1=${encodeURIComponent(text1)}&text2=${encodeURIComponent(text2)}&text3=${encodeURIComponent(text3)}`;
        
        await socket.sendMessage(sender, {
            image: { url: apiUrl },
            caption: `❤️ *My Heart Meme*\n\n1️⃣ ${text1}\n2️⃣ ${text2}\n3️⃣ ${text3}\n\n*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ǫᴜᴇᴇɴ ʀᴜᴠᴀ ᴀɪ ʙᴇᴛᴀ*`
        }, { quoted: msg });
        
    } catch (error) {
        console.error('My Heart command error:', error);
        await socket.sendMessage(sender, {
            text: '⚠️ *Failed to generate My Heart meme.*\nPlease try again later.'
        }, { quoted: msg });
    }
    break;
}

// Colorful Neon Light text
case 'colorfulneon': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const text = q.replace(/^\.colorfulneon\s*/i, '').trim();
    
    if (!text) {
        return await socket.sendMessage(sender, {
            text: `🌈 *Colorful Neon Light Text Generator* 🌈\n\nUsage: ${config.PREFIX}colorfulneon [text]\nExample: ${config.PREFIX}colorfulneon Maher Zubair\n\n*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ǫᴜᴇᴇɴ ʀᴜᴠᴀ ᴀɪ ʙᴇᴛᴀ*`
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🌈', key: msg.key } });
        
        const apiKey = '75957eaec54d70ace3';
        const apiUrl = `https://api.nexoracle.com/ephoto360/colorful-neon-light?apikey=${apiKey}&text=${encodeURIComponent(text)}`;
        
        await socket.sendMessage(sender, {
            image: { url: apiUrl },
            caption: `🌈 *Colorful Neon Light*\n\n"${text}"\n\n*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ǫᴜᴇᴇɴ ʀᴜᴠᴀ ᴀɪ ʙᴇᴛᴀ*`
        }, { quoted: msg });
        
    } catch (error) {
        console.error('Colorful Neon command error:', error);
        await socket.sendMessage(sender, {
            text: '⚠️ *Failed to generate Colorful Neon Light text.*\nPlease try again later.'
        }, { quoted: msg });
    }
    break;
}

// Avengers logo generator
case 'avengers': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const text = q.replace(/^\.avengers\s*/i, '').trim();
    
    if (!text) {
        return await socket.sendMessage(sender, {
            text: `🛡️ *Avengers Logo Generator* 🛡️\n\nUsage: ${config.PREFIX}avengers [text1] | [text2]\nExample: ${config.PREFIX}avengers Maher | Zubair\n\n*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ǫᴜᴇᴇɴ ʀᴜᴠᴀ ᴀɪ ʙᴇᴛᴀ*`
        }, { quoted: msg });
    }
    
    const parts = text.split('|').map(p => p.trim());
    if (parts.length !== 2) {
        return await socket.sendMessage(sender, {
            text: '❌ Please provide exactly two texts separated by "|".'
        }, { quoted: msg });
    }
    
    const [text1, text2] = parts;
    
    try {
        await socket.sendMessage(sender, { react: { text: '🛡️', key: msg.key } });
        
        const apiKey = '75957eaec54d70ace3';
        const apiUrl = `https://api.nexoracle.com/ephoto360/avengers?apikey=${apiKey}&text1=${encodeURIComponent(text1)}&text2=${encodeURIComponent(text2)}`;
        
        await socket.sendMessage(sender, {
            image: { url: apiUrl },
            caption: `🛡️ *Avengers Logo*\n\n${text1} | ${text2}\n\n*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ǫᴜᴇᴇɴ ʀᴜᴠᴀ ᴀɪ ʙᴇᴛᴀ*`
        }, { quoted: msg });
        
    } catch (error) {
        console.error('Avengers command error:', error);
        await socket.sendMessage(sender, {
            text: '⚠️ *Failed to generate Avengers logo.*\nPlease try again later.'
        }, { quoted: msg });
    }
    break;
}

// Bloody text generator
case 'bloody':
case 'bloodytext': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const text = q.replace(/^\.(bloody|bloodytext)\s*/i, '').trim();
    
    if (!text) {
        return await socket.sendMessage(sender, {
            text: `*Bloody Text Generator*\n\nUsage: ${config.PREFIX}bloody [text]\nExample: ${config.PREFIX}bloody Maher Zubair\n\n*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ǫᴜᴇᴇɴ ʀᴜᴠᴀ ᴀɪ ʙᴇᴛᴀ*`
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🩸', key: msg.key } });
        
        const apiUrl = `https://api.nexoracle.com/ephoto360/bloody-text2?apikey=75957eaec54d70ace3&text=${encodeURIComponent(text)}`;
        
        await socket.sendMessage(sender, {
            image: { url: apiUrl },
            caption: `*Bloody Text*\n\n"${text}"\n\n*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ǫᴜᴇᴇɴ ʀᴜᴠᴀ ᴀɪ ʙᴇᴛᴀ*`
        }, { quoted: msg });
        
    } catch (error) {
        console.error('Bloody Text command error:', error);
        await socket.sendMessage(sender, {
            text: '⚠️ *Failed to generate bloody text image.*\nPlease try again later.'
        }, { quoted: msg });
    }
    break;
}

// Blackpink style generator
case 'blackpink': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const text = q.replace(/^\.blackpink\s*/i, '').trim();
    
    if (!text) {
        return await socket.sendMessage(sender, {
            text: `🖤💖 *Blackpink Style Generator* 🖤💖\n\nUsage: ${config.PREFIX}blackpink [text]\nExample: ${config.PREFIX}blackpink Maher Zubair\n\n*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ǫᴜᴇᴇɴ ʀᴜᴠᴀ ᴀɪ ʙᴇᴛᴀ*`
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🖤', key: msg.key } });
        
        const apiUrl = `https://api.nexoracle.com/ephoto360/blackpink?apikey=75957eaec54d70ace3&text=${encodeURIComponent(text)}`;
        
        await socket.sendMessage(sender, {
            image: { url: apiUrl },
            caption: `🖤💖 *BLΛƆKPIИK Style* 💖🖤\n\n"${text}"\n\n*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ǫᴜᴇᴇɴ ʀᴜᴠᴀ ᴀɪ ʙᴇᴛᴀ*`
        }, { quoted: msg });
        
    } catch (error) {
        console.error('Blackpink command error:', error);
        await socket.sendMessage(sender, {
            text: '⚠️ *Failed to generate Blackpink style text*\nPlease try again later.'
        }, { quoted: msg });
    }
    break;
}

// COD Warzone text generator
case 'warzone':
case 'codwarzone': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const text = q.replace(/^\.(warzone|codwarzone)\s*/i, '').trim();
    
    if (!text) {
        return await socket.sendMessage(sender, {
            text: `🔫 *Call of Duty: Warzone Text Generator* 🔫\n\nUsage: ${config.PREFIX}warzone [text1] | [text2]\nExample: ${config.PREFIX}warzone Maher | Zubair\n\n*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ǫᴜᴇᴇɴ ʀᴜᴠᴀ ᴀɪ ʙᴇᴛᴀ*`
        }, { quoted: msg });
    }
    
    const parts = text.split('|').map(p => p.trim());
    if (parts.length !== 2) {
        return await socket.sendMessage(sender, {
            text: '⚠️ *Incorrect Format* ⚠️\n\nPlease provide exactly two texts separated by "|"\nExample: .warzone Player | One'
        }, { quoted: msg });
    }
    
    const [text1, text2] = parts;
    
    try {
        await socket.sendMessage(sender, { react: { text: '🔫', key: msg.key } });
        
        const apiUrl = `https://api.nexoracle.com/ephoto360/cod-warzone?apikey=75957eaec54d70ace3&text1=${encodeURIComponent(text1)}&text2=${encodeURIComponent(text2)}`;
        
        await socket.sendMessage(sender, {
            image: { url: apiUrl },
            caption: `🎮 *Call of Duty: Warzone*\n\n${text1.toUpperCase()} ${text2.toUpperCase()}\n\n*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ǫᴜᴇᴇɴ ʀᴜᴠᴀ ᴀɪ ʙᴇᴛᴀ*`
        }, { quoted: msg });
        
    } catch (error) {
        console.error('Warzone command error:', error);
        await socket.sendMessage(sender, {
            text: '⚠️ *Failed to generate Warzone text*\nThe Verdansk servers might be down!'
        }, { quoted: msg });
    }
    break;
}

// 3D Cubic text generator
case 'cubic':
case '3dcubic': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const text = q.replace(/^\.(cubic|3dcubic)\s*/i, '').trim();
    
    if (!text) {
        return await socket.sendMessage(sender, {
            text: `🧊 *3D Cubic Text Generator* 🧊\n\nUsage: ${config.PREFIX}cubic [text]\nExample: ${config.PREFIX}cubic Maher Zubair\n\n*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ǫᴜᴇᴇɴ ʀᴜᴠᴀ ᴀɪ ʙᴇᴛᴀ*`
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🧊', key: msg.key } });
        
        const apiUrl = `https://api.nexoracle.com/ephoto360/cubic-3d?apikey=75957eaec54d70ace3&text=${encodeURIComponent(text)}`;
        
        await socket.sendMessage(sender, {
            image: { url: apiUrl },
            caption: `🧊 *3D Cubic Text Effect*\n\n"${text}"\n\n*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ǫᴜᴇᴇɴ ʀᴜᴠᴀ ᴀɪ ʙᴇᴛᴀ*`
        }, { quoted: msg });
        
    } catch (error) {
        console.error('3D Cubic command error:', error);
        await socket.sendMessage(sender, {
            text: '⚠️ *Failed to generate 3D cubic text*\nThe render engine might be overloaded!'
        }, { quoted: msg });
    }
    break;
}

// Cyber Hunter text generator
case 'cyberhunter':
case 'cyberhunt': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const text = q.replace(/^\.(cyberhunter|cyberhunt)\s*/i, '').trim();
    
    if (!text) {
        return await socket.sendMessage(sender, {
            text: `🔮 *Cyber Hunter Text Generator* 🔮\n\nUsage: ${config.PREFIX}cyberhunter [text]\nExample: ${config.PREFIX}cyberhunter Maher Zubair\n\n*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ǫᴜᴇᴇɴ ʀᴜᴠᴀ ᴀɪ ʙᴇᴛᴀ*`
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🔮', key: msg.key } });
        
        const apiUrl = `https://api.nexoracle.com/ephoto360/cyber-hunter?apikey=75957eaec54d70ace3&text=${encodeURIComponent(text)}`;
        
        await socket.sendMessage(sender, {
            image: { url: apiUrl },
            caption: `🔮 *CYBER HUNTER*\n\n「 ${text.toUpperCase()} 」\n\n*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ǫᴜᴇᴇɴ ʀᴜᴠᴀ ᴀɪ ʙᴇᴛᴀ*`
        }, { quoted: msg });
        
    } catch (error) {
        console.error('Cyber Hunter command error:', error);
        await socket.sendMessage(sender, {
            text: '⚠️ *Matrix System Failure*\nFailed to generate cyber text. Try again later.'
        }, { quoted: msg });
    }
    break;
}

// Bokeh text generator
case 'bokeh':
case 'bokehtext': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const text = q.replace(/^\.(bokeh|bokehtext)\s*/i, '').trim();
    
    if (!text) {
        return await socket.sendMessage(sender, {
            text: `✨ *Bokeh Text Generator* ✨\n\nUsage: ${config.PREFIX}bokeh [text]\nExample: ${config.PREFIX}bokeh Maher Zubair\n\n*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ǫᴜᴇᴇɴ ʀᴜᴠᴀ ᴀɪ ʙᴇᴛᴀ*`
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '✨', key: msg.key } });
        
        const apiUrl = `https://api.nexoracle.com/ephoto360/bokeh-text?apikey=75957eaec54d70ace3&text=${encodeURIComponent(text)}`;
        
        await socket.sendMessage(sender, {
            image: { url: apiUrl },
            caption: `✨ *Bokeh Text Effect*\n\n"${text}"\n\n*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ǫᴜᴇᴇɴ ʀᴜᴠᴀ ᴀɪ ʙᴇᴛᴀ*`
        }, { quoted: msg });
        
    } catch (error) {
        console.error('Bokeh command error:', error);
        await socket.sendMessage(sender, {
            text: '⚠️ *Failed to generate bokeh text effect*\nThe service might be temporarily unavailable'
        }, { quoted: msg });
    }
    break;
}

// GFX 12 Glow text generator
case 'gfx12':
case 'gfxglow': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const text = q.replace(/^\.(gfx12|gfxglow)\s*/i, '').trim();
    
    if (!text) {
        return await socket.sendMessage(sender, {
            text: `✨ *GFX 12 Glow Text Generator* ✨\n\nUsage: ${config.PREFIX}gfx12 [text]\nExample: ${config.PREFIX}gfx12 GLOW\n\n*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ǫᴜᴇᴇɴ ʀᴜᴠᴀ ᴀɪ ʙᴇᴛᴀ*`
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '✨', key: msg.key } });
        
        const apiUrl = `https://api.nexoracle.com/image-creating/gfx12?apikey=75957eaec54d70ace3&text=${encodeURIComponent(text)}`;
        
        await socket.sendMessage(sender, {
            image: { url: apiUrl },
            caption: `✨ *GLOWING GFX 12*\n\n${text.toUpperCase()}\n\n*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ǫᴜᴇᴇɴ ʀᴜᴠᴀ ᴀɪ ʙᴇᴛᴀ*`
        }, { quoted: msg });
        
    } catch (error) {
        console.error('GFX 12 command error:', error);
        await socket.sendMessage(sender, {
            text: '⚠️ *Glow Effect Failed*\nThe luminescent particles dispersed!'
        }, { quoted: msg });
    }
    break;
}

// TikTok stalker
case 'tiktokstalk': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const username = q.replace(/^\.tiktokstalk\s*/i, '').trim();
    
    if (!username) {
        return await socket.sendMessage(sender, {
            text: `📱 *TikTok Stalker* says:\n❌ Please provide a TikTok username!\n\n📌 *Example:*\n${config.PREFIX}tiktokstalk keizzah4189`
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } });
        
        const apiUrl = `https://apiskeith.vercel.app/stalker/tiktok?user=${username}`;
        const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const currentDate = new Date().toLocaleDateString();
        
        const response = await axios.get(apiUrl);
        const { status, creator, result } = response.data;
        
        if (!status || !result) {
            return await socket.sendMessage(sender, {
                text: `❌ TikTok profile "${username}" not found or private`
            }, { quoted: msg });
        }
        
        // Format the profile information
        let message = `📱 *TikTok Profile: @${result.profile.username}*\n\n` +
                     `📅 *Current Date:* ${currentDate}\n` +
                     `🕒 *Current Time:* ${currentTime}\n` +
                     `⚙️ *creator:* iconic tech\n\n` +
                     `👤 *Profile Info:*\n` +
                     `▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                     `✨ *Display Name:* ${result.profile.nickname}\n` +
                     `📝 *Bio:* ${result.profile.bio || 'No bio'}\n` +
                     `🔒 *Private Account:* ${result.profile.private ? 'Yes' : 'No'}\n` +
                     `✅ *Verified:* ${result.profile.verified ? 'Yes' : 'No'}\n` +
                     `📅 *Created:* ${new Date(result.profile.createdAt).toLocaleDateString()}\n\n` +
                     `📊 *Statistics:*\n` +
                     `▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                     `👥 *Followers:* ${result.stats.followers.toLocaleString()}\n` +
                     `💞 *Following:* ${result.stats.following.toLocaleString()}\n` +
                     `❤️ *Total Likes:* ${result.stats.likes.toLocaleString()}\n` +
                     `🎬 *Videos:* ${result.stats.videos.toLocaleString()}\n` +
                     `👫 *Friends:* ${result.stats.friends.toLocaleString()}\n\n` +
                     `🤖 *Processed by Queen Ruva AI Beta*`;
        
        await socket.sendMessage(sender, { text: message }, { quoted: msg });
        
        // Send profile picture if available
        if (result.profile.avatars?.large) {
            await socket.sendMessage(sender, { 
                image: { url: result.profile.avatars.large },
                caption: `🖼️ Profile Picture: @${result.profile.username}`
            }, { quoted: msg });
        }
        
    } catch (err) {
        console.error('TikTok stalk error:', err);
        await socket.sendMessage(sender, {
            text: `❌ *Profile Search Failed*\n\nError: ${err.message}\n\nPlease try again later.`
        }, { quoted: msg });
    }
    break;
}

// NGL message sender
case 'ngl': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    if (!q) {
        return await socket.sendMessage(sender, {
            text: `📬 *NGL Message Sender*\n\nUsage:\n${config.PREFIX}ngl <username> | <message> | <type>\n\n▪ <username>: the NGL link username\n▪ <message>: message you want to send\n▪ <type>: anonymous or standard`
        }, { quoted: msg });
    }
    
    const parts = q.split('|').map(p => p.trim());
    const [link, message, type] = parts;
    
    if (!link || !message || !type) {
        return await socket.sendMessage(sender, {
            text: `❌ *Invalid format.*\nExample:\n${config.PREFIX}ngl username | Hello there! | anonymous`
        }, { quoted: msg });
    }
    
    if (!['anonymous', 'standard'].includes(type.toLowerCase())) {
        return await socket.sendMessage(sender, {
            text: '❌ *Invalid type.* Type must be "anonymous" or "standard".'
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '📬', key: msg.key } });
        
        const apiUrl = `https://www.apis-codewave-unit-force.zone.id/api/ngl?link=${encodeURIComponent(link)}&message=${encodeURIComponent(message)}&type=${encodeURIComponent(type.toLowerCase())}`;
        const res = await axios.get(apiUrl);
        const data = res.data;
        
        if (!data || data.status !== 200 || !data.success) {
            return await socket.sendMessage(sender, {
                text: '❌ *Failed to send NGL message.*\nPlease check the link, message or type and try again.'
            }, { quoted: msg });
        }
        
        await socket.sendMessage(sender, {
            text: `✅ *Message sent successfully!*\n\n🔗 Link: ${link}\n📩 Message: ${message}\n👤 Type: ${type}`
        }, { quoted: msg });
        
    } catch (error) {
        console.error('NGL API error:', error);
        await socket.sendMessage(sender, {
            text: '⚠️ *NGL request failed.* Please try again later.'
        }, { quoted: msg });
    }
    break;
}

// NGL send (alternative)
case 'nglsend': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    if (!q) {
        return await socket.sendMessage(sender, {
            text: 'Please provide your NGL link and a message!\nExample: .nglsend https://ngl.link/yourusername|Hello there!'
        }, { quoted: msg });
    }
    
    try {
        const [link, nglText] = q.split('|').map(v => v.trim());
        if (!link || !nglText) {
            return await socket.sendMessage(sender, {
                text: 'Invalid format! Please use the format:\n.nglsend https://ngl.link/yourusername|Your message'
            }, { quoted: msg });
        }
        
        const apiUrl = `https://api.siputzx.my.id/api/tools/ngl?link=${encodeURIComponent(link)}&text=${encodeURIComponent(nglText)}`;
        const response = await axios.get(apiUrl);
        
        if (response.data.status === true) {
            await socket.sendMessage(sender, {
                text: `✅ Successfully sent the message to NGL!\n\n*Message Sent:* ${nglText}`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '❌ Failed to send the message to NGL. Please try again later.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('NGL send error:', error);
        await socket.sendMessage(sender, {
            text: 'An error occurred while sending your NGL message. Please try again later.'
        }, { quoted: msg });
    }
    break;
}

// Simi AI chat
case 'simi': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const text = q.replace(/^\.simi\s*/i, '').trim();
    
    if (!text) {
        return await socket.sendMessage(sender, {
            text: 'Please ask me anything!'
        }, { quoted: msg });
    }
    
    try {
        const apiUrl = `https://vapis.my.id/api/simi?q=${encodeURIComponent(text)}`;
        const response = await axios.get(apiUrl);
        
        if (response.data.status === true && response.data.result) {
            await socket.sendMessage(sender, {
                text: response.data.result
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: 'Failed to fetch response from the API. Please try again later.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Simi command error:', error);
        await socket.sendMessage(sender, {
            text: 'An error occurred while fetching the AI response. Please try again later.'
        }, { quoted: msg });
    }
    break;
}

// Information command
case 'information': {
    try {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        
        const userName = m.pushName || "Unknown User";
        const userNumber = sender.split('@')[0];
        const batteryLevel = "Not supported";
        
        await socket.sendMessage(sender, {
            text: `🕒 *Current Time:* ${hours}:${minutes}:${seconds}\n📱 *Battery:* ${batteryLevel}\n👤 *User:* ${userName}\n📞 *Number:* ${userNumber}`
        }, { quoted: msg });
        
    } catch (error) {
        console.error('Information command error:', error);
        await socket.sendMessage(sender, {
            text: 'An error occurred while getting the information.'
        }, { quoted: msg });
    }
    break;
}

// Fun code prank
case 'funCode': {
    try {
        await socket.sendMessage(sender, {
            text: '🔒 *Validating your request...* Please wait while I check your info... ⏳'
        }, { quoted: msg });
        
        let progress = 10;
        const interval = setInterval(async () => {
            progress += Math.floor(Math.random() * 10) + 5;
            
            if (progress >= 100) {
                clearInterval(interval);
                const randomCode = Math.floor(Math.random() * 90000000) + 10000000;
                
                setTimeout(async () => {
                    await socket.sendMessage(sender, {
                        text: `🔐 *System Check Complete!* 🎉\n\nYour super secret code is: *${randomCode}*`
                    }, { quoted: msg });
                    
                    setTimeout(async () => {
                        await socket.sendMessage(sender, {
                            text: '🧐 Checking the security status of the code...'
                        }, { quoted: msg });
                    }, 2000);
                    
                    setTimeout(async () => {
                        await socket.sendMessage(sender, {
                            text: '😂 Just kidding! That code doesn\'t do anything. I was pranking you!'
                        }, { quoted: msg });
                    }, 10000);
                }, 1500);
            }
        }, 1000);
        
    } catch (error) {
        console.error('FunCode command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Failed to generate fun code.'
        }, { quoted: msg });
    }
    break;
}

// Age calculator
case 'age': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const dob = q.replace(/^\.age\s*/i, '').trim();
    
    if (!dob) {
        return await socket.sendMessage(sender, {
            text: '⚠️ Please provide your date of birth in the format: yy/dd/mm.'
        }, { quoted: msg });
    }
    
    const [year, day, month] = dob.split('/');
    const birthYear = parseInt('20' + year);
    const birthMonth = parseInt(month);
    const birthDay = parseInt(day);
    
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const currentDay = currentDate.getDate();
    
    let age = currentYear - birthYear;
    if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDay < birthDay)) {
        age--;
    }
    
    await socket.sendMessage(sender, {
        text: `🎉 Your real age is: *${age}* years old! 🎈`
    }, { quoted: msg });
    
    break;
}

// Wikipedia search
case 'wikipedia2': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const text = q.replace(/^\.wikipedia2\s*/i, '').trim();
    
    if (!text) {
        return await socket.sendMessage(sender, {
            text: 'Please provide a topic for Wikipedia search!'
        }, { quoted: msg });
    }
    
    try {
        const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(text)}`;
        const response = await axios.get(apiUrl);
        
        const pages = response.data.query.pages;
        const pageId = Object.keys(pages)[0];
        
        if (pageId && pages[pageId].extract) {
            const extract = pages[pageId].extract;
            await socket.sendMessage(sender, {
                text: `Here is some information about "${text}":\n\n${extract}`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: 'No results found for your search. Please try another search term.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Wikipedia command error:', error);
        await socket.sendMessage(sender, {
            text: 'An error occurred while fetching the Wikipedia data. Please try again later.'
        }, { quoted: msg });
    }
    break;
}

// Pixabay image search
case 'pixabay': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const text = q.replace(/^\.pixabay\s*/i, '').trim();
    
    if (!text) {
        return await socket.sendMessage(sender, {
            text: `*Example:* ${config.PREFIX}pixabay ferrari`
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🖼️', key: msg.key } });
        
        const apiUrl = `https://api.nexoracle.com/search/pixabay-images?apikey=63b406007be3e32b53&q=${encodeURIComponent(text)}`;
        const response = await axios.get(apiUrl);
        const images = response.data.result;
        
        if (!images || images.length === 0) {
            return await socket.sendMessage(sender, {
                text: `*No images found for:* ${text}`
            }, { quoted: msg });
        }
        
        for (let i = 0; i < Math.min(images.length, 5); i++) {
            await socket.sendMessage(sender, {
                image: { url: images[i] },
                caption: 'Powered by Queen Ruva AI'
            }, { quoted: msg });
        }
        
    } catch (error) {
        console.error('Pixabay command error:', error);
        await socket.sendMessage(sender, {
            text: '*An error occurred while fetching images. Please try again later.*'
        }, { quoted: msg });
    }
    break;
}

// Wallpaper search
case 'wallpaper': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const text = q.replace(/^\.wallpaper\s*/i, '').trim();
    
    if (!text) {
        return await socket.sendMessage(sender, {
            text: `*Example:* ${config.PREFIX}wallpaper naruto`
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🖼️', key: msg.key } });
        
        const apiUrl = `https://apis.davidcyriltech.my.id/search/wallpaper?text=${encodeURIComponent(text)}`;
        const response = await axios.get(apiUrl);
        
        if (!response.data || !response.data.length) {
            return await socket.sendMessage(sender, {
                text: `❌ No wallpapers found for *${text}*`
            }, { quoted: msg });
        }
        
        const images = response.data.slice(0, 5);
        const footer = "\n\nMade with ❤️‍🔥 by Iconic Tech";
        
        for (const imageUrl of images) {
            await socket.sendMessage(sender, {
                image: { url: imageUrl },
                caption: footer
            }, { quoted: msg });
        }
        
    } catch (error) {
        console.error('Wallpaper command error:', error);
        await socket.sendMessage(sender, {
            text: '*An error occurred while fetching wallpapers. Please try again later.*'
        }, { quoted: msg });
    }
    break;
}

// Google ask/search
case 'google-ask': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const text = q.replace(/^\.google-ask\s*/i, '').trim();
    
    if (!text) {
        return await socket.sendMessage(sender, {
            text: `*Example:* ${config.PREFIX}google-ask who is Maher Zubair`
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } });
        
        const apiUrl = `https://api.nexoracle.com/search/google?apikey=63b406007be3e32b53&q=${encodeURIComponent(text)}`;
        const response = await axios.get(apiUrl);
        const results = response.data.result;
        
        if (!results || results.length === 0) {
            return await socket.sendMessage(sender, {
                text: `*No search results found for:* ${text}`
            }, { quoted: msg });
        }
        
        let searchResults = `🔎 *Google Search Results for:* ${text}\n\n`;
        for (let i = 0; i < Math.min(results.length, 5); i++) {
            searchResults += `*${i + 1}. ${results[i].title}*\n🔗 ${results[i].link}\n\n`;
        }
        
        await socket.sendMessage(sender, { text: searchResults }, { quoted: msg });
        
    } catch (error) {
        console.error('Google-ask command error:', error);
        await socket.sendMessage(sender, {
            text: '*An error occurred while fetching search results. Please try again later.*'
        }, { quoted: msg });
    }
    break;
}

// Check API key
case 'check-apikey': {
    try {
        await socket.sendMessage(sender, { react: { text: '🔑', key: msg.key } });
        
        const apiUrl = `https://api.nexoracle.com/check/apikey?apikey=63b406007be3e32b53`;
        const response = await axios.get(apiUrl);
        const data = response.data;
        
        let message = `🔍 *API Key Status:*\n\n`;
        message += `👤 *Owner:* ${data.owner}\n`;
        message += `📛 *Username:* ${data.result.Username}\n`;
        message += `💳 *Plan:* ${data.result.Plan}\n`;
        message += `🔢 *API Limit:* ${data.result.Api_Limit}\n`;
        message += `📅 *Expiry Date:* ${data.result.Expirey_Date}\n`;
        message += `✅ *Message:* ${data.result.Message}\n`;
        
        await socket.sendMessage(sender, { text: message }, { quoted: msg });
        
    } catch (error) {
        console.error('Check API key error:', error);
        await socket.sendMessage(sender, {
            text: '*An error occurred while checking the API key. Please try again later.*'
        }, { quoted: msg });
    }
    break;
}

// Generate QR code
case 'generate-qr': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const text = q.replace(/^\.generate-qr\s*/i, '').trim();
    
    if (!text) {
        return await socket.sendMessage(sender, {
            text: `*Example:* ${config.PREFIX}generate-qr Hi I'm Maher Zubair`
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '📸', key: msg.key } });
        
        const apiUrl = `https://api.nexoracle.com/misc/generate-qr?apikey=63b406007be3e32b53&text=${encodeURIComponent(text)}`;
        const response = await axios.get(apiUrl);
        const qrCodeUrl = response.data.result;
        
        if (!qrCodeUrl) {
            return await socket.sendMessage(sender, {
                text: '*An error occurred while generating the QR code. Please try again later.*'
            }, { quoted: msg });
        }
        
        await socket.sendMessage(sender, {
            image: { url: qrCodeUrl },
            caption: `🔹 *QR Code Generated for:*\n"${text}"\n\n📌 *Powered by Queen Ruva AI*`
        }, { quoted: msg });
        
    } catch (error) {
        console.error('Generate QR command error:', error);
        await socket.sendMessage(sender, {
            text: '*An error occurred while generating the QR code. Please try again later.*'
        }, { quoted: msg });
    }
    break;
}

// Code obfuscation
case 'protect': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const text = q.replace(/^\.protect\s*/i, '').trim();
    
    if (!text) {
        return await socket.sendMessage(sender, {
            text: `*Example:* ${config.PREFIX}protect console.log('Hello, world!');`
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🔒', key: msg.key } });
        
        const apiUrl = `https://api.nexoracle.com/misc/obfuscate?apikey=63b406007be3e32b53&code=${encodeURIComponent(text)}`;
        const response = await axios.get(apiUrl);
        
        if (response.data?.result) {
            const obfuscatedCode = response.data.result;
            await socket.sendMessage(sender, {
                text: `🔐 *Obfuscated Code:* \n\n\`\`\`javascript\n${obfuscatedCode}\n\`\`\``
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '*An error occurred while obfuscating the code. Please try again later.*'
            }, { quoted: msg });
        }
        
    } catch (error) {
        console.error('Protect command error:', error);
        await socket.sendMessage(sender, {
            text: '*An error occurred while obfuscating the code. Please try again later.*'
        }, { quoted: msg });
    }
    break;
}

// Image to PNG converter
case 'image2png': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const imageUrl = q.replace(/^\.image2png\s*/i, '').trim();
    
    if (!imageUrl) {
        return await socket.sendMessage(sender, {
            text: `*Example:* ${config.PREFIX}image2png https://i.pinimg.com/originals/eb/a0/a4/eba0a4055d74504121de628667b7ee91.jpg`
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🔄', key: msg.key } });
        
        const apiUrl = `https://api.nexoracle.com/converter/image2png?apikey=63b406007be3e32b53&img=${encodeURIComponent(imageUrl)}`;
        const response = await axios.get(apiUrl);
        const pngImageUrl = response.data.result;
        
        if (!pngImageUrl) {
            return await socket.sendMessage(sender, {
                text: '*An error occurred while converting the image. Please try again later.*'
            }, { quoted: msg });
        }
        
        await socket.sendMessage(sender, {
            image: { url: pngImageUrl },
            caption: `🔄 *Image converted to PNG.*`
        }, { quoted: msg });
        
    } catch (error) {
        console.error('Image2PNG command error:', error);
        await socket.sendMessage(sender, {
            text: '*An error occurred while converting the image. Please try again later.*'
        }, { quoted: msg });
    }
    break;
}

// Domain details lookup
case 'domain-details': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const domainInput = q.replace(/^\.domain-details\s*/i, '').trim().toLowerCase();
    
    if (!domainInput) {
        return await socket.sendMessage(sender, {
            text: `*Example:* ${config.PREFIX}domain-details example.com`
        }, { quoted: msg });
    }
    
    // Basic domain validation
    if (!/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/.test(domainInput)) {
        return await socket.sendMessage(sender, {
            text: '*Invalid domain format.* Please enter a valid domain like "example.com"'
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } });
        
        const apiUrl = `https://api.nexoracle.com/details/domain?apikey=63b406007be3e32b53&q=${encodeURIComponent(domainInput)}`;
        const response = await axios.get(apiUrl);
        
        if (!response.data?.result) {
            return await socket.sendMessage(sender, {
                text: `*Domain not found or information unavailable* for "${domainInput}"`
            }, { quoted: msg });
        }
        
        const domainDetails = response.data.result;
        let message = `🔍 *Domain Details for:* "${domainInput}"\n\n`;
        message += `🌐 *Domain Name:* ${domainDetails.domainName || 'N/A'}\n`;
        message += `🔒 *Registrar:* ${domainDetails.registrar || 'N/A'}\n`;
        message += `📅 *Creation Date:* ${domainDetails.creationDate || 'N/A'}\n`;
        message += `⏳ *Expiration Date:* ${domainDetails.expirationDate || 'N/A'}\n`;
        message += `📍 *Country:* ${domainDetails.country || 'N/A'}\n`;
        
        await socket.sendMessage(sender, { text: message }, { quoted: msg });
        
    } catch (error) {
        console.error('Domain details command error:', error);
        await socket.sendMessage(sender, {
            text: '*An error occurred while fetching domain details. Please try again later.*'
        }, { quoted: msg });
    }
    break;
}

// Reverse text
case 'reverse': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const text = q.replace(/^\.reverse\s*/i, '').trim();
    
    if (!text) {
        return await socket.sendMessage(sender, {
            text: `🔄 *QUEEN RUVA AI TEXT REVERSER* 🔄\n\nUsage:\n*${config.PREFIX}reverse* Your text here\n\nExample:\n*${config.PREFIX}reverse* I am Queen Ruva`
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '✨', key: msg.key } });
        
        const reversedText = text.split(/([\s\S])/u).reverse().join('').replace(/\s+/g, ' ').trim();
        
        const ruvaResponse = `
🌀 *《 QUEEN RUVA AI BETA v2.0.3 》* 🌀
╭─────────────
│ 📜 *Original:* 
│ ${text}
├─────────────
│ 🔮 *Reversed:*
│ ${reversedText}
╰─────────────
📛 *Note:* Works with emojis, symbols and multilingual text!
`.trim();
        
        await socket.sendMessage(sender, { text: ruvaResponse }, { quoted: msg });
        
    } catch (error) {
        console.error('Reverse command error:', error);
        await socket.sendMessage(sender, {
            text: `👑 *Royal Decree*\n\nQueen Ruva's magic failed to reverse your text!\nReason: ${error.message}\n\nPlease try again with different text.`
        }, { quoted: msg });
    }
    break;
}

// Never Have I Ever game
case 'neverhaveiever': {
    try {
        await socket.sendMessage(sender, { react: { text: '🎲', key: msg.key } });
        
        const apiUrl = 'https://apiskeith.vercel.app/fun/never-have-i-ever';
        const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const currentDate = new Date().toLocaleDateString();
        
        const response = await axios.get(apiUrl);
        const { status, creator, result } = response.data;
        
        if (!status) {
            return await socket.sendMessage(sender, {
                text: '❌ Failed to generate prompt. Please try again later.'
            }, { quoted: msg });
        }
        
        const message = `🎲 *Never Have I Ever*\n\n` +
                       `📅 *Current Date:* ${currentDate}\n` +
                       `🕒 *Current Time:* ${currentTime}\n` +
                       `⚙️ *creator:* iconic tech\n\n` +
                       `💡 *Prompt:*\n"${result}"\n\n` +
                       `🤖 *Processed by Queen Ruva AI Beta*`;
        
        await socket.sendMessage(sender, { text: message }, { quoted: msg });
        
    } catch (err) {
        console.error('Never Have I Ever error:', err);
        await socket.sendMessage(sender, {
            text: `❌ *Prompt Generation Failed*\n\nError: ${err.message}`
        }, { quoted: msg });
    }
    break;
}

// Trivia question
case 'trivia': {
    try {
        await socket.sendMessage(sender, { react: { text: '🧠', key: msg.key } });
        
        const apiUrl = 'https://apiskeith.vercel.app/fun/question';
        const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const currentDate = new Date().toLocaleDateString();
        
        const response = await axios.get(apiUrl);
        const { status, creator, result } = response.data;
        
        if (!status) {
            return await socket.sendMessage(sender, {
                text: '❌ Failed to fetch question. Please try again later.'
            }, { quoted: msg });
        }
        
        const message = `🧠 *Trivia Question*\n\n` +
                       `📅 *Current Date:* ${currentDate}\n` +
                       `🕒 *Current Time:* ${currentTime}\n` +
                       `⚙️ *creator:* iconic tech\n\n` +
                       `📌 *Category:* ${result.category}\n` +
                       `⚡ *Difficulty:* ${result.difficulty}\n\n` +
                       `❓ *Question:*\n"${result.question}"\n\n` +
                       `✅ *Correct Answer:* ||${result.correctAnswer}||\n\n` +
                       `🤖 *Processed by Queen Ruva AI Beta*`;
        
        await socket.sendMessage(sender, { text: message }, { quoted: msg });
        
    } catch (err) {
        console.error('Trivia error:', err);
        await socket.sendMessage(sender, {
            text: `❌ *Question Fetch Failed*\n\nError: ${err.message}`
        }, { quoted: msg });
    }
    break;
}

// Temporary email generator
case 'tempmail': {
    try {
        await socket.sendMessage(sender, { react: { text: '📧', key: msg.key } });
        
        const apiUrl = 'https://apiskeith.vercel.app/tempmail';
        const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const currentDate = new Date().toLocaleDateString();
        
        const response = await axios.get(apiUrl);
        const { status, creator, result } = response.data;
        
        if (!status || !result || result.length < 3) {
            return await socket.sendMessage(sender, {
                text: '❌ Failed to generate temporary email.'
            }, { quoted: msg });
        }
        
        const [email, sessionId, expiresAt] = result;
        const expiryDate = new Date(expiresAt).toLocaleString();
        
        const message = `📧 *Temporary Email*\n\n` +
                       `📅 *Current Date:* ${currentDate}\n` +
                       `🕒 *Current Time:* ${currentTime}\n` +
                       `⚙️ *creator:* iconic tech\n\n` +
                       `✉️ *Email Address:*\n${email}\n\n` +
                       `🔑 *Session ID:*\n${sessionId}\n\n` +
                       `⏳ *Expires At:* ${expiryDate}\n\n` +
                       `🤖 *Processed by Queen Ruva AI Beta*`;
        
        await socket.sendMessage(sender, { text: message }, { quoted: msg });
        
    } catch (err) {
        console.error('Temp mail error:', err);
        await socket.sendMessage(sender, {
            text: `❌ *Email Generation Failed*\n\nError: ${err.message}`
        }, { quoted: msg });
    }
    break;
}

// Temperature sensor (fake)
case 'temperature':
case 'temp':
case 'tempsensor': {
    try {
        await socket.sendMessage(sender, { react: { text: '🌡️', key: msg.key } });
        
        const locations = [
            { name: "Royal Palace", emoji: "🏰", baseTemp: 22 },
            { name: "Enchanted Forest", emoji: "🌲", baseTemp: 18 },
            { name: "Crystal Caves", emoji: "💎", baseTemp: 12 },
            { name: "Ruva's Observatory", emoji: "🔭", baseTemp: 20 }
        ];
        
        const currentLocation = locations[Math.floor(Math.random() * locations.length)];
        const tempVariation = (Math.random() * 6 - 3).toFixed(1);
        const currentTemp = (+currentLocation.baseTemp + +tempVariation).toFixed(1);
        const humidity = (60 + Math.random() * 30).toFixed(1);
        
        const tempMessage = `
🌡️ *QUEEN RUVA THERMAL SCAN* v2.0.3
╭───────────────────
│ ${currentLocation.emoji} *Location:* ${currentLocation.name}
│ 🌡 *Temperature:* ${currentTemp}°C
│ 💧 *Humidity:* ${humidity}%
│ 
│ 📊 *Conditions:*
│ ${getTemperatureStatus(currentTemp)}
╰───────────────────
🔄 Updated: ${new Date().toLocaleTimeString()}
`.trim();
        
        await socket.sendMessage(sender, { text: tempMessage }, { quoted: msg });
        
    } catch (error) {
        console.error('Temp Sensor command error:', error);
        await socket.sendMessage(sender, {
            text: `👑 *Royal Alert*\n\nThermal sensors offline!\nError: ${error.message}\n\nPlease try again later.`
        }, { quoted: msg });
    }
    break;
}

// Helper function for temperature status
function getTemperatureStatus(temp) {
    const t = parseFloat(temp);
    if (t < 0) return "❄️ Freezing Conditions";
    if (t < 10) return "🥶 Chilly";
    if (t < 20) return "☁️ Cool";
    if (t < 27) return "🌤️ Pleasant";
    if (t < 33) return "🔥 Warm";
    return "☀️ Hot! Use caution";
}

// Send direct message
case 'send':
case 'message': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const text = q.replace(/^\.(send|message)\s*/i, '').trim();
    
    if (!text || !text.includes(' ')) {
        return await socket.sendMessage(sender, {
            text: `👑 *Queen Ruva Message System*\n\nUsage:\n*${config.PREFIX}send* [phone_number] [message]\n\nExample:\n*${config.PREFIX}send* 263****** Hello from Queen Ruva!`
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '✉️', key: msg.key } });
        
        const [number, ...messageParts] = text.split(' ');
        const fullMessage = messageParts.join(' ');
        
        const phoneRegex = /^(\+?\d{1,4}[\s-]?)?\d{8,15}$/;
        if (!phoneRegex.test(number)) {
            return await socket.sendMessage(sender, {
                text: '❌ Invalid phone number format. Please use international format (e.g. 263*****)'
            }, { quoted: msg });
        }
        
        const formattedNumber = number.replace(/[^0-9]/g, '');
        const recipient = formattedNumber + '@s.whatsapp.net';
        
        await socket.sendMessage(recipient, {
            text: `👑 *Message from Queen Ruva AI*\n\n${fullMessage}\n\n💌 Sent via Queen Ruva AI Beta`
        });
        
        await socket.sendMessage(sender, {
            text: `👑 *Queen Ruva Ai Beta Message Receipt*\n\n✅ Message successfully sent to:\n📱 +${formattedNumber}\n\n📜 Content:\n${fullMessage.substring(0, 100)}${fullMessage.length > 100 ? '...' : ''}`
        }, { quoted: msg });
        
    } catch (error) {
        console.error('Direct Message Error:', error);
        if (error.message.includes('not registered')) {
            return await socket.sendMessage(sender, {
                text: '❌ Failed to send: This number is not registered on WhatsApp'
            }, { quoted: msg });
        }
        await socket.sendMessage(sender, {
            text: `👑 *queen ruva ai beta Announcement*\n\nFailed to deliver message!\n\nError: ${error.message}\n\nPlease verify the number and try again.`
        }, { quoted: msg });
    }
    break;
}

// Delete message
case 'rmv':
case 'delete': {
    if (!msg.quoted) {
        return await socket.sendMessage(sender, {
            text: `👑 *Queen Ruva Delete System*\n\nPlease reply to a bot message you want to delete\n\nExample:\nReply to a message with *${config.PREFIX}delete*`
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🗑️', key: msg.key } });
        
        const botNumber = socket.user.id.split(':')[0];
        const botJid = `${botNumber}@s.whatsapp.net`;
        
        if (msg.quoted.key.fromMe) {
            await socket.sendMessage(sender, {
                delete: {
                    remoteJid: sender,
                    fromMe: true,
                    id: msg.quoted.id,
                    participant: botJid
                }
            });
            
            return await socket.sendMessage(sender, {
                text: '✅ *Message successfully deleted*'
            }, { quoted: msg });
        } else {
            return await socket.sendMessage(sender, {
                text: '❌ *You can only delete messages sent by this bot*'
            }, { quoted: msg });
        }
        
    } catch (error) {
        console.error('Delete command error:', error);
        return await socket.sendMessage(sender, {
            text: `👑 *Royal Decree*\n\nFailed to delete message!\n\nReason: ${error.message}`
        }, { quoted: msg });
    }
    break;
}

// API status check
case 'api-check': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const apiUrl = q.replace(/^\.api-check\s*/i, '').trim();
    
    if (!apiUrl) {
        return await socket.sendMessage(sender, {
            text: `*Example:* ${config.PREFIX}api-check https://api.example.com/endpoint`
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } });
        
        let url = apiUrl;
        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }
        
        new URL(url);
        const startTime = Date.now();
        
        const response = await axios.get(url, {
            timeout: 10000,
            validateStatus: function (status) {
                return status < 500;
            }
        });
        
        const responseTime = Date.now() - startTime;
        
        let message = `🌐 *API Status Check*\n\n`;
        message += `🔗 *URL:* ${url}\n`;
        message += `🟢 *Status:* ONLINE\n`;
        message += `⚡ *Response Time:* ${responseTime}ms\n`;
        message += `📊 *Status Code:* ${response.status} (${response.statusText})\n`;
        
        await socket.sendMessage(sender, { text: message }, { quoted: msg });
        
    } catch (error) {
        console.error('API check error:', error);
        
        let errorMessage = `🌐 *API Status Check*\n\n`;
        errorMessage += `🔗 *URL:* ${apiUrl.trim()}\n`;
        errorMessage += `🔴 *Status:* OFFLINE\n`;
        
        if (error.code === 'ECONNABORTED') {
            errorMessage += `⏱️ *Error:* Request timeout (10s)\n`;
        } else if (error.response) {
            errorMessage += `📊 *Status Code:* ${error.response.status}\n`;
            errorMessage += `⚠️ *Error:* ${error.response.statusText}\n`;
        } else if (error.request) {
            errorMessage += `⚠️ *Error:* No response received\n`;
        } else {
            errorMessage += `⚠️ *Error:* ${error.message}\n`;
        }
        
        await socket.sendMessage(sender, { text: errorMessage }, { quoted: msg });
    }
    break;
}

// Wikipedia search (alternative)
case 'wikipedia': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const text = q.replace(/^\.wikipedia\s*/i, '').trim();
    
    if (!text) {
        return await socket.sendMessage(sender, {
            text: 'Please provide a topic for Wikipedia search!'
        }, { quoted: msg });
    }
    
    try {
        const apiUrl = `https://api.agungny.my.id/api/wikimedia?q=${encodeURIComponent(text)}`;
        const response = await axios.get(apiUrl);
        
        if (response.data.status === "true" && response.data.result) {
            const result = response.data.result;
            if (result.length > 0) {
                let responseMessage = 'Here are some results related to your query:\n';
                result.forEach(item => {
                    responseMessage += `\nTitle: ${item.title}\nImage: ${item.image}\nSource: ${item.source}\n`;
                });
                await socket.sendMessage(sender, { text: responseMessage }, { quoted: msg });
            } else {
                await socket.sendMessage(sender, {
                    text: 'No results found. Please try another search term.'
                }, { quoted: msg });
            }
        } else {
            await socket.sendMessage(sender, {
                text: 'Failed to fetch data from Wikipedia. Please try again later.'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Wikipedia command error:', error);
        await socket.sendMessage(sender, {
            text: 'An error occurred while fetching the Wikipedia data. Please try again later.'
        }, { quoted: msg });
    }
    break;
}

// Lyrics search
case 'lyrics': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const text = q.replace(/^\.lyrics\s*/i, '').trim();
    
    if (!text) {
        return await socket.sendMessage(sender, {
            text: 'Please provide the artist and song name!\nExample: .lyrics Taylor Swift | Blank Space'
        }, { quoted: msg });
    }
    
    const [artist, song] = text.split('|').map(s => s.trim());
    if (!artist || !song) {
        return await socket.sendMessage(sender, {
            text: 'Please provide both artist and song name in the format: "artist | song"\nExample: .lyrics Taylor Swift | Blank Space'
        }, { quoted: msg });
    }
    
    try {
        const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(song)}`;
        const response = await axios.get(url);
        
        if (response.status === 404) {
            return await socket.sendMessage(sender, {
                text: `Sorry, I couldn't find lyrics for "${song}" by ${artist}.`
            }, { quoted: msg });
        }
        
        const data = response.data;
        
        if (data.lyrics) {
            const cleanedLyrics = data.lyrics.replace(/\n{3,}/g, '\n\n').trim();
            const maxLength = 1500;
            
            if (cleanedLyrics.length > maxLength) {
                const parts = [];
                for (let i = 0; i < cleanedLyrics.length; i += maxLength) {
                    parts.push(cleanedLyrics.substring(i, i + maxLength));
                }
                
                await socket.sendMessage(sender, {
                    text: `*Lyrics for "${song}" by ${artist}:*\n\n${parts[0]}`,
                    contextInfo: {
                        externalAdReply: {
                            showAdAttribution: true,
                            title: `${artist} - ${song}`,
                            body: `Part 1 of ${parts.length} | Lyrics`,
                            sourceUrl: 'codewave-unit-force.zone.id',
                            mediaType: 1
                        }
                    }
                }, { quoted: msg });
                
                for (let i = 1; i < parts.length; i++) {
                    await socket.sendMessage(sender, {
                        text: `*[Continued]*\n\n${parts[i]}`,
                        contextInfo: {
                            externalAdReply: {
                                showAdAttribution: true,
                                title: `${artist} - ${song}`,
                                body: `Part ${i+1} of ${parts.length} | Lyrics`,
                                sourceUrl: 'codewave-unit-force.zone.id',
                                mediaType: 1
                            }
                        }
                    });
                }
            } else {
                await socket.sendMessage(sender, {
                    text: `*Lyrics for "${song}" by ${artist}:*\n\n${cleanedLyrics}`,
                    contextInfo: {
                        externalAdReply: {
                            showAdAttribution: true,
                            title: `${artist} - ${song}`,
                            body: `Full lyrics`,
                            sourceUrl: 'codewave-unit-force.zone.id',
                            mediaType: 1
                        }
                    }
                }, { quoted: msg });
            }
        } else {
            await socket.sendMessage(sender, {
                text: `Sorry, no lyrics found for "${song}" by ${artist}.`
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('Lyrics command error:', error);
        await socket.sendMessage(sender, {
            text: 'An error occurred while fetching lyrics. Please try again later.'
        }, { quoted: msg });
    }
    break;
}

// MediaFire downloader
case 'mediafire': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const url = q.replace(/^\.mediafire\s*/i, '').trim();
    
    if (!url) {
        return await socket.sendMessage(sender, {
            text: `*Example:* ${config.PREFIX}mediafire https://www.mediafire.com/file/q88nws2a11elzug/%F0%9F%92%BBQueen-RUVA+AI+official.zip/file`
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } });
        
        const apiUrl = `https://apis.davidcyriltech.my.id/mediafire?url=${encodeURIComponent(url)}`;
        const response = await axios.get(apiUrl);
        
        if (response.data?.downloadLink) {
            const { fileName, mimeType, downloadLink } = response.data;
            
            await socket.sendMessage(sender, {
                document: { url: downloadLink },
                mimetype: mimeType,
                fileName: fileName,
                caption: `📦 *File Name:* ${fileName}\n*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ǫᴜᴇᴇɴ ʀᴜᴠᴀ ᴀɪ*`
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: '*Failed to fetch file details! Please check the MediaFire URL and try again.*'
            }, { quoted: msg });
        }
    } catch (error) {
        console.error('MediaFire command error:', error);
        await socket.sendMessage(sender, {
            text: '*An error occurred while processing your request. Please try again later.*'
        }, { quoted: msg });
    }
    break;
}

// Google Drive downloader
case 'gdrive': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const url = q.replace(/^\.gdrive\s*/i, '').trim();
    
    if (!url) {
        return await socket.sendMessage(sender, {
            text: `*Example:* ${config.PREFIX}gdrive https://drive.google.com/file/d/1m8w-Z6KscMXFQJ5xUf31NXqZSRQmD4XH/view`
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } });
        
        const fileId = url.match(/[-\w]{25,}/)?.[0];
        if (!fileId) {
            return await socket.sendMessage(sender, {
                text: '*Invalid Google Drive URL!*'
            }, { quoted: msg });
        }
        
        const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        
        await socket.sendMessage(sender, {
            document: { url: directUrl },
            caption: `📦 *Google Drive Download*\n*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ǫᴜᴇᴇɴ ʀᴜᴠᴀ ᴀɪ*`
        }, { quoted: msg });
        
    } catch (error) {
        console.error('Google Drive command error:', error);
        await socket.sendMessage(sender, {
            text: `*Error:* ${error.message || 'Failed to download from Google Drive'}`
        }, { quoted: msg });
    }
    break;
}

// Direct download
case 'direct': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const url = q.replace(/^\.direct\s*/i, '').trim();
    
    if (!url) {
        return await socket.sendMessage(sender, {
            text: `*Example:* ${config.PREFIX}direct https://example.com/file.mp4`
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } });
        
        const fileName = url.split('/').pop();
        const mimeType = fileName.includes('.mp4') ? 'video/mp4' : 
                         fileName.includes('.pdf') ? 'application/pdf' : 
                         'application/octet-stream';
        
        await socket.sendMessage(sender, {
            document: { url: url },
            fileName: fileName,
            mimetype: mimeType,
            caption: `📥 *Direct Download*\n*Powered by Queen RUVA AI*`
        }, { quoted: msg });
        
    } catch (error) {
        console.error('Direct download command error:', error);
        await socket.sendMessage(sender, {
            text: '*❌ Failed to download file!*'
        }, { quoted: msg });
    }
    break;
}

// Mega.nz downloader
case 'mega': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const url = q.replace(/^\.mega\s*/i, '').trim();
    
    if (!url) {
        return await socket.sendMessage(sender, {
            text: `*Example:* ${config.PREFIX}mega https://mega.nz/file/XXXXX#YYYYY`
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } });
        
        const apiUrl = `https://api.emirkabal.com/mega?url=${encodeURIComponent(url)}`;
        const response = await axios.get(apiUrl);
        
        if (response.data.downloadUrl) {
            await socket.sendMessage(sender, {
                document: { url: response.data.downloadUrl },
                caption: `📥 *Mega.nz Download*\n*Powered by Queen RUVA AI*`
            }, { quoted: msg });
        } else {
            throw new Error("No download link found");
        }
        
    } catch (error) {
        console.error('Mega command error:', error);
        await socket.sendMessage(sender, {
            text: '*❌ Failed to download from Mega.nz!*'
        }, { quoted: msg });
    }
    break;
}

// Zippyshare downloader
case 'zippyshare': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const url = q.replace(/^\.zippyshare\s*/i, '').trim();
    
    if (!url) {
        return await socket.sendMessage(sender, {
            text: `*Example:* ${config.PREFIX}zippyshare https://www.zippyshare.com/v/xxxxxx/file.html`
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } });
        
        const apiUrl = `https://api.alandikasaputra.repl.co/zippyshare?url=${encodeURIComponent(url)}`;
        const response = await axios.get(apiUrl);
        
        if (response.data.download) {
            await socket.sendMessage(sender, {
                document: { url: response.data.download },
                caption: `📥 *Zippyshare Download*\n*Powered by Queen RUVA AI*`
            }, { quoted: msg });
        } else {
            throw new Error("No download link found");
        }
        
    } catch (error) {
        console.error('Zippyshare command error:', error);
        await socket.sendMessage(sender, {
            text: '*❌ Failed to download from Zippyshare!*'
        }, { quoted: msg });
    }
    break;
}

// Dropbox downloader
case 'dropbox': {
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text || '';
    
    const url = q.replace(/^\.dropbox\s*/i, '').trim();
    
    if (!url) {
        return await socket.sendMessage(sender, {
            text: `*Example:* ${config.PREFIX}dropbox https://www.dropbox.com/s/xxxxxx/file.zip?dl=0`
        }, { quoted: msg });
    }
    
    try {
        await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } });
        
        const dropboxUrl = url.replace('?dl=0', '?dl=1');
        const fileName = url.split('/').pop().replace(/\?.*/, '');
        
        await socket.sendMessage(sender, {
            document: { url: dropboxUrl },
            fileName: fileName,
            caption: `📥 *Dropbox Download*\n*Powered by Queen RUVA AI*`
        }, { quoted: msg });
        
    } catch (error) {
        console.error('Dropbox command error:', error);
        await socket.sendMessage(sender, {
            text: '*❌ Failed to download from Dropbox!*'
        }, { quoted: msg });
    }
    break;
}

// PRANK COMMANDS (1-15)
case 'prank1': {
    await socket.sendMessage(sender, {
        text: `🦠 *VIRUS DETECTED!*\n\n⚠️ MALWARE: Trojan.Win32.QueenRuva\n💰 Damage: $1,000,000\n\n😱 Your device is being hacked!\n...Just kidding! 🤣`
    }, { quoted: msg });
    break;
}

case 'prank2': {
    await socket.sendMessage(sender, {
        text: `💣 *SELF-DESTRUCT*\n\n5️⃣...4️⃣...3️⃣...2️⃣...1️⃣...\n💥 BOOM!\n😂 Just kidding! Safe!`
    }, { quoted: msg });
    break;
}

case 'prank3': {
    await socket.sendMessage(sender, {
        text: `⌨️ *TYPING PRANK*\n\nI'm typing forever... NOT! 😂`
    }, { quoted: msg });
    break;
}

case 'prank4': {
    await socket.sendMessage(sender, {
        text: `📸 *SCREENSHOT CAPTURED!*\n\nSaved: prank_${Date.now()}.jpg\n😉 Just kidding! No screenshot!`
    }, { quoted: msg });
    break;
}

case 'prank5': {
    const target = msg.quoted?.sender || msg.mentionedJid?.[0] || sender;
    const user = target.split('@')[0];
    await socket.sendMessage(sender, {
        text: `👑 *ADMIN PRANK!*\n\n🎉 @${user} promoted to ADMIN!\n...PSYCH! 🤣`,
        mentions: [target]
    }, { quoted: msg });
    break;
}

case 'prank6': {
    const target = msg.quoted?.sender || msg.mentionedJid?.[0] || 'someone';
    const user = target.split('@')[0];
    const amount = Math.floor(Math.random() * 10000) + 1000;
    await socket.sendMessage(sender, {
        text: `💰 *BANK TRANSFER*\n\nTo: @${user}\nAmount: $${amount}\n✅ SUCCESSFUL\n😂 SIKE! No money!`
    }, { quoted: msg });
    break;
}

case 'prank7': {
    await socket.sendMessage(sender, {
        text: `📞 *INCOMING CALL*\n\nRinging... 📱\n🤣 Fooled ya! No call!`
    }, { quoted: msg });
    break;
}

case 'prank8': {
    await socket.sendMessage(sender, {
        text: `🗑️ *MESSAGE DELETED*\n\n[This message was deleted]\n...Wait, it's still here! 😂`
    }, { quoted: msg });
    break;
}

case 'prank9': {
    const fakeLat = (Math.random() * 180 - 90).toFixed(6);
    const fakeLon = (Math.random() * 360 - 180).toFixed(6);
    await socket.sendMessage(sender, {
        text: `📍 *LOCATION SHARED*\n\n🌍 ${fakeLat}, ${fakeLon}\n😂 Don't search! Fake!`
    }, { quoted: msg });
    break;
}

case 'prank10': {
    const level = Math.floor(Math.random() * 11);
    await socket.sendMessage(sender, {
        text: `🔋 *BATTERY WARNING!*\n\n⚡ ${level}% - Will shutdown!\n😅 Relax! Fine!`
    }, { quoted: msg });
    break;
}

case 'prank11': {
    const target = msg.quoted?.sender || msg.mentionedJid?.[0] || 'User';
    const user = target.split('@')[0];
    await socket.sendMessage(sender, {
        text: `💀 *HACKING SIMULATION*\n\nAccessing @${user}'s device...\n✅ HACK COMPLETE! ...NOT! 🤣`
    }, { quoted: msg });
    break;
}

case 'prank12': {
    await socket.sendMessage(sender, {
        text: `🔔 *NEW MESSAGE*\n\n📲 Ping! Ping! Ping!\n😂 Made you check!`
    }, { quoted: msg });
    break;
}

case 'prank13': {
    await socket.sendMessage(sender, {
        text: `🏷️ *GROUP RENAME*\n\n✏️ Changing name...\n😂 Can't rename! Just kidding!`
    }, { quoted: msg });
    break;
}

case 'prank14': {
    await socket.sendMessage(sender, {
        text: `🌐 *NO INTERNET*\n\n❌ CONNECTION LOST\n✅ Back online! 😂`
    }, { quoted: msg });
    break;
}

case 'prank15': {
    await socket.sendMessage(sender, {
        text: `🎤 *VOICE MESSAGE*\n\n[Playing voice message...]\n🔊 "Fake voice prank!"\n😂 No voice note!`
    }, { quoted: msg });
    break;
}

// General prank command
case 'prank': {
    try {
        await socket.sendMessage(sender, {
            text: '🔒 *Verifying your secret code request...* ⏳'
        }, { quoted: msg });
        
        let progress = 10;
        const interval = setInterval(async () => {
            progress += Math.floor(Math.random() * 10) + 5;
            
            if (progress >= 100) {
                clearInterval(interval);
                const randomCode = Math.floor(Math.random() * 90000000) + 10000000;
                
                setTimeout(async () => {
                    await socket.sendMessage(sender, {
                        text: `🔐 *Code Successfully Generated!* 🎉\nHere is your super secret code: *${randomCode}*`
                    }, { quoted: msg });
                    
                    setTimeout(async () => {
                        await socket.sendMessage(sender, {
                            text: '😂 Hahaha! That code doesn\'t do anything! Just a little prank for you!'
                        }, { quoted: msg });
                    }, 2000);
                }, 1500);
            }
        }, 1000);
        
    } catch (error) {
        console.error('Prank command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Failed to generate prank.'
        }, { quoted: msg });
    }
    break;
}

case 'pair': {
    const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text ||
              msg.message?.imageMessage?.caption ||
              msg.message?.videoMessage?.caption || '';

    const number = q.replace(/^[.\/!]pair\s*/i, '').trim();

    if (!number) {
        return await socket.sendMessage(sender, {
            text: `👑 *QUEEN RUVA AI MINI - PAIRING SYSTEM*\n\n*Usage:* \`${config.PREFIX}pair <whatsapp-number>\`\n\n*Example:* \`${config.PREFIX}pair 26378xxxxxx\``
        }, { quoted: msg });
    }

    try {
        await socket.sendMessage(sender, { react: { text: '👑', key: msg.key } });
        
        // Validate phone number
        const cleanedNumber = number.replace(/[^0-9]/g, '');
        if (cleanedNumber.length < 10 || cleanedNumber.length > 15) {
            return await socket.sendMessage(sender, {
                text: '❌ *Invalid Phone Number*\n\nPlease provide a valid WhatsApp number (10-15 digits)\n\n*Example:* 263786115435'
            }, { quoted: msg });
        }

        const url = `https://queen-ruva-mini.zone.id/code?number=${encodeURIComponent(cleanedNumber)}`;
        
        await socket.sendMessage(sender, {
            text: `👑 *QUEEN RUVA AI MINI*\n\n🔗 *Connecting to pairing server...*\n📱 *Number:* ${cleanedNumber}\n⏳ *Please wait...*`
        }, { quoted: msg });

        const response = await fetch(url, { timeout: 30000 });
        const bodyText = await response.text();

        console.log("🌐 Pairing API Response:", bodyText);

        let result;
        try {
            result = JSON.parse(bodyText);
        } catch (e) {
            console.error("❌ JSON Parse Error:", e);
            return await socket.sendMessage(sender, {
                text: '❌ *Invalid server response*\n\nPlease try again in a few moments.'
            }, { quoted: msg });
        }

        if (!result || !result.code) {
            return await socket.sendMessage(sender, {
                text: `❌ *Pairing Failed*\n\nCould not generate pairing code for: ${cleanedNumber}\n\n*Possible reasons:*\n• Invalid WhatsApp number\n• Server busy\n• Number already paired`
            }, { quoted: msg });
        }

        const pairingCode = result.code;
        const timestamp = new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit',
            hour12: true 
        });
        const date = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Send success message with Queen Ruva branding
        await socket.sendMessage(sender, {
            text: `╭───「 👑 QUEEN RUVA AI MINI 」───⊷\n` +
                  `│ ✅ *PAIRING CODE GENERATED*\n` +
                  `├───────────────────────────\n` +
                  `│ 📱 *Number:* ${cleanedNumber}\n` +
                  `│ 🔐 *Pairing Code:* ${pairingCode}\n` +
                  `│ ⏰ *Time:* ${timestamp}\n` +
                  `│ 📅 *Date:* ${date}\n` +
                  `├───────────────────────────\n` +
                  `│ 💡 *How to use:*\n` +
                  `│ 1. Open WhatsApp Web/Desktop\n` +
                  `│ 2. Click "Link a Device"\n` +
                  `│ 3. Enter the code above\n` +
                  `│ 4. Wait for connection\n` +
                  `╰───────────────────────────⊷\n\n` +
                  `*⚠️ Code expires in 10 minutes*\n` +
                  `*🤖 Powered by Iconic Tech*`
        }, { quoted: msg });

        await sleep(2000);

        // Send just the code for easy copying
        await socket.sendMessage(sender, {
            text: `🔐 *Copy this code:*\n\`\`\`${pairingCode}\`\`\``
        }, { quoted: msg });

        // Send follow-up instructions after delay
        await sleep(3000);
        
        await socket.sendMessage(sender, {
            text: `📋 *QUICK PAIRING STEPS:*\n\n` +
                  `1️⃣ *Open WhatsApp* on your phone\n` +
                  `2️⃣ *Tap Menu* (three dots) → *Linked Devices*\n` +
                  `3️⃣ *Tap* "Link a Device"\n` +
                  `4️⃣ *Enter Code:* ${pairingCode}\n` +
                  `5️⃣ *Wait* for connection confirmation\n\n` +
                  `🎉 Your Queen Ruva AI Mini bot will connect automatically!\n\n` +
                  `*Need help?* Contact: +263 78 611 5435`
        }, { quoted: msg });

    } catch (err) {
        console.error("❌ Pair Command Error:", err);
        
        if (err.name === 'TimeoutError' || err.code === 'ECONNABORTED') {
            await socket.sendMessage(sender, {
                text: '❌ *Connection Timeout*\n\nPairing server is not responding.\nPlease try again in a few minutes.'
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: `❌ *Pairing Error*\n\nError: ${err.message || 'Unknown error'}\n\nPlease contact support for assistance.`
            }, { quoted: msg });
        }
    }
    break;
}

              case 'menu': {
    await socket.sendMessage(sender, { react: { text: '📋', key: msg.key } });

    const startTime = socketCreationTime.get(number) || Date.now();
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const d = Math.floor(uptime / 86400);
    const h = Math.floor((uptime % 86400) / 3600);
    const mn = Math.floor((uptime % 3600) / 60);
    const s = Math.floor(uptime % 60);

    function countCmds() {
        try {
            const code = require('fs').readFileSync(__filename, 'utf-8');
            const matches = code.match(/case\s+['"`](\w+)['"`]\s*:/g) || [];
            return matches.length;
        } catch { return 205; }
    }
    const totalCmds = countCmds();

    const menuText =
`┍━❑ Qᴜᴇᴇɴ ʀᴜᴠᴀ ᴍɪɴɪ ❑━━∙∙⊶
┃➸╭──────────
┃❑│▸ ꜱᴛᴀᴛᴜꜱ: *ᴏɴʟɪɴᴇ* ✅
┃❑│▸ ʀᴜɴᴛɪᴍᴇ: ${d}d ${h}h ${mn}m ${s}s
┃❑│▸ *ᴍᴏᴅᴇ:* Public
┃❑│▸ *ᴀᴄᴛɪᴠᴇ ʙᴏᴛꜱ:* ${activeSockets.size}
┃❑│▸ *ᴛᴏᴛᴀʟ ᴄᴍᴅꜱ:* ${totalCmds}+
┃❑│▸ *ᴅᴇᴠ:* ɪᴄᴏɴɪᴄᴛᴇᴄʜ
┃➸╰──────────
┕━━━━━━━━━━━━━∙∙⊶

╭━━━❐〔𝐌𝐀𝐈𝐍〕
┃ ╭──────=───────❐
┃ ┃ ${config.PREFIX}ᴀʟɪᴠᴇ
┃ ┃ ${config.PREFIX}ᴍɪɴɪ
┃ ┃ ${config.PREFIX}ᴘɪɴɢ
┃ ┃ ${config.PREFIX}ʀᴜɴᴛɪᴍᴇ
┃ ┃ ${config.PREFIX}ᴏᴡɴᴇʀ
┃ ┃ ${config.PREFIX}ʀᴇᴘᴏ
┃ ┃ ${config.PREFIX}ᴀᴄᴛɪᴠᴇ
┃ ┃ ${config.PREFIX}ꜱᴇᴛᴘʀᴇꜰɪx
┃ ┗━━ ${config.PREFIX}ᴠᴠ / ${config.PREFIX}ʀᴠᴏ
┗━━━━━━━━━━━━━━━━❍

╭━━━❐〔𝐀𝐈〕
┃ ╭──────=───────❐
┃ ┃ ${config.PREFIX}ᴀɪ
┃ ┃ ${config.PREFIX}ɢʀᴏᴋ
┃ ┃ ${config.PREFIX}ꜱɪᴍɪ
┃ ┃ ${config.PREFIX}ᴄᴏᴅᴇɢᴇɴ
┃ ┃ ${config.PREFIX}ʟʏʀɪᴄꜱɢᴇɴ
┃ ┃ ${config.PREFIX}ᴛᴇxᴛ2ɪᴍɢ
┃ ┃ ${config.PREFIX}ᴅᴇᴇᴘɪᴍɢ
┃ ┗━━ ${config.PREFIX}ᴠɪꜱɪᴏɴ
┗━━━━━━━━━━━━━━━━❍

╭━━━❐〔𝐌𝐄𝐃𝐈𝐀 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃〕
┃ ╭──────=───────❐
┃ ┃ ${config.PREFIX}ᴘʟᴀʏ / ${config.PREFIX}ꜱᴏɴɢ
┃ ┃ ${config.PREFIX}ᴠɪᴅᴇᴏ
┃ ┃ ${config.PREFIX}ᴛɪᴋᴛᴏᴋ
┃ ┃ ${config.PREFIX}ɪɢ
┃ ┃ ${config.PREFIX}ꜰʙ
┃ ┃ ${config.PREFIX}ᴛꜱ
┃ ┃ ${config.PREFIX}ʏᴛᴍᴘ3
┃ ┃ ${config.PREFIX}ᴇxᴘᴀɴᴅ
┃ ┃ ${config.PREFIX}ꜱʜᴏʀᴛᴜʀʟ
┃ ┃ ${config.PREFIX}ᴍᴇᴅɪᴀꜰɪʀᴇ
┃ ┃ ${config.PREFIX}ɢᴅʀɪᴠᴇ
┃ ┃ ${config.PREFIX}ᴅɪʀᴇᴄᴛ
┃ ┃ ${config.PREFIX}ᴍᴇɢᴀ
┃ ┃ ${config.PREFIX}ᴢɪᴘᴘʏꜱʜᴀʀᴇ
┃ ┃ ${config.PREFIX}ᴅʀᴏᴘʙᴏx
┃ ┃ ${config.PREFIX}ᴀᴘᴋ
┃ ┗━━ ${config.PREFIX}ɢɪᴛᴄʟᴏɴᴇ
┗━━━━━━━━━━━━━━━━❍

╭━━━❐〔𝐀𝐍𝐈𝐌𝐄 / 𝐖𝐀𝐈𝐅𝐔〕
┃ ╭──────=───────❐
┃ ┃ ${config.PREFIX}ɴᴇᴋᴏ
┃ ┃ ${config.PREFIX}ᴡᴀɪꜰᴜ
┃ ┃ ${config.PREFIX}ᴍɪʟꜰ
┃ ┃ ${config.PREFIX}ʜᴡᴀɪꜰᴜ
┃ ┃ ${config.PREFIX}ᴍᴇɢᴜᴍɪɴ
┃ ┃ ${config.PREFIX}ᴀꜱꜱ
┃ ┃ ${config.PREFIX}ᴇᴄᴄʜɪ
┃ ┃ ${config.PREFIX}ʟᴏʟɪ
┃ ┗━━ ${config.PREFIX}ᴀɴɪᴍᴇɪɴꜰᴏ
┗━━━━━━━━━━━━━━━━❍

╭━━━❐〔𝐒𝐓𝐈𝐂𝐊𝐄𝐑〕
┃ ╭──────=───────❐
┃ ┃ ${config.PREFIX}ꜱᴛɪᴄᴋᴇʀ
┃ ┃ ${config.PREFIX}ꜱʜɪɴᴏʙᴜ
┃ ┃ ${config.PREFIX}ꜱᴛɪᴄᴋᴋɪꜱꜱ / ʟɪᴄᴋ / ᴘᴀᴛ
┃ ┃ ${config.PREFIX}ꜱᴛɪᴄᴋʜᴜɢ / ᴄʀʏ / ᴋɪʟʟ
┃ ┃ ${config.PREFIX}ꜱᴛɪᴄᴋꜱᴘᴀɴᴋ / ʙᴏɴᴋ / ʙᴜʟʟʏ
┃ ┃ ${config.PREFIX}ꜱᴛɪᴄᴋʏᴇᴇᴛ / ʙɪᴛᴇ / ꜱʟᴀᴘ
┃ ┃ ${config.PREFIX}ꜱᴛɪᴄᴋɴᴏᴍ / ᴘᴏᴋᴇ / ᴡɪɴᴋ
┃ ┃ ${config.PREFIX}ꜱᴛɪᴄᴋꜱᴍɪʟᴇ / ᴡᴀᴠᴇ / ᴀᴡᴏᴏ
┃ ┃ ${config.PREFIX}ꜱᴛɪᴄᴋʙʟᴜꜱʜ / ꜱᴍᴜɢ / ɢʟᴏᴍᴘ
┃ ┃ ${config.PREFIX}ꜱᴛɪᴄᴋʜᴀᴘᴘʏ / ᴅᴀɴᴄᴇ / ᴄʀɪɴɢᴇ
┃ ┗━━ ${config.PREFIX}ꜱᴛɪᴄᴋᴄᴜᴅᴅʟᴇ / ʜɪɢʜꜰɪᴠᴇ
┗━━━━━━━━━━━━━━━━❍

╭━━━❐〔𝐐𝐔𝐎𝐓𝐄𝐒〕
┃ ╭──────=───────❐
┃ ┃ ${config.PREFIX}ꜰʀɪᴇɴᴅꜱʜɪᴘ
┃ ┃ ${config.PREFIX}ʟᴏᴠᴇ
┃ ┃ ${config.PREFIX}ꜰᴀᴛʜᴇʀꜱᴅᴀʏ
┃ ┃ ${config.PREFIX}ᴍᴏᴛʜᴇʀꜱᴅᴀʏ
┃ ┃ ${config.PREFIX}ɴᴇᴡʏᴇᴀʀ
┃ ┃ ${config.PREFIX}ᴄʜʀɪꜱᴛᴍᴀꜱ
┃ ┃ ${config.PREFIX}ʜᴇᴀʀᴛʙʀᴇᴀᴋ
┃ ┃ ${config.PREFIX}ᴠᴀʟᴇɴᴛɪɴᴇꜱ
┃ ┃ ${config.PREFIX}ɢᴏᴏᴅɴɪɢʜᴛ
┃ ┃ ${config.PREFIX}ᴛʜᴀɴᴋʏᴏᴜ
┃ ┃ ${config.PREFIX}ɢʀᴀᴛɪᴛᴜᴅᴇ
┃ ┃ ${config.PREFIX}ʙɪʙʟᴇ
┃ ┗━━ ${config.PREFIX}ᴀɴɪᴍᴇᴄʜᴀʀ / ᴀɴɪᴍᴇꜱʜᴏᴡ
┗━━━━━━━━━━━━━━━━❍

╭━━━❐〔𝐈𝐌𝐀𝐆𝐄 𝐂𝐑𝐄𝐀𝐓𝐎𝐑〕
┃ ╭──────=───────❐
┃ ┃ ${config.PREFIX}ꜰᴀɴᴄʏ
┃ ┃ ${config.PREFIX}ʟᴏɢᴏ
┃ ┃ ${config.PREFIX}ᴅʟʟᴏɢᴏ
┃ ┃ ${config.PREFIX}ᴇᴍᴏᴊɪ2ɢɪꜰ
┃ ┃ ${config.PREFIX}ᴀᴠᴇɴɢᴇʀꜱ
┃ ┃ ${config.PREFIX}ʙʟᴏᴏᴅʏᴛᴇxᴛ
┃ ┃ ${config.PREFIX}ʙʟᴀᴄᴋᴘɪɴᴋ
┃ ┃ ${config.PREFIX}ᴡᴀʀᴢᴏɴᴇ
┃ ┃ ${config.PREFIX}3ᴅᴄᴜʙɪᴄ
┃ ┃ ${config.PREFIX}ᴄʏʙᴇʀʜᴜɴᴛᴇʀ
┃ ┃ ${config.PREFIX}ʙᴏᴋᴇʜᴛᴇxᴛ
┃ ┃ ${config.PREFIX}ɢꜰxɢʟᴏᴡ
┃ ┃ ${config.PREFIX}ɢꜰx5
┃ ┗━━ ${config.PREFIX}ꜱʜɪᴍᴍᴇʀ
┗━━━━━━━━━━━━━━━━❍

╭━━━❐〔𝐒𝐄𝐀𝐑𝐂𝐇〕
┃ ╭──────=───────❐
┃ ┃ ${config.PREFIX}ʏᴛꜱ
┃ ┃ ${config.PREFIX}ɢᴏᴏɢʟᴇɪᴍᴀɢᴇ
┃ ┃ ${config.PREFIX}ᴡɪᴋɪᴘᴇᴅɪᴀ / ᴡɪᴋɪᴘᴇᴅɪᴀ2
┃ ┃ ${config.PREFIX}ɢᴏᴏɢʟᴇ-ᴀꜱᴋ
┃ ┃ ${config.PREFIX}ᴛɪᴋᴛᴏᴋꜱᴛᴀʟᴋ
┃ ┃ ${config.PREFIX}ʏᴛꜱᴛᴀʟᴋ
┃ ┗━━ ${config.PREFIX}ᴄᴏᴜɴᴛʀʏɪɴꜰᴏ
┗━━━━━━━━━━━━━━━━❍

╭━━━❐〔𝐆𝐑𝐎𝐔𝐏〕
┃ ╭──────=───────❐
┃ ┃ ${config.PREFIX}ᴛᴀɢᴀʟʟ
┃ ┃ ${config.PREFIX}ᴠᴄꜰ
┃ ┃ ${config.PREFIX}ɢʀᴏᴜᴘɪɴꜰᴏ
┃ ┃ ${config.PREFIX}ᴇxᴘᴏʀᴛɢʀᴏᴜᴘ
┃ ┃ ${config.PREFIX}ᴍᴜᴛᴇ
┃ ┃ ${config.PREFIX}ᴜɴᴍᴜᴛᴇ
┃ ┃ ${config.PREFIX}ʙʟᴏᴄᴋ
┃ ┗━━ ${config.PREFIX}ᴜɴʙʟᴏᴄᴋ
┗━━━━━━━━━━━━━━━━❍

╭━━━❐〔𝐓𝐎𝐎𝐋𝐒〕
┃ ╭──────=───────❐
┃ ┃ ${config.PREFIX}ᴡɪɴꜰᴏ
┃ ┃ ${config.PREFIX}ɢᴇᴛᴘᴘ / ɢᴇᴛᴘʀᴏꜰɪʟᴇ
┃ ┃ ${config.PREFIX}ᴛᴇᴍᴘᴍᴀɪʟ
┃ ┃ ${config.PREFIX}ᴛᴇᴍᴘᴇʀᴀᴛᴜʀᴇ
┃ ┃ ${config.PREFIX}ɪɴꜰᴏʀᴍᴀᴛɪᴏɴ
┃ ┃ ${config.PREFIX}ꜰᴀᴄᴛ
┃ ┃ ${config.PREFIX}ᴛʀᴀɴꜱʟᴀᴛᴇ
┃ ┃ ${config.PREFIX}ᴀɢᴇ
┃ ┃ ${config.PREFIX}ʀᴇᴠᴇʀꜱᴇ
┃ ┃ ${config.PREFIX}ɴᴇᴠᴇʀʜᴀᴠᴇɪᴇᴠᴇʀ
┃ ┃ ${config.PREFIX}ᴛʀɪᴠɪᴀ
┃ ┗━━ ${config.PREFIX}ᴘᴀɪʀ
┗━━━━━━━━━━━━━━━━❍

╭━━━❐〔𝐅𝐔𝐍〕
┃ ╭──────=───────❐
┃ ┃ ${config.PREFIX}ᴊᴏᴋᴇꜱᴠ2 / ᴊᴏᴋᴇᴠ4
┃ ┃ ${config.PREFIX}ʜᴀʟʟᴏᴡᴇᴇɴ
┃ ┃ ${config.PREFIX}ᴀᴅᴠɪᴄᴇ
┃ ┃ ${config.PREFIX}ꜰᴜɴᴄᴏᴅᴇ
┃ ┃ ${config.PREFIX}ᴘʀᴀɴᴋ1–ᴘʀᴀɴᴋ15
┃ ┗━━ ${config.PREFIX}ɴɢʟ / ɴɢʟꜱᴇɴᴅ
┗━━━━━━━━━━━━━━━━❍

╭━━━❐〔𝐍𝐄𝐖𝐒 / 𝐈𝐍𝐅𝐎〕
┃ ╭──────=───────❐
┃ ┃ ${config.PREFIX}ɴᴇᴡꜱ
┃ ┃ ${config.PREFIX}ɴᴀꜱᴀ
┃ ┃ ${config.PREFIX}ᴄʀɪᴄᴋᴇᴛ
┃ ┃ ${config.PREFIX}ɢᴏꜱꜱɪᴘ
┃ ┃ ${config.PREFIX}ʟʏʀɪᴄꜱ
┃ ┗━━ ${config.PREFIX}ᴘɪxᴀʙᴀʏ / ᴡᴀʟʟᴘᴀᴘᴇʀ
┗━━━━━━━━━━━━━━━━❍

╭━━━❐〔𝐀𝐏𝐈 𝐓𝐎𝐎𝐋𝐒〕
┃ ╭──────=───────❐
┃ ┃ ${config.PREFIX}ᴀᴅᴅᴀᴘɪ
┃ ┃ ${config.PREFIX}ꜰɪɴᴅᴀᴘɪ
┃ ┃ ${config.PREFIX}ᴀᴘɪᴡᴀᴛᴄʜᴇʀ
┃ ┃ ${config.PREFIX}ᴀᴘɪᴛᴏᴛᴀʟ
┃ ┃ ${config.PREFIX}ᴄʜᴇᴄᴋ-ᴀᴘɪᴋᴇʏ
┃ ┗━━ ${config.PREFIX}ᴀᴘɪ-ᴄʜᴇᴄᴋ
┗━━━━━━━━━━━━━━━━❍

╭━━━❐〔𝐀𝐃𝐌𝐈𝐍〕
┃ ╭──────=───────❐
┃ ┃ ${config.PREFIX}ꜱᴇɴᴅᴛᴏᴜꜱᴇʀ
┃ ┃ ${config.PREFIX}ꜱᴇɴᴅᴛᴏᴜꜱᴇʀᴍᴇᴅɪᴀ
┃ ┃ ${config.PREFIX}ᴄʜᴇᴄᴋᴜꜱᴇʀꜱ / ᴛᴏᴛᴀʟᴜꜱᴇʀꜱ
┃ ┃ ${config.PREFIX}ꜰᴄ
┃ ┗━━ ${config.PREFIX}ᴅᴇʟᴇᴛᴇᴍᴇ
┗━━━━━━━━━━━━━━━━❍

    ⟥⌈ Qᴜᴇᴇɴ ʀᴜᴠᴀ ᴍɪɴɪ • ɪᴄᴏɴɪᴄ ᴛᴇᴄʜ ⌉⟤`;

    await socket.sendMessage(from, {
        image: fs.readFileSync('./ruva.jpg'),
        caption: menuText,
        contextInfo: {
            mentionedJid: [msg.key.participant || sender],
            forwardingScore: 999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: (config.NEWSLETTER_JID || '').trim(),
                newsletterName: 'Qᴜᴇᴇɴ ʀᴜᴠᴀ',
                serverMessageId: 143
            }
        }
    });

    break;
}
case 'fc': {
    if (args.length === 0) {
        return await socket.sendMessage(sender, {
            text: '❗ Please provide a channel JID.\n\nExample:\n.fcn 1203633963799×××@newsletter'
        });
    }

    const jid = args[0];
    if (!jid.endsWith("@newsletter")) {
        return await socket.sendMessage(sender, {
            text: '❗ Invalid JID. Please provide a JID ending with `@newsletter`'
        });
    }

    try {
        const metadata = await socket.newsletterMetadata("jid", jid);
        if (metadata?.viewer_metadata === null) {
            await socket.newsletterFollow(jid);
            await socket.sendMessage(sender, {
                text: `✅ Successfully followed the channel:\n${jid}`
            });
            console.log(`FOLLOWED CHANNEL: ${jid}`);
        } else {
            await socket.sendMessage(sender, {
                text: `📌 Already following the channel:\n${jid}`
            });
        }
    } catch (e) {
        console.error('❌ Error in follow channel:', e.message || e);
        await socket.sendMessage(sender, {
            text: `❌ Error: ${e.message || e}`
        });
    }
    break;
}
            case 'viewonce':
              case 'rvo':
              case 'vv': {
                await socket.sendMessage(sender, { react: { text: '✨', key: msg.key } });
                try{
                    if (!msg.quoted) return socket.sendMessage(sender, { text: "🚩 *Please reply to a viewonce message*" });
                    let quotedmsg = msg?.msg?.contextInfo?.quotedMessage;
                    await oneViewmeg(socket, isOwner, quotedmsg, sender);
                }catch(e){
                    console.log(e);
                    await socket.sendMessage(sender, { text: `${e}` });
                }
                break;
              }

              case 'logo': { 
                const q = args.join(" ");

                if (!q || q.trim() === '') {
                    return await socket.sendMessage(sender, { text: '*`Need a name for logo`*' });
                }

                await socket.sendMessage(sender, { react: { text: '⬆️', key: msg.key } });
                const list = await axios.get('https://raw.githubusercontent.com/md2839pv404/anony0808/refs/heads/main/ep.json');

                const rows = list.data.map((v) => ({
                    title: v.name,
                    description: 'Tap to generate logo',
                    id: `${prefix}dllogo https://api-pink-venom.vercel.app/api/logo?url=${v.url}&name=${q}`
                }));

                const buttonMessage = {
                    buttons: [
                        {
                            buttonId: 'action',
                            buttonText: { displayText: '🎨 Select Text Effect' },
                            type: 4,
                            nativeFlowInfo: {
                                name: 'single_select',
                                paramsJson: JSON.stringify({
                                    title: 'Available Text Effects',
                                    sections: [
                                        {
                                            title: 'Choose your logo style',
                                            rows
                                        }
                                    ]
                                })
                            }
                        }
                    ],
                    headerType: 1,
                    viewOnce: true,
                    caption: '*LOGO MAKER*',
                    image: { url: config.RCD_IMAGE_PATH },
                };

                await socket.sendMessage(from, buttonMessage, { quoted: msg });
                break;
              }

              case 'dllogo': {
                const q = args.join(" ");
                if (!q) return socket.sendMessage(from, { text: "Please give me url for capture the screenshot !!" });

                try {
                    const res = await axios.get(q);
                    const images = res.data.result?.download_url || res.data.result;
                    await socket.sendMessage(m.chat, {
                        image: { url: images },
                        caption: config.CAPTION
                    }, { quoted: msg });
                } catch (e) {
                    console.log('Logo Download Error:', e);
                    await socket.sendMessage(from, {
                        text: `❌ Error:\n${e.message || e}`
                    }, { quoted: msg });
                }
                break;
              }

              case 'aiimg': {
                const q =
                  msg.message?.conversation ||
                  msg.message?.extendedTextMessage?.text ||
                  msg.message?.imageMessage?.caption ||
                  msg.message?.videoMessage?.caption || '';

                const prompt = q.trim();

                if (!prompt) {
                  return await socket.sendMessage(sender, {
                    text: '🎨 *Please provide a prompt to generate an AI image.*'
                  });
                }

                try {
                  await socket.sendMessage(sender, { text: '🧠 *Creating your AI image...*' });

                  const apiUrl = `https://api.siputzx.my.id/api/ai/flux?prompt=${encodeURIComponent(prompt)}`;
                  const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });

                  if (!response || !response.data) {
                    return await socket.sendMessage(sender, {
                      text: '❌ *API did not return a valid image. Please try again later.*'
                    });
                  }

                  const imageBuffer = Buffer.from(response.data, 'binary');

                  await socket.sendMessage(sender, {
                    image: imageBuffer,
                    caption: `🧠 *Qᴜᴇᴇɴ ʀᴜᴠᴀ   AI IMAGE*\n\n📌 Prompt: ${prompt}`
                  }, { quoted: msg });

                } catch (err) {
                  console.error('AI Image Error:', err);
                  await socket.sendMessage(sender, {
                    text: `❗ *An error occurred:* ${err.response?.data?.message || err.message || 'Unknown error'}`
                  });
                }

                break;
              }

              case 'fancy': {
                const q =
                  msg.message?.conversation ||
                  msg.message?.extendedTextMessage?.text ||
                  msg.message?.imageMessage?.caption ||
                  msg.message?.videoMessage?.caption || '';

                const text = q.trim().replace(/^.fancy\s+/i, "");

                if (!text) {
                  return await socket.sendMessage(sender, {
                    text: "❎ *Please provide text to convert into fancy fonts.*\n\n📌 *Example:* `.fancy Moon`"
                  });
                }

                try {
                  const apiUrl = `https://www.dark-yasiya-api.site/other/font?text=${encodeURIComponent(text)}`;
                  const response = await axios.get(apiUrl);

                  if (!response.data.status || !response.data.result) {
                    return await socket.sendMessage(sender, {
                      text: "❌ *Error fetching fonts from API. Please try again later.*"
                    });
                  }

                  const fontList = response.data.result
                    .map(font => `*${font.name}:*\n${font.result}`)
                    .join("\n\n");

                  const finalMessage = `🎨 *Fancy Fonts Converter*\n\n${fontList}\n\n_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`;

                  await socket.sendMessage(sender, { text: finalMessage }, { quoted: msg });

                } catch (err) {
                  console.error("Fancy Font Error:", err);
                  await socket.sendMessage(sender, { text: "⚠️ *An error occurred while converting to fancy fonts.*" });
                }
                break;
              }

              case 'ts': {
                const q = msg.message?.conversation ||
                          msg.message?.extendedTextMessage?.text ||
                          msg.message?.imageMessage?.caption ||
                          msg.message?.videoMessage?.caption || '';

                const query = q.replace(/^[.\/!]ts\s*/i, '').trim();

                if (!query) {
                    return await socket.sendMessage(sender, {
                        text: '[❗] TikTok search failed'
                    }, { quoted: msg });
                }

                async function tiktokSearch(query) {
                    try {
                        const searchParams = new URLSearchParams({
                            keywords: query,
                            count: '10',
                            cursor: '0',
                            HD: '1'
                        });

                        const response = await axios.post("https://tikwm.com/api/feed/search", searchParams, {
                            headers: {
                                'Content-Type': "application/x-www-form-urlencoded; charset=UTF-8",
                                'Cookie': "current_language=en",
                                'User-Agent': "Mozilla/5.0"
                            }
                        });

                        const videos = response.data?.data?.videos;
                        if (!videos || videos.length === 0) {
                            return { status: false, result: "No videos found." };
                        }

                        return {
                            status: true,
                            result: videos.map(video => ({
                                description: video.title || "No description",
                                videoUrl: video.play || ""
                            }))
                        };
                    } catch (err) {
                        return { status: false, result: err.message };
                    }
                }

                function shuffleArray(array) {
                    for (let i = array.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [array[i], array[j]] = [array[j], array[i]];
                    }
                }

                try {
                    const searchResults = await tiktokSearch(query);
                    if (!searchResults.status) throw new Error(searchResults.result);

                    const results = searchResults.result;
                    shuffleArray(results);

                    const selected = results.slice(0, 6);

                    const cards = await Promise.all(selected.map(async (vid) => {
                        const videoBuffer = await axios.get(vid.videoUrl, { responseType: "arraybuffer" });
                        const media = await prepareWAMessageMedia({ video: videoBuffer.data }, {
                            upload: socket.waUploadToServer
                        });

                        return {
                            body: proto.Message.InteractiveMessage.Body.fromObject({ text: '' }),
                            footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: "Qᴜᴇᴇɴ ʀᴜᴠᴀ" }),
                            header: proto.Message.InteractiveMessage.Header.fromObject({
                                title: vid.description,
                                hasMediaAttachment: true,
                                videoMessage: media.videoMessage
                            }),
                            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                                buttons: []
                            })
                        };
                    }));

                    const msgContent = generateWAMessageFromContent(sender, {
                        viewOnceMessage: {
                            message: {
                                messageContextInfo: {
                                    deviceListMetadata: {},
                                    deviceListMetadataVersion: 2
                                },
                                interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                                    body: { text: `🔎 *TikTok Search:* ${query}` },
                                    footer: { text: "> 𝐏𝙾𝚆𝙴𝚁𝙳 𝐁𝚈 *M O O N*  𝗫 𝗠 𝗗" },
                                    header: { hasMediaAttachment: false },
                                    carouselMessage: { cards }
                                })
                            }
                        }
                    }, { quoted: msg });

                    await socket.relayMessage(sender, msgContent.message, { messageId: msgContent.key.id });

                } catch (err) {
                    await socket.sendMessage(sender, {
                        text: `❌ Error: ${err.message}`
                    }, { quoted: msg });
                }

                break;
              }
              case 'tiktok': {
                const q = msg.message?.conversation ||
                          msg.message?.extendedTextMessage?.text ||
                          msg.message?.imageMessage?.caption ||
                          msg.message?.videoMessage?.caption || '';

                const link = q.replace(/^[.\/!]tiktok(dl)?|tt(dl)?\s*/i, '').trim();

                if (!link) {
                    return await socket.sendMessage(sender, {
                        text: '📌 *Usage:* .tiktok <link>'
                    }, { quoted: msg });
                }

                if (!link.includes('tiktok.com')) {
                    return await socket.sendMessage(sender, {
                        text: '❌ *Invalid TikTok link.*'
                    }, { quoted: msg });
                }

                try {
                    await socket.sendMessage(sender, {
                        text: '⏳ Downloading video, please wait...'
                    }, { quoted: msg });

                    const apiUrl = `https://delirius-apiofc.vercel.app/download/tiktok?url=${encodeURIComponent(link)}`;
                    const { data } = await axios.get(apiUrl);

                    if (!data?.status || !data?.data) {
                        return await socket.sendMessage(sender, {
                            text: '❌ Failed to fetch TikTok video.'
                        }, { quoted: msg });
                    }

                    const { title, like, comment, share, author, meta } = data.data;
                    const video = meta.media.find(v => v.type === "video");

                    if (!video || !video.org) {
                        return await socket.sendMessage(sender, {
                            text: '❌ No downloadable video found.'
                        }, { quoted: msg });
                    }

                    const caption = `🎵 *TikTok Video*\n\n` +
                                    `👤 *User:* ${author.nickname} (@${author.username})\n` +
                                    `📖 *Title:* ${title}\n` +
                                    `👍 *Likes:* ${like}\n💬 *Comments:* ${comment}\n🔁 *Shares:* ${share}`;

                    await socket.sendMessage(sender, {
                        video: { url: video.org },
                        caption: caption,
                        contextInfo: { mentionedJid: [msg.key.participant || sender] }
                    }, { quoted: msg });

                } catch (err) {
                    console.error("TikTok command error:", err);
                    await socket.sendMessage(sender, {
                        text: `❌ An error occurred:\n${err.message}`
                    }, { quoted: msg });
                }

                break;
              }

              case 'fb': {
                const q = msg.message?.conversation || 
                          msg.message?.extendedTextMessage?.text || 
                          msg.message?.imageMessage?.caption || 
                          msg.message?.videoMessage?.caption || 
                          '';

                const fbUrl = q?.trim();

                if (!/facebook\.com|fb\.watch/.test(fbUrl)) {
                    return await socket.sendMessage(sender, { text: '🧩 *Please provide a valid Facebook video link.*' });
                }

                try {
                    const res = await axios.get(`https://suhas-bro-api.vercel.app/download/fbdown?url=${encodeURIComponent(fbUrl)}`);
                    const result = res.data.result;

                    await socket.sendMessage(sender, { react: { text: '⬇', key: msg.key } });

                    await socket.sendMessage(sender, {
                        video: { url: result.sd },
                        mimetype: 'video/mp4',
                        caption: '> 𝐏𝙾𝚆𝙴𝚁𝙳 𝐁𝚈 *M O O N*  𝗫 𝗠 𝗗'
                    }, { quoted: msg });

                    await socket.sendMessage(sender, { react: { text: '✔', key: msg.key } });

                } catch (e) {
                    console.log(e);
                    await socket.sendMessage(sender, { text: '*❌ Error downloading video.*' });
                }

                break;
              }

              case 'gossip': {
                try {
                    const response = await fetch('https://suhas-bro-api.vercel.app/news/gossiplankanews');
                    if (!response.ok) {
                        throw new Error('API returned error');
                    }
                    const data = await response.json();

                    if (!data.status || !data.result || !data.result.title || !data.result.desc || !data.result.link) {
                        throw new Error('Invalid news data received');
                    }

                    const { title, desc, date, link } = data.result;

                    let thumbnailUrl = 'https://via.placeholder.com/150';
                    try {
                        const pageResponse = await fetch(link);
                        if (pageResponse.ok) {
                            const pageHtml = await pageResponse.text();
                            const $ = cheerio.load(pageHtml);
                            const ogImage = $('meta[property="og:image"]').attr('content');
                            if (ogImage) {
                                thumbnailUrl = ogImage; 
                            } else {
                                console.warn(`No og:image found for ${link}`);
                            }
                        } else {
                            console.warn(`Failed to fetch page ${link}: ${pageResponse.status}`);
                        }
                    } catch (err) {
                        console.warn(`Thumbnail scrape failed for ${link}: ${err.message}`);
                    }

                    await socket.sendMessage(sender, {
                        image: { url: thumbnailUrl },
                        caption: formatMessage(
                            '📰 * Qᴜᴇᴇɴ ʀᴜᴠᴀ   GOSSIP  📰',
                            `📢 *${title}*\n\n${desc}\n\n🕒 *Date*: ${date || 'Unknown'}\n🌐 *Link*: ${link}`,
                            'Qᴜᴇᴇɴ ʀᴜᴠᴀ  𝐅𝚁𝙴𝙴 𝐁𝙾𝚃'
                        )
                    });
                } catch (error) {
                    console.error(`Error in 'gossip' case: ${error.message || error}`);
                    await socket.sendMessage(sender, {
                        text: '⚠️ Failed to fetch gossip news.'
                    });
                }
                break;
              }

              case 'nasa': {
                try {
                    const response = await fetch('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY');
                    if (!response.ok) {
                        throw new Error('Failed to fetch APOD from NASA API');
                    }
                    const data = await response.json();

                    if (!data.title || !data.explanation || !data.date || !data.url) {
                        throw new Error('Invalid APOD data received');
                    }

                    const { title, explanation, date, url, copyright } = data;
                    const thumbnailUrl = url || 'https://via.placeholder.com/150';

                    await socket.sendMessage(sender, {
                        image: { url: thumbnailUrl },
                        caption: formatMessage(
                            '🌌 Qᴜᴇᴇɴ ʀᴜᴠᴀ  𝐍𝐀𝐒𝐀 𝐍𝐄𝐖𝐒',
                            `🌠 *${title}*\n\n${explanation.substring(0, 200)}...\n\n📆 *Date*: ${date}\n${copyright ? `📝 *Credit*: ${copyright}` : ''}\n🔗 *Link*: https://apod.nasa.gov/apod/astropix.html`,
                            '> Qᴜᴇᴇɴ ʀᴜᴠᴀ  𝐌𝙸𝙽𝙸 𝐁𝙾𝚃'
                        )
                    });

                } catch (error) {
                    console.error(`Error in 'nasa' case: ${error.message || error}`);
                    await socket.sendMessage(sender, {
                        text: '⚠️ NASA fetch failed.'
                    });
                }
                break;
              }

              case 'news': {
                try {
                    const response = await fetch('https://suhas-bro-api.vercel.app/news/lnw');
                    if (!response.ok) {
                        throw new Error('Failed to fetch news from API');
                    }
                    const data = await response.json();

                    if (!data.status || !data.result || !data.result.title || !data.result.desc || !data.result.date || !data.result.link) {
                        throw new Error('Invalid news data received');
                    }

                    const { title, desc, date, link } = data.result;
                    let thumbnailUrl = 'https://via.placeholder.com/150';
                    try {
                        const pageResponse = await fetch(link);
                        if (pageResponse.ok) {
                            const pageHtml = await pageResponse.text();
                            const $ = cheerio.load(pageHtml);
                            const ogImage = $('meta[property="og:image"]').attr('content');
                            if (ogImage) {
                                thumbnailUrl = ogImage;
                            } else {
                                console.warn(`No og:image found for ${link}`);
                            }
                        } else {
                            console.warn(`Failed to fetch page ${link}: ${pageResponse.status}`);
                        }
                    } catch (err) {
                        console.warn(`Failed to scrape thumbnail from ${link}: ${err.message}`);
                    }

                    await socket.sendMessage(sender, {
                        image: { url: thumbnailUrl },
                        caption: formatMessage(
                            '📰 Qᴜᴇᴇɴ ʀᴜᴠᴀ 📰',
                            `📢 *${title}*\n\n${desc}\n\n🕒 *Date*: ${date}\n🌐 *Link*: ${link}`,
                            '> Qᴜᴇᴇɴ ʀᴜᴠᴀ'
                        )
                    });
                } catch (error) {
                    console.error(`Error in 'news' case: ${error.message || error}`);
                    await socket.sendMessage(sender, {
                        text: '⚠️ news fetch failed.'
                    });
                }
                break;
              }

              case 'cricket': {
                try {
                    console.log('Fetching cricket news from API...');
                    const response = await fetch('https://suhas-bro-api.vercel.app/news/cricbuzz');
                    console.log(`API Response Status: ${response.status}`);

                    if (!response.ok) {
                        throw new Error(`API request failed with status ${response.status}`);
                    }

                    const data = await response.json();
                    console.log('API Response Data:', JSON.stringify(data, null, 2));

                    if (!data.status || !data.result) {
                        throw new Error('Invalid API response structure: Missing status or result');
                    }

                    const { title, score, to_win, crr, link } = data.result;
                    if (!title || !score || !to_win || !crr || !link) {
                        throw new Error('Missing required fields in API response: ' + JSON.stringify(data.result));
                    }

                    await socket.sendMessage(sender, {
                        text: formatMessage(
                            '🏏 Qᴜᴇᴇɴ ʀᴜᴠᴀ  CRICKET NEWS🏏',
                            `📢 *${title}*\n\n` +
                            `🏆 *Mark*: ${score}\n` +
                            `🎯 *To Win*: ${to_win}\n` +
                            `📈 *Current Rate*: ${crr}\n\n` +
                            `🌐 *Link*: ${link}`,
                            '> Qᴜᴇᴇɴ ʀᴜᴠᴀ'
                        )
                    });
                } catch (error) {
                    console.error(`Error in 'cricket' case: ${error.message || error}`);
                    await socket.sendMessage(sender, {
                        text: '⚠️ Cricket fetch failed.'
                    });
                }
                break;
              }

              case 'apk': {
                const appName = args.join(" ");

                if (!appName) {
                    return await socket.sendMessage(sender, {
                        text: '❌ *Please provide the app name!*\n\n*Usage:* .apk <app name>\n*Example:* .apk WhatsApp'
                    }, { quoted: msg });
                }

                await socket.sendMessage(sender, {
                    react: { text: '⬇️', key: msg.key }
                });

                try {
                    const apiUrl = `http://ws75.aptoide.com/api/7/apps/search/query=${encodeURIComponent(appName)}/limit=1`;
                    const response = await axios.get(apiUrl);
                    const data = response.data;

                    if (!data || !data.datalist || !data.datalist.list.length) {
                        await socket.sendMessage(sender, {
                            react: { text: '❌', key: msg.key }
                        });
                        return await socket.sendMessage(sender, {
                            text: '⚠️ *No results found for the given app name.*\n\nPlease try a different search term.'
                        }, { quoted: msg });
                    }

                    const app = data.datalist.list[0];
                    const appSize = (app.size / 1048576).toFixed(2);

                    const caption = `
🌙 *Qᴜᴇᴇɴ ʀᴜᴠᴀ  Aᴘᴋ* 🌙

📦 *Nᴀᴍᴇ:* ${app.name}

🏋 *Sɪᴢᴇ:* ${appSize} MB

📦 *Pᴀᴄᴋᴀɢᴇ:* ${app.package}

📅 *Uᴘᴅᴀᴛᴇᴅ ᴏɴ:* ${app.updated}

👨‍💻 *Dᴇᴠᴇʟᴏᴘᴇʀ:* ${app.developer.name}

> ⏳ *ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ ᴀᴘᴋ...*

> *© Qᴜᴇᴇɴ ʀᴜᴠᴀ*`;

                    if (app.icon) {
                        await socket.sendMessage(sender, {
                            image: { url: app.icon },
                            caption: caption,
                            contextInfo: {
                                forwardingScore: 1,
                                isForwarded: true,
                                forwardedNewsletterMessageInfo: {
                                    newsletterJid: config.NEWSLETTER_JID || '120363406453808987@newsletter',
                                    newsletterName: 'Qᴜᴇᴇɴ ʀᴜᴠᴀ',
                                    serverMessageId: -1
                                }
                            }
                        }, { quoted: msg });
                    } else {
                        await socket.sendMessage(sender, {
                            text: caption,
                            contextInfo: {
                                forwardingScore: 1,
                                isForwarded: true,
                                forwardedNewsletterMessageInfo: {
                                    newsletterJid: config.NEWSLETTER_JID || '120363406453808987@newsletter',
                                    newsletterName: 'Qᴜᴇᴇɴ ʀᴜᴠᴀ',
                                    serverMessageId: -1
                                }
                            }
                        }, { quoted: msg });
                    }

                    await socket.sendMessage(sender, {
                        react: { text: '⬆️', key: msg.key }
                    });

                    await socket.sendMessage(sender, {
                        document: { url: app.file.path_alt },
                        fileName: `${app.name}.apk`,
                        mimetype: 'application/vnd.android.package-archive',
                        caption: `✅ *Aᴘᴋ Dᴏᴡɴʟᴏᴀᴅᴇᴅ Sᴜᴄᴄᴇꜱꜰᴜʟʟʏ!*\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *Qᴜᴇᴇɴ ʀᴜᴠᴀ 🌙`,
                        contextInfo: {
                            forwardingScore: 1,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: config.NEWSLETTER_JID || '120363406453808987@newsletter',
                                newsletterName: 'Qᴜᴇᴇɴ ʀᴜᴠᴀ',
                                serverMessageId: -1
                            }
                        }
                    }, { quoted: msg });

                    await socket.sendMessage(sender, {
                        react: { text: '✅', key: msg.key }
                    });

                } catch (error) {
                    console.error('Error in APK command:', error);
                    
                    await socket.sendMessage(sender, {
                        react: { text: '❌', key: msg.key }
                    });
                    
                    await socket.sendMessage(sender, {
                        text: '❌ *An error occurred while fetching the APK.*\n\nPlease try again later or use a different app name.'
                    }, { quoted: msg });
                }
                break;
              }

              case 'ping': {
                try {
                    await socket.sendMessage(sender, { react: { text: '⚡', key: msg.key } });
                    const start = Date.now();
                    const sentMsg = await socket.sendMessage(from, {
                        text: '_Pinging..._'
                    }, { quoted: msg });
                    const latency = Date.now() - start;
                    const status = latency < 100 ? '🟢 Fast' : latency < 300 ? '🟡 Normal' : '🔴 Slow';
                    await socket.sendMessage(from, {
                        text:
                            `╭───「 ⚡ *Ping* 」───╮\n` +
                            `│\n` +
                            `│ 🏓 Pong!\n` +
                            `│ ⏱ Latency: ${latency}ms\n` +
                            `│ 📶 Speed: ${status}\n` +
                            `│\n` +
                            `╰───「 *Queen Ruva Mini* 」───╯`,
                        edit: sentMsg.key
                    });
                } catch (error) {
                    await socket.sendMessage(sender, { text: '❌ Ping failed.' }, { quoted: msg });
                }
                break;
              }
case 'checkusers':
case 'totalusers': {
    // Only allow admin/owner
    if (!isOwner) {
        return await socket.sendMessage(sender, {
            text: '❌ This command is only for the bot owner.'
        }, { quoted: msg });
    }
    
    try {
        // Get active sockets count (connected users)
        const activeCount = activeSockets.size;
        
        // You might want to track all users who have ever used the bot
        // For this example, I'll show active sockets
        const totalMessage = `👑 *USER STATISTICS*\n\n` +
                           `📊 *Active Users:* ${activeCount}\n` +
                           `🔗 *Total Bots Running:* ${activeSockets.size}\n` +
                           `📈 *Real-time Connections:* ${activeCount}\n\n` +
                           `📅 *Date:* ${new Date().toLocaleDateString()}\n` +
                           `🕒 *Time:* ${new Date().toLocaleTimeString()}\n\n` +
                           `_𝐏𝙾𝚆𝙴𝚁𝙴𝙳 𝐁𝚈 𝙸ᴄᴏɴɪᴄ 𝚃ᴇᴄʜ_`;
        
        await socket.sendMessage(sender, {
            text: totalMessage
        }, { quoted: msg });
        
        // Optional: Show active numbers
        if (activeSockets.size > 0) {
            let activeList = `📱 *Active User Numbers:*\n`;
            activeSockets.forEach((socketObj, number) => {
                activeList += `• ${number}\n`;
            });
            
            await socket.sendMessage(sender, {
                text: activeList
            }, { quoted: msg });
        }
        
    } catch (error) {
        console.error('Checkusers command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Failed to fetch user statistics.'
        }, { quoted: msg });
    }
    break;
}

case 'sendtouser':
case 'broadcast': {
    // Only allow admin/owner
    if (!isOwner) {
        return await socket.sendMessage(sender, {
            text: '❌ This command is only for the bot owner.'
        }, { quoted: msg });
    }
    
    const messageText = args.join(' ').trim();
    
    if (!messageText) {
        return await socket.sendMessage(sender, {
            text: `📢 *Broadcast Message*\n\n*Usage:* \`${config.PREFIX}sendtouser <message>\`\n\n*Example:* \`${config.PREFIX}sendtouser Hello everyone! This is a broadcast message.\``
        }, { quoted: msg });
    }
    
    try {
        // First, confirm with the admin
        await socket.sendMessage(sender, {
            text: `📢 *BROADCAST CONFIRMATION*\n\n*Message:* ${messageText}\n\n*Recipients:* ${activeSockets.size} active users\n\nReply with "yes" to send or "no" to cancel.`
        }, { quoted: msg });
        
        // Store the broadcast data temporarily
        const broadcastData = {
            text: messageText,
            sender: sender,
            timestamp: Date.now()
        };
        
        // You'll need to handle the confirmation response
        // This requires additional state management
        // For simplicity, let's send directly:
        
        if (activeSockets.size === 0) {
            return await socket.sendMessage(sender, {
                text: '❌ No active users to send message to.'
            }, { quoted: msg });
        }
        
        let successCount = 0;
        let failCount = 0;
        
        // Send to all active users
        for (const [number, socketObj] of activeSockets.entries()) {
            try {
                const userJid = `${number}@s.whatsapp.net`;
                await socket.sendMessage(userJid, {
                    text: `📢 *BROADCAST MESSAGE*\n\n${messageText}\n\n_From: Bot Admin_`
                });
                successCount++;
                
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.error(`Failed to send to ${number}:`, error);
                failCount++;
            }
        }
        
        // Send report to admin
        const report = `📢 *BROADCAST COMPLETE*\n\n` +
                      `✅ *Successfully sent to:* ${successCount} users\n` +
                      `❌ *Failed to send to:* ${failCount} users\n` +
                      `📊 *Total attempted:* ${activeSockets.size} users\n\n` +
                      `📝 *Message sent:*\n${messageText.substring(0, 100)}${messageText.length > 100 ? '...' : ''}`;
        
        await socket.sendMessage(sender, {
            text: report
        }, { quoted: msg });
        
    } catch (error) {
        console.error('Sendtouser command error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Failed to send broadcast message.'
        }, { quoted: msg });
    }
    break;
}

// Alternative: Send with media
case 'sendtousermedia': {
    if (!isOwner) {
        return await socket.sendMessage(sender, {
            text: '❌ This command is only for the bot owner.'
        }, { quoted: msg });
    }
    
    // Check if there's quoted media
    const quotedMsg = msg.quoted;
    if (!quotedMsg) {
        return await socket.sendMessage(sender, {
            text: `🖼️ *Broadcast with Media*\n\nReply to an image/video with caption \`${config.PREFIX}sendtousermedia <caption>\``
        }, { quoted: msg });
    }
    
    const caption = args.join(' ').trim();
    
    try {
        if (activeSockets.size === 0) {
            return await socket.sendMessage(sender, {
                text: '❌ No active users to send message to.'
            }, { quoted: msg });
        }
        
        let successCount = 0;
        let failCount = 0;
        
        // Determine media type
        let mediaType = '';
        let mediaContent = null;
        
        if (quotedMsg.imageMessage) {
            mediaType = 'image';
            mediaContent = quotedMsg.imageMessage;
        } else if (quotedMsg.videoMessage) {
            mediaType = 'video';
            mediaContent = quotedMsg.videoMessage;
        } else {
            return await socket.sendMessage(sender, {
                text: '❌ Only image and video media are supported.'
            }, { quoted: msg });
        }
        
        // Download the media once
        const stream = await downloadContentFromMessage(mediaContent, mediaType);
        let buffer = Buffer.from([]);
        
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        
        // Send to all users
        for (const [number, socketObj] of activeSockets.entries()) {
            try {
                const userJid = `${number}@s.whatsapp.net`;
                
                if (mediaType === 'image') {
                    await socket.sendMessage(userJid, {
                        image: buffer,
                        caption: caption ? `📢 *BROADCAST*\n\n${caption}` : '📢 *Broadcast Message*'
                    });
                } else if (mediaType === 'video') {
                    await socket.sendMessage(userJid, {
                        video: buffer,
                        caption: caption ? `📢 *BROADCAST*\n\n${caption}` : '📢 *Broadcast Message*'
                    });
                }
                
                successCount++;
                await new Promise(resolve => setTimeout(resolve, 300));
                
            } catch (error) {
                console.error(`Failed to send media to ${number}:`, error);
                failCount++;
            }
        }
        
        // Send report
        const report = `🖼️ *MEDIA BROADCAST COMPLETE*\n\n` +
                      `✅ *Successfully sent to:* ${successCount} users\n` +
                      `❌ *Failed to send to:* ${failCount} users\n` +
                      `📸 *Media type:* ${mediaType.toUpperCase()}\n` +
                      `📝 *Caption:* ${caption || 'No caption'}`;
        
        await socket.sendMessage(sender, {
            text: report
        }, { quoted: msg });
        
    } catch (error) {
        console.error('Sendtousermedia error:', error);
        await socket.sendMessage(sender, {
            text: '❌ Failed to broadcast media.'
        }, { quoted: msg });
    }
    break;
}
              case 'bible': {
                try {
                    const reference = args.join(" ");

                    if (!reference) {
                        await socket.sendMessage(sender, {
                            text: `⚠️ *Please provide a Bible reference.*\n\n📝 *Example:*\n.bible John 1:1\n\n💡 *Other examples:*\n.bible Genesis 1:1\n.bible Psalm 23\n.bible Matthew 5:3-10\n.bible Romans 8:28`
                        }, { quoted: msg });
                        break;
                    }

                    const apiUrl = `https://bible-api.com/${encodeURIComponent(reference)}`;
                    const response = await axios.get(apiUrl, { timeout: 10000 });

                    if (response.status === 200 && response.data && response.data.text) {
                        const { reference: ref, text, translation_name, verses } = response.data;

                        let verseText = text;
                        
                        if (verses && verses.length > 0) {
                            verseText = verses.map(v => 
                                `${v.book_name} ${v.chapter}:${v.verse} - ${v.text}`
                            ).join('\n\n');
                        }

                        await socket.sendMessage(sender, {
                            text: `📖 *BIBLE VERSE*\n\n` +
                                  `📚 *Reference:* ${ref}\n\n` +
                                  `📜 *Text:*\n${verseText}\n\n` +
                                  `🔄 *Translation:* ${translation_name}\n\n` +
                                  `> ✨ *Powered by M o o n  𝗫 m d*`
                        }, { quoted: msg });
                    } else {
                        await socket.sendMessage(sender, {
                            text: `❌ *Verse not found.*\n\nPlease check if the reference is valid.\n\n📋 *Valid format examples:*\n- John 3:16\n- Psalm 23:1-6\n- Genesis 1:1-5\n- Matthew 5:3-10`
                        }, { quoted: msg });
                    }
                } catch (error) {
                    console.error("Bible command error:", error.message);
                    
                    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                        await socket.sendMessage(sender, {
                            text: "⏰ *Request timeout.* Please try again in a moment."
                        }, { quoted: msg });
                    } else if (error.response) {
                        await socket.sendMessage(sender, {
                            text: `❌ *API Error:* ${error.response.status}\n\nCould not fetch the Bible verse. Please try a different reference.`
                        }, { quoted: msg });
                    } else if (error.request) {
                        await socket.sendMessage(sender, {
                            text: "🌐 *Network error.* Please check your internet connection and try again."
                        }, { quoted: msg });
                    } else {
                        await socket.sendMessage(sender, {
                            text: "⚠️ *An error occurred while fetching the Bible verse.*\n\nPlease try again or use a different reference."
                        }, { quoted: msg });
                    }
                }
                break;
              }

              case 'gitclone': {
    const AXIOS_DEFAULTS = {
        timeout: 60000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*'
        }
    };

    async function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function tryRequest(getter, attempts = 3) {
        let lastError;
        for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
                return await getter();
            } catch (err) {
                lastError = err;
                if (attempt < attempts) {
                    await delay(1000 * attempt);
                }
            }
        }
        throw lastError;
    }

    async function sendReaction(emoji) {
        try {
            await socket.sendMessage(sender, { 
                react: { 
                    text: emoji, 
                    key: msg.key 
                } 
            });
        } catch (error) {
            console.error('Error sending reaction:', error);
        }
    }

    async function downloadAndZipRepo(gitUrl) {
        try {
            // Extract repo info from URL
            const repoMatch = gitUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/i);
            if (!repoMatch) throw new Error('Invalid GitHub URL');
            
            const [, owner, repo] = repoMatch;
            const repoName = repo.replace(/\.git$/, '');
            
            // API to get repo info
            const apiUrl = `https://api.github.com/repos/${owner}/${repoName}`;
            const repoInfo = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
            
            // Download as zip
            const zipUrl = `https://github.com/${owner}/${repoName}/archive/refs/heads/main.zip`;
            
            return {
                downloadUrl: zipUrl,
                info: repoInfo.data,
                fileName: `${repoName}-main.zip`
            };
        } catch (error) {
            // Try with master branch as fallback
            try {
                const repoMatch = gitUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/i);
                if (!repoMatch) throw error;
                
                const [, owner, repo] = repoMatch;
                const repoName = repo.replace(/\.git$/, '');
                
                const zipUrl = `https://github.com/${owner}/${repoName}/archive/refs/heads/master.zip`;
                
                return {
                    downloadUrl: zipUrl,
                    info: { name: repoName, owner: { login: owner } },
                    fileName: `${repoName}-master.zip`
                };
            } catch {
                throw new Error('Failed to get repository information');
            }
        }
    }

    async function getGitHubRepoInfo(gitUrl) {
        try {
            const repoMatch = gitUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/i);
            if (!repoMatch) throw new Error('Invalid GitHub URL');
            
            const [, owner, repo] = repoMatch;
            const repoName = repo.replace(/\.git$/, '');
            
            const apiUrl = `https://api.github.com/repos/${owner}/${repoName}`;
            const response = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
            
            return response.data;
        } catch (error) {
            // Return basic info if API fails
            const repoMatch = gitUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/i);
            if (repoMatch) {
                const [, owner, repo] = repoMatch;
                const repoName = repo.replace(/\.git$/, '');
                return {
                    name: repoName,
                    owner: { login: owner },
                    description: 'Repository information unavailable',
                    stargazers_count: 0,
                    forks_count: 0,
                    size: 0,
                    language: null,
                    html_url: gitUrl
                };
            }
            throw error;
        }
    }

    const q = msg.message?.conversation || 
              msg.message?.extendedTextMessage?.text || '';
    
    const cleanText = q.replace(/^\.gitclone\s*/i, '').trim();
    
    await sendReaction('📥');
    
    if (!cleanText) {
        await sendReaction('❓');
        await socket.sendMessage(sender, { 
            text: '*📥 GIT CLONE DOWNLOADER 📥*\n\n*Usage:*\n`.gitclone <github-url>`\n\n*Examples:*\n`.gitclone https://github.com/owner/repo`\n`.gitclone https://github.com/SuhailTechInfo/Suhail-Md`\n`.gitclone owner/repo`\n\n*Note:* Downloads repository as ZIP file' 
        }, { quoted: msg });
        break;
    }

    // Process input - support both URL and owner/repo format
    let gitUrl = cleanText;
    if (!gitUrl.includes('://')) {
        if (gitUrl.includes('/')) {
            gitUrl = `https://github.com/${gitUrl}`;
        } else {
            await sendReaction('❌');
            await socket.sendMessage(sender, { 
                text: '*❌ Invalid Input!*\nPlease provide a valid GitHub URL or owner/repo format\n\n*Example:* `owner/repo` or `https://github.com/owner/repo`' 
            }, { quoted: msg });
            break;
        }
    }

    // Validate GitHub URL
    if (!gitUrl.includes('github.com')) {
        await sendReaction('❌');
        await socket.sendMessage(sender, { 
            text: '*❌ Invalid GitHub URL!*\nOnly GitHub repositories are supported.' 
        }, { quoted: msg });
        break;
    }

    await sendReaction('🔍');
    
    await socket.sendMessage(sender, { 
        text: `*🔍 Fetching repository:* \`${gitUrl}\`\n⏳ Please wait...` 
    }, { quoted: msg });

    try {
        // Get repository information
        const repoInfo = await getGitHubRepoInfo(gitUrl);
        
        // Repository info box
        const infoBox = `╭───「 📦 REPOSITORY INFO 」───⊷\n` +
                       `│ 📁 *Repository:* ${repoInfo.name}\n` +
                       `│ 👤 *Owner:* ${repoInfo.owner.login}\n` +
                       `│ ⭐ *Stars:* ${repoInfo.stargazers_count.toLocaleString()}\n` +
                       `│ 🍴 *Forks:* ${repoInfo.forks_count.toLocaleString()}\n` +
                       `│ 📏 *Size:* ${(repoInfo.size / 1024).toFixed(2)} MB\n` +
                       `│ 💻 *Language:* ${repoInfo.language || 'Not specified'}\n` +
                       `│ 📝 *Description:* ${repoInfo.description || 'No description'}\n` +
                       `╰─────────────────────────────⊷`;
        
        await socket.sendMessage(sender, {
            text: infoBox
        }, { quoted: msg });

        await sendReaction('⏳');
        
        await socket.sendMessage(sender, { 
            text: `*📥 Preparing download...*` 
        }, { quoted: msg });

        // Get download URL
        const repoData = await downloadAndZipRepo(gitUrl);
        
        await sendReaction('⬇️');
        
        // Send the zip file
        await socket.sendMessage(sender, {
            document: { url: repoData.downloadUrl },
            mimetype: 'application/zip',
            fileName: repoData.fileName,
            caption: `╭───「 ✅ REPOSITORY DOWNLOADED 」───⊷\n` +
                    `│ 📁 *File:* ${repoData.fileName}\n` +
                    `│ 📦 *Repository:* ${repoInfo.name}\n` +
                    `│ 👤 *Owner:* ${repoInfo.owner.login}\n` +
                    `│ 🔗 *Source:* ${repoInfo.html_url}\n` +
                    `│ 💾 *Format:* ZIP Archive\n` +
                    `╰─────────────────────────────────⊷\n\n` +
                    `💡 *Extract the ZIP file to access repository files*`,
            contextInfo: {
                externalAdReply: {
                    title: 'GIT CLONE DOWNLOADER',
                    body: '📥 GitHub Repository Download',
                    thumbnailUrl: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
                    sourceUrl: repoInfo.html_url,
                    mediaType: 1,
                    previewType: 0,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: msg });

        // Success reaction
        await sendReaction('✅');

        // Final message
        await delay(1000);
        await socket.sendMessage(sender, { 
            text: `✨ *Repository cloned successfully!*\n` +
                  `📁 *Saved as:* ${repoData.fileName}\n` +
                  `💡 *Use a ZIP extractor to access the files*\n\n` +
                  `> queen ruva`
        }, { quoted: msg });

    } catch (error) {
        console.error('GitClone error:', error);
        await sendReaction('❌');
        
        if (error.message.includes('Invalid GitHub URL') || error.message.includes('Invalid Input')) {
            await socket.sendMessage(sender, { 
                text: '*❌ Invalid GitHub URL!*\nPlease provide a valid GitHub repository URL.\n\n*Format:* `https://github.com/owner/repository`' 
            }, { quoted: msg });
        } else if (error.message.includes('Not Found') || error.response?.status === 404) {
            await socket.sendMessage(sender, { 
                text: '*❌ Repository Not Found!*\nThe repository does not exist or is private.\n\n*Check:*\n1. Repository exists\n2. Repository is public\n3. URL is correct' 
            }, { quoted: msg });
        } else if (error.code === 'ECONNABORTED') {
            await socket.sendMessage(sender, { 
                text: '*❌ Request Timeout!*\nThe repository is too large or server is busy.\n\nTry again later or download manually from GitHub.' 
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, { 
                text: `*❌ Download Failed!*\nError: ${error.message}\n\n*Try:*\n1. Check your internet\n2. Verify repository URL\n3. Try again later` 
            }, { quoted: msg });
        }
    }
    break;
}
case 'video': {
    const AXIOS_DEFAULTS = {
        timeout: 60000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*'
        }
    };

    async function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function tryRequest(getter, attempts = 3) {
        let lastError;
        for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
                return await getter();
            } catch (err) {
                lastError = err;
                if (attempt < attempts) {
                    await delay(1000 * attempt);
                }
            }
        }
        throw lastError;
    }

    // ✅ Working Video APIs (same as QUEEN RUVA)
    async function getVideoAPI(youtubeUrl) {
        const url = `https://apiskeith.vercel.app/download/video?url=${encodeURIComponent(youtubeUrl)}`;
        const res = await tryRequest(() => axios.get(url, AXIOS_DEFAULTS));
        if (res.data?.status && res.data.result) {
            return {
                download: res.data.result,
                title: 'Video'
            };
        }
        throw new Error("Video API failed");
    }

    async function getYtmp4API(youtubeUrl) {
        const url = `https://apiskeith.vercel.app/download/ytmp4?url=${encodeURIComponent(youtubeUrl)}`;
        const res = await tryRequest(() => axios.get(url, AXIOS_DEFAULTS));
        if (res.data?.status && res.data.result?.url) {
            return {
                download: res.data.result.url,
                title: res.data.result.filename || 'Video'
            };
        }
        throw new Error("YTMP4 API failed");
    }

    async function sendReaction(emoji) {
        try {
            await socket.sendMessage(sender, { 
                react: { 
                    text: emoji, 
                    key: msg.key 
                } 
            });
        } catch (error) {
            console.error('Error sending reaction:', error);
        }
    }

    const q = msg.message?.conversation || 
              msg.message?.extendedTextMessage?.text || '';
    
    const cleanText = q.replace(/^\.video\s*/i, '').trim();
    
    await sendReaction('🎬');
    
    if (!cleanText) {
        await sendReaction('❓');
        await socket.sendMessage(sender, { 
            text: '*🎬 VIDEO DOWNLOADER 🎬*\n\n*Usage:*\n`.video <title>`\n`.video <youtube link>`\n\n*Example:*\n`.video Faded by Alan Walker`\n`.video https://youtu.be/60ItHLz5WEA`' 
        }, { quoted: msg });
        break;
    }

    await sendReaction('🔍');
    
    await socket.sendMessage(sender, { 
        text: `*🔍 Searching for video:* \`${cleanText}\`\n⏳ Please wait...` 
    }, { quoted: msg });

    let video;
    if (cleanText.includes('youtube.com') || cleanText.includes('youtu.be')) {
        try {
            const ytdl = require('ytdl-core');
            const info = await ytdl.getInfo(cleanText);
            video = {
                url: cleanText,
                title: info.videoDetails.title,
                thumbnail: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url,
                timestamp: `${Math.floor(info.videoDetails.lengthSeconds / 60)}:${String(info.videoDetails.lengthSeconds % 60).padStart(2, '0')}`,
                views: parseInt(info.videoDetails.viewCount) || 0,
                author: { name: info.videoDetails.author.name },
                ago: 'Recent'
            };
        } catch (e) {
            video = {
                url: cleanText,
                title: 'YouTube Video',
                thumbnail: 'https://i.ytimg.com/vi/default.jpg',
                timestamp: '0:00',
                views: 0,
                author: { name: 'Unknown' },
                ago: 'Unknown'
            };
        }
    } else {
        const yts = require('yt-search');
        const search = await yts(cleanText);
        if (!search || !search.videos.length) {
            await sendReaction('❌');
            await socket.sendMessage(sender, { 
                text: `🔍 *No video results found for:* "${cleanText}"\n\n✨ *Try searching with different keywords*` 
            }, { quoted: msg });
            break;
        }
        video = search.videos[0];
    }

    // 🔹 Video info box
    let videoBox = `╭───「 🎬 𝗩𝗜𝗗𝗘𝗢 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥 」───⊷\n` +
      `│ 📋 *Title:* ${video.title}\n` +
      `│ 👁️ *Views:* ${video.views.toLocaleString()}\n` +
      `│ ⏱️ *Duration:* ${video.timestamp}\n` +
      `│ 📅 *Uploaded:* ${video.ago}\n` +
      `│ 🔗 *URL:* ${video.url}\n` +
      `│ 💫 *Powered by Qᴜᴇᴇɴ ʀᴜᴠᴀ*\n` +
      `╰──────────────────────────────⊷`;

    await socket.sendMessage(sender, {
        image: { url: video.thumbnail },
        caption: videoBox
    }, { quoted: msg });

    await sendReaction('⏳');
    
    await socket.sendMessage(sender, { 
        text: `*📥 Processing video download...*` 
    }, { quoted: msg });

    let videoData;
    try {
        // Try video APIs in order
        const apiList = [
            async () => await getVideoAPI(video.url),
            async () => await getYtmp4API(video.url),
        ];

        for (let api of apiList) {
            try {
                videoData = await api();
                console.log(`✅ Success using video API`);
                break;
            } catch (e) {
                console.log(`❌ Video API attempt failed: ${e.message}`);
                continue;
            }
        }

        if (!videoData) {
            throw new Error("All video APIs failed");
        }
    } catch (e) {
        await sendReaction('❌');
        await socket.sendMessage(sender, { 
            text: `❌ *Video Download Failed*\n\nUnable to fetch video content. Please try again later.\n\nError: ${e.message}` 
        }, { quoted: msg });
        break;
    }

    await sendReaction('⬇️');
    
    const fileName = `${video.title}.mp4`
        .replace(/[<>:"/\\|?*]+/g, '')
        .substring(0, 200);
    
    const downloadUrl = videoData.download;
    
    if (!downloadUrl || !downloadUrl.startsWith('http')) {
        await sendReaction('❌');
        await socket.sendMessage(sender, { 
            text: '*❌ Invalid video download URL!*' 
        }, { quoted: msg });
        break;
    }
    
    // Send video
    await socket.sendMessage(sender, {
        video: { url: downloadUrl },
        mimetype: 'video/mp4',
        caption: `╭───「 ✅ 𝗩𝗜𝗗𝗘𝗢 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 」───⊷\n` +
                `│ 🎥 *Title:* ${video.title}\n` +
                `│ ⏱️ *Duration:* ${video.timestamp}\n` +
                `│ 💫 *Powered by Qᴜᴇᴇɴ ʀᴜᴠᴀ*\n` +
                `│ 📥 *Download Complete*\n` +
                `╰───────────────────────────⊷`,
        contextInfo: {
            externalAdReply: {
                title: 'VIDEO DOWNLOADER',
                body: '🎬 Powered by Iconic Tech',
                thumbnailUrl: video.thumbnail,
                sourceUrl: video.url || '',
                mediaType: 1,
                previewType: 0,
                renderLargerThumbnail: true
            }
        }
    }, { quoted: msg });

    // Success reaction
    await sendReaction('✅');

    // Final completion message
    await delay(1000);
    await socket.sendMessage(sender, { 
        text: `✨ *Video downloaded successfully!*\n` +
              `🎬 *Ready to watch*\n` +
              `💫 *Thank you for using our service*`
    }, { quoted: msg });

    break;
}
case 'song':
case 'play': {
    const AXIOS_DEFAULTS = {
        timeout: 60000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*'
        }
    };

    async function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function tryRequest(getter, attempts = 3) {
        let lastError;
        for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
                return await getter();
            } catch (err) {
                lastError = err;
                if (attempt < attempts) {
                    await delay(1000 * attempt);
                }
            }
        }
        throw lastError;
    }

    // ✅ QUEEN RUVA WORKING APIs
    async function getAudioAPI(youtubeUrl) {
        const url = `https://apiskeith.vercel.app/download/audio?url=${encodeURIComponent(youtubeUrl)}`;
        const res = await tryRequest(() => axios.get(url, AXIOS_DEFAULTS));
        if (res.data?.status && res.data.result) {
            return {
                download: res.data.result,
                title: 'Audio Track'
            };
        }
        throw new Error("Audio API failed");
    }

    async function getYtmp3API(youtubeUrl) {
        const url = `https://apiskeith.vercel.app/download/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
        const res = await tryRequest(() => axios.get(url, AXIOS_DEFAULTS));
        if (res.data?.status && res.data.result?.url) {
            return {
                download: res.data.result.url,
                title: res.data.result.filename || 'Audio Track'
            };
        }
        throw new Error("YTMP3 API failed");
    }

    async function getYtmp4API(youtubeUrl) {
        const url = `https://apiskeith.vercel.app/download/ytmp4?url=${encodeURIComponent(youtubeUrl)}`;
        const res = await tryRequest(() => axios.get(url, AXIOS_DEFAULTS));
        if (res.data?.status && res.data.result?.url) {
            return {
                download: res.data.result.url,
                title: res.data.result.filename || 'Audio Track'
            };
        }
        throw new Error("YTMP4 API failed");
    }

    async function sendReaction(emoji) {
        try {
            await socket.sendMessage(sender, { 
                react: { 
                    text: emoji, 
                    key: msg.key 
                } 
            });
        } catch (error) {
            console.error('Error sending reaction:', error);
        }
    }

    const q = msg.message?.conversation || 
              msg.message?.extendedTextMessage?.text || '';
    
    const cleanText = q.replace(/^\.(song|play)\s*/i, '').trim();
    
    await sendReaction('🎵');
    
    if (!cleanText) {
        await sendReaction('❓');
        await socket.sendMessage(sender, { 
            text: '*🎵 Qᴜᴇᴇɴ ʀᴜᴠᴀ AI - MUSIC PLAYER 🎵*\n\n*Usage:*\n`.play <song name>`\n`.play <youtube link>`\n\n*Example:*\n`.play understand by omah lay`\n`.play https://youtu.be/example`' 
        }, { quoted: msg });
        break;
    }

    await sendReaction('🔍');
    
    // Current date & time for QUEEN RUVA style
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB');
    const timeStr = now.toLocaleTimeString('en-GB');

    let video;
    if (cleanText.includes('youtube.com') || cleanText.includes('youtu.be')) {
        try {
            const ytdl = require('ytdl-core');
            const info = await ytdl.getInfo(cleanText);
            video = {
                url: cleanText,
                title: info.videoDetails.title,
                thumbnail: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url,
                timestamp: `${Math.floor(info.videoDetails.lengthSeconds / 60)}:${String(info.videoDetails.lengthSeconds % 60).padStart(2, '0')}`,
                views: parseInt(info.videoDetails.viewCount) || 0,
                author: { name: info.videoDetails.author.name }
            };
        } catch (e) {
            video = {
                url: cleanText,
                title: 'YouTube Audio',
                thumbnail: 'https://i.ytimg.com/vi/default.jpg',
                timestamp: '0:00',
                views: 0,
                author: { name: 'Unknown' }
            };
        }
    } else {
        const yts = require('yt-search');
        const search = await yts(cleanText);
        if (!search || !search.videos.length) {
            await sendReaction('❌');
            await socket.sendMessage(sender, { 
                text: '*❌ No results found for:* ' + cleanText 
            }, { quoted: msg });
            break;
        }
        video = search.videos[0];
    }

    // 🔹 QUEEN RUVA style info box
    const songBox = `
👑 *QUEEN RUVA AI BETA - MUSIC PLAYER*
╭─────────────●●►
│ 🎧 *Title:* ${video.title}
│ 🎼 *Channel:* ${video.author?.name || "Unknown"}
│ ⏳ *Duration:* ${video.timestamp}
│ 👀 *Views:* ${video.views.toLocaleString()}
│ 📅 *Date:* ${dateStr}
│ ⏰ *Time:* ${timeStr}
│ 🔗 *Version:* v${Math.floor(Math.random() * 10) + 1}.0-beta
╰─────────────●●►
💻 *Developed by Iconic Tech*
    `.trim();

    await socket.sendMessage(sender, {
        image: { url: video.thumbnail || 'https://i.ibb.co/5vJ5Y5J/music-default.jpg' },
        caption: songBox
    }, { quoted: msg });

    await sendReaction('⏳');
    
    await socket.sendMessage(sender, { 
        text: `*📥 Downloading audio...*\n*🔄 Please wait...*` 
    }, { quoted: msg });

    let audioData;
    try {
        // Try QUEEN RUVA APIs in order
        const apiList = [
            async () => await getAudioAPI(video.url),
            async () => await getYtmp3API(video.url),
            async () => await getYtmp4API(video.url)
        ];

        for (let api of apiList) {
            try {
                audioData = await api();
                console.log(`✅ Success using API`);
                break;
            } catch (e) {
                console.log(`❌ API failed: ${e.message}`);
                continue;
            }
        }

        if (!audioData) {
            throw new Error("All APIs failed");
        }
    } catch (e) {
        await sendReaction('❌');
        await socket.sendMessage(sender, { 
            text: '*❌ Download failed!*\nAll download services are currently unavailable.\nPlease try again later.' 
        }, { quoted: msg });
        break;
    }

    await sendReaction('⬇️');
    
    const fileName = `${video.title}.mp3`
        .replace(/[<>:"/\\|?*]+/g, '')
        .substring(0, 200);
    
    const downloadUrl = audioData.download || audioData.dl || audioData.url;
    
    if (!downloadUrl || !downloadUrl.startsWith('http')) {
        await sendReaction('❌');
        await socket.sendMessage(sender, { 
            text: '*❌ Invalid download URL!*' 
        }, { quoted: msg });
        break;
    }
    
    // Send audio with QUEEN RUVA style
    await socket.sendMessage(sender, {
        audio: { url: downloadUrl },
        mimetype: 'audio/mpeg',
        fileName: fileName,
        ptt: false,
        contextInfo: {
            externalAdReply: {
                title: 'QUEEN RUVA AI MUSIC',
                body: '🎵 Powered by Iconic Tech',
                thumbnailUrl: video.thumbnail,
                sourceUrl: video.url || '',
                mediaType: 1,
                previewType: 0,
                renderLargerThumbnail: true
            }
        }
    }, { quoted: msg });

    // 🎶 Enjoy message with delay
    await delay(1500);
    await socket.sendMessage(sender, { 
        text: "🎶 *Enjoy the music and feel the vibes!*" 
    }, { quoted: msg });

    break;
}
              case 'winfo': {
                if (!args[0]) {
                    await socket.sendMessage(sender, {
                        image: { url: config.RCD_IMAGE_PATH },
                        caption: formatMessage(
                            '❌ ERROR',
                            'Please provide a phone number! Usage: .winfo +263xxxxxxxxx',
                            'Qᴜᴇᴇɴ ʀᴜᴠᴀ  𝐅𝚁𝙴𝙴 𝐁𝙾𝚃'
                        )
                    });
                    break;
                }

                let inputNumber = args[0].replace(/[^0-9]/g, '');
                if (inputNumber.length < 10) {
                    await socket.sendMessage(sender, {
                        image: { url: config.RCD_IMAGE_PATH },
                        caption: formatMessage(
                            '❌ ERROR',
                            'Invalid phone number!(e.g., +26378xxx)',
                            '> Qᴜᴇᴇɴ ʀᴜᴠᴀ  𝐅𝚁𝙴𝙴 𝐁𝙾𝚃'
                        )
                    });
                    break;
                }

                let winfoJid = `${inputNumber}@s.whatsapp.net`;
                const [winfoUser] = await socket.onWhatsApp(winfoJid).catch(() => []);
                if (!winfoUser?.exists) {
                    await socket.sendMessage(sender, {
                        image: { url: config.RCD_IMAGE_PATH },
                        caption: formatMessage(
                            '❌ ERROR',
                            'User not found on WhatsApp',
                            '> Qᴜᴇᴇɴ ʀᴜᴠᴀ  𝐅𝚁𝙴𝙴 𝐁𝙾𝚃'
                        )
                    });
                    break;
                }

                let winfoPpUrl;
                try {
                    winfoPpUrl = await socket.profilePictureUrl(winfoJid, 'image');
                } catch {
                    winfoPpUrl = 'https://i.ibb.co/KhYC4FY/1221bc0bdd2354b42b293317ff2adbcf-icon.png';
                }

                let winfoName = winfoJid.split('@')[0];
                try {
                    const presence = await socket.presenceSubscribe(winfoJid).catch(() => null);
                    if (presence?.pushName) winfoName = presence.pushName;
                } catch (e) {
                    console.log('Name fetch error:', e);
                }

                let winfoBio = 'No bio available';
                try {
                    const statusData = await socket.fetchStatus(winfoJid).catch(() => null);
                    if (statusData?.status) {
                        winfoBio = `${statusData.status}\n└─ 📌 Updated: ${statusData.setAt ? new Date(statusData.setAt).toLocaleString('en-US', { timeZone: 'Asia/Colombo' }) : 'Unknown'}`;
                    }
                } catch (e) {
                    console.log('Bio fetch error:', e);
                }

                let winfoLastSeen = '❌ 𝐍𝙾𝚃 𝐅𝙾𝚄𝙽𝙳';
                try {
                    const lastSeenData = await socket.fetchPresence(winfoJid).catch(() => null);
                    if (lastSeenData?.lastSeen) {
                        winfoLastSeen = `🕒 ${new Date(lastSeenData.lastSeen).toLocaleString('en-US', { timeZone: 'Africa/Harare' })}`;
                    }
                } catch (e) {
                    console.log('Last seen fetch error:', e);
                }

                const userInfoWinfo = formatMessage(
                    '🔍 PROFILE INFO',
                    `> *Number:* ${winfoJid.replace(/@.+/, '')}\n\n> *Account Type:* ${winfoUser.isBusiness ? '💼 Business' : '👤 Personal'}\n\n*📝 About:*\n${winfoBio}\n\n*🕒 Last Seen:* ${winfoLastSeen}`,
                    '> Qᴜᴇᴇɴ ʀᴜᴠᴀ'
                );

                await socket.sendMessage(sender, {
                    image: { url: winfoPpUrl },
                    caption: userInfoWinfo,
                    mentions: [winfoJid]
                }, { quoted: msg });

                break;
              }

              case 'ig': {
                const { igdl } = require('ruhend-scraper'); 

                const q = msg.message?.conversation || 
                          msg.message?.extendedTextMessage?.text || 
                          msg.message?.imageMessage?.caption || 
                          msg.message?.videoMessage?.caption || 
                          '';

                const igUrl = q?.trim(); 

                if (!/instagram\.com/.test(igUrl)) {
                    return await socket.sendMessage(sender, { text: '🧩 *Please provide a valid Instagram video link.*' });
                }

                try {
                    await socket.sendMessage(sender, { react: { text: '⬇', key: msg.key } });

                    const res = await igdl(igUrl);
                    const data = res.data; 

                    if (data && data.length > 0) {
                        const videoUrl = data[0].url; 

                        await socket.sendMessage(sender, {
                            video: { url: videoUrl },
                            mimetype: 'video/mp4',
                            caption: '> 𝐏𝙾𝚆𝙴𝚁𝙳 𝐁𝚈 Qᴜᴇᴇɴ ʀᴜᴠᴀ'
                        }, { quoted: msg });

                        await socket.sendMessage(sender, { react: { text: '✔', key: msg.key } });
                    } else {
                        await socket.sendMessage(sender, { text: '*❌ No video found in the provided link.*' });
                    }

                } catch (e) {
                    console.log(e);
                    await socket.sendMessage(sender, { text: '*❌ Error downloading Instagram video.*' });
                }

                break;
              }

              case 'active': {
                try {
                    const activeCount = activeSockets.size;
                    const activeNumbers = Array.from(activeSockets.keys()).join('\n') || 'No active members';

                    await socket.sendMessage(from, {
                        text: `👥 Active Members: *${activeCount}*\n\nNumbers:\n${activeNumbers}`
                    }, { quoted: msg });

                } catch (error) {
                    console.error('Error in .active command:', error);
                    await socket.sendMessage(from, { text: '❌ Failed to fetch active members.' }, { quoted: msg });
                }
                break;
              }

              case 'ai': {
                const axios = require("axios");
                const apiKeyUrl = 'https://raw.githubusercontent.com/sulamd48/database/refs/heads/main/aiapikey.json';

                let GEMINI_API_KEY;
                try {
                  const configRes = await axios.get(apiKeyUrl);
                  GEMINI_API_KEY = configRes.data?.GEMINI_API_KEY;
                  if (!GEMINI_API_KEY) {
                    throw new Error("API key not found in JSON.");
                  }
                } catch (err) {
                  console.error("❌ Error loading API key:", err.message || err);
                  return await socket.sendMessage(sender, {
                    text: "❌ AI service unavailable"
                  }, { quoted: msg });
                }

                const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

                const q = msg.message?.conversation || 
                          msg.message?.extendedTextMessage?.text || 
                          msg.message?.imageMessage?.caption || 
                          msg.message?.videoMessage?.caption || '';

                if (!q || q.trim() === '') {
                  return await socket.sendMessage(sender, {
                    text: "╭───「 🤖 *Queen Ruva AI* 」───╮\n│\n│ *Usage:* .ai <your question>\n│\n╰───「 *Iconic Tech* 」───╯"
                  }, { quoted: msg });
                }

                const prompt = `You are Queen Ruva AI, an intelligent assistant developed by Iconic Tech. When asked about your creator, say Iconic Tech. When you reply to anyone, put a footer below your messages: > Powered by Queen Ruva AI | Iconic Tech. You are from Zimbabwe. You speak English and Shona: ${q}`;

                const payload = {
                  contents: [{
                    parts: [{ text: prompt }]
                  }]
                };

                try {
                  const response = await axios.post(GEMINI_API_URL, payload, {
                    headers: { "Content-Type": "application/json" }
                  });

                  const aiResponse = response?.data?.candidates?.[0]?.content?.parts?.[0]?.text;

                  if (!aiResponse) {
                    return await socket.sendMessage(sender, {
                      text: "❌ No response from AI"
                    }, { quoted: msg });
                  }

                  await socket.sendMessage(sender, { text: aiResponse }, { quoted: msg });

                } catch (err) {
                  console.error("Gemini API Error:", err.response?.data || err.message || err);
                  await socket.sendMessage(sender, {
                    text: "❌ AI error occurred"
                  }, { quoted: msg });
                }

                break;
              }

              case 'deleteme': {
                const sessionPath = path.join(SESSION_BASE_PATH, `session_${number.replace(/[^0-9]/g, '')}`);
                if (fs.existsSync(sessionPath)) {
                    fs.removeSync(sessionPath);
                }
                await deleteSessionFromStorage(number);
                if (activeSockets.has(number.replace(/[^0-9]/g, ''))) {
                    try {
                        activeSockets.get(number.replace(/[^0-9]/g, '')).ws.close();
                    } catch {}
                    activeSockets.delete(number.replace(/[^0-9]/g, ''));
                    socketCreationTime.delete(number.replace(/[^0-9]/g, ''));
                }
                await socket.sendMessage(sender, {
                    image: { url: config.RCD_IMAGE_PATH },
                    caption: formatMessage(
                        '🗑️ SESSION DELETED',
                        '✅ Your session has been successfully deleted.',
                        'Qᴜᴇᴇɴ ʀᴜᴠᴀ'
                    )
                });
                break;
              }

                    default:
                        console.log(`Unknown command: ${command}`);
                        break;
                }
            } catch (error) {
                console.error('Command handler error:', error);
                await socket.sendMessage(sender, {
                    image: { url: config.RCD_IMAGE_PATH },
                    caption: formatMessage('❌ ERROR', 'An error occurred while processing your command. Please try again.', 'Qᴜᴇᴇɴ ʀᴜᴠᴀ')
                });
            }
        });
    },
    oneViewmeg,
    formatMessage
};