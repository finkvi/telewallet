require("console-stamp")(console, {
    pattern:"dd.mm.yyyy HH:MM:ss.l",
    metadata:'[' + process.pid + ']',
});

//###
const botenv= process.env.BOTCONF || 'EthWalletDev_bot';
console.info('BOTCONF: %s', botenv);
const conf = require('./conf');
const botconf = conf.bot[botenv];
//###

var Web3 = require('web3');
var web3 = new Web3();
web3.setProvider(new web3.providers.HttpProvider(botconf.nodeurl));

const TelegramBot = require('node-telegram-bot-api');
const TOKEN = botconf.telegram_token;
const options = {
  webHook: {
    port: botconf.port
  }
};

const url = botconf.telegram_url;
const bot = new TelegramBot(TOKEN, options);

console.info('Bot WebHook %s сreating...', url);
bot.setWebHook(`${url}/bot${TOKEN}`).then(
    function(){
        console.info('WebHook created');
        startBot();
    },
    function(err){
        console.error(err);
        //Падаем
        process.exit(1);
    }  
);

function startBot() {
    bot.onText(/\/start/, function (msg) {
        console.log('Chat %s. Received command /start', msg.chat.id);
        console.log('Chat %s. Generate wallet from user id and chat id', msg.chat.id);
        var addr = generateAddresss (getPrivateKeyForChat(msg.chat.id, msg.from.id));
        bot.sendMessage(msg.chat.id, addr).then(function(regmsg){
            console.log ('Chat %s. Send message %s', regmsg.chat.id, regmsg.text.replace(/\r?\n|\r/g, ''));  
            createQR(msg.chat.id, addr);
        });
    });
    
    bot.onText(/\/balance/, function (msg) {
        console.log('Chat %s. Received command /balance', msg.chat.id);
        var addr = generateAddresss (getPrivateKeyForChat(msg.chat.id, msg.from.id));
        var b = getBalance(addr);
        bot.sendMessage(msg.chat.id, 'Баланс вашего кошелька: ' + web3.fromWei(b) + ' ETH').then(function(regmsg){
            console.log ('Chat %s. Send message %s', regmsg.chat.id, regmsg.text.replace(/\r?\n|\r/g, ''));
        });
    });
    
    bot.onText(/\/send/, function (msg) {
        console.log('Chat %s. Received command /send', msg.chat.id);
        var addr = generateAddresss (getPrivateKeyForChat(msg.chat.id, msg.from.id));
        var b = getBalance(addr);
        bot.sendMessage(msg.chat.id, 'Баланс вашего кошелька: ' + web3.fromWei(b) + ' ETH').then(function(regmsg){
            console.log ('Chat %s. Send message %s', regmsg.chat.id, regmsg.text.replace(/\r?\n|\r/g, ''));
        });
    });
    
    //Общий вход для всех коллбэков
    bot.on('callback_query', function (msg) {
        console.log('Chat %s. Received callback_query with data %s', msg.message.chat.id, msg.data.replace(/\r?\n|\r/g, ''));
    });
    
    bot.on('message', function (msg) {
        if (msg.voice) {
            console.log('Chat %s. Received VOICE', msg.chat.id, JSON.stringify(msg.voice));
            if (msg.voice.file_size >= 1024 * 1024) {
                console.log('Chat %s. Too big voice file', msg.chat.id);
                bot.sendMessage(msg.chat.id, 'Слишком длинная запись, попробуйте ещё раз').then(function(regmsg){
                  console.log ('Chat %s. Send message %s', regmsg.chat.id, regmsg.text.replace(/\r?\n|\r/g, ''));  
                });
            }
            else {
                bot.getFileLink(msg.voice.file_id)
                .then(function(url){
                    console.log('Chat %s. File link %s', msg.chat.id, url);
                    
                    var y = require('./ya.js');
                    y(url, function(txt) {
                        if (txt) {
                            console.log('Chat %s. Text result %s', msg.chat.id, txt);
                            bot.sendMessage(msg.chat.id, txt).then(function(regmsg){
                              console.log ('Chat %s. Send message %s', regmsg.chat.id, regmsg.text.replace(/\r?\n|\r/g, ''));  
                            });
                        }
                        else {
                            console.log('Chat %s. Cann\'t get text result, try again...', msg.chat.id);
                            bot.sendMessage(msg.chat.id, 'Не удалось разобрать, попробуйте ещё раз').then(function(regmsg){
                              console.log ('Chat %s. Send message %s', regmsg.chat.id, regmsg.text.replace(/\r?\n|\r/g, ''));  
                            });
                        }
                    });
                })
                .catch(function(err){
                    console.error('Chat %s. Get File link problem %s', msg.chat.id, err);
                });
            }
        }
        if (msg.photo) {
            var goodQuality,
                maxSize = 0;
            for (var i = 0; i < msg.photo.length; i++) {
                if (maxSize < msg.photo[i].file_size) {
                    maxSize = msg.photo[i].file_size;
                    goodQuality = msg.photo[i];
                } 
            }
            
            if (goodQuality) {
                bot.getFileLink(goodQuality.file_id)
                .then(function(url){
                    console.log('Chat %s. File link %s', msg.chat.id, url);
                    
                    var qrapi = 'https://api.qrserver.com/v1/read-qr-code/?fileurl=';
                    var https = require('https');
                    
                    https.get(qrapi + url, function (res){
                        var body = "";
                        
                        res.on('data', function(d){
                            body += d;
                        });
                        
                        res.on('end', function(){
                            try {
                                var data = JSON.parse(body);
                                
                                if (data && data.length === 1) {
                                    if (data[0].symbol && data[0].symbol.length === 1) {
                                        if (!data[0].symbol[0].error) {
                                            console.log(data[0].symbol[0].data);
                                        }
                                        else {
                                            throw new Error(data[0].symbol[0].error);
                                        }
                                    }
                                    else {
                                        throw new Error('Parce QR Code response problem');
                                    }
                                }
                                else {
                                    throw new Error('Parce QR Code response problem');
                                }
                            } catch (e) {
                                console.error('Chat %s. Error QR Read: %s',  msg.chat.id, e);
                            }
                        });
                    }).on('error', function (e){
                        console.error('Chat %s. Error QR Read: %s',  msg.chat.id, e);
                    });
                })
                .catch(function(err){
                    console.error('Chat %s. Get File link problem %s', msg.chat.id, err);
                });
            }
        }
    });
}

function getPrivateKeyForChat (chatid, userid){
    var util = require('ethereumjs-util');
    return util.sha3(
                util.bufferToHex(
                        util.sha256(chatid.toString() + userid.toString())
                    )
                + userid.toString());
}

function generateAddresss (prvKey) {
    var util = require('ethereumjs-util');
    return util.bufferToHex(util.privateToAddress(prvKey));
}

function createQR(chatid, address) {
    var qrapi = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=';
    
    bot.sendPhoto(chatid, qrapi+address, {caption: address}).then(function(regmsg){
        console.log ('Chat %s. Send QR Code and Address', regmsg.chat.id);  
        var s = 'Это адрес вышего кошелька. Он уникален для вас в рамках этого чата\n';
            s+= 'Вы можете пополнить его через биржу командой /buy или любым другим способом\n';
            s+= 'Вы можете отправить транзакцию, используя команду /send \n';
            s+= 'Для проверки баланса используйте команду /balance \n';
            s+= '(Чтобы использовать кошелек в другом приложении или сделать его резервную копию выполните /export)';
        bot.sendMessage(chatid, s).then(function(regmsg){
            console.log ('Chat %s. Send message %s', regmsg.chat.id, regmsg.text.replace(/\r?\n|\r/g, ''));
        });
    });
}

function getBalance (address){
    try {
        var balance = web3.eth.getBalance(address);
        return balance;
    } catch (e) {
        console.error("Error connecting to Ethereum Node");
        console.error(e);
        return 0;
    }
}