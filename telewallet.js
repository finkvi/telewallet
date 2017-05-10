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

//Store for keys in memory
var prKeys = require('memory-cache');
var utilETH = require('ethereumjs-util');

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
    //Запуск бота для создания нового кошелька
    bot.onText(/^\/start$/, function (msg) {
        console.log('Chat %s. Received command ' + msg.text, msg.chat.id);
        console.log('Chat %s. Generate wallet from user id and chat id', msg.chat.id);
        var entropy = prKeys.get(msg.chat.id.toString() + msg.from.id.toString());
        
        if (!entropy) {
            createNewWallet(msg.chat.id, msg.from);
        }
        else{
            showWalletInfo(msg.chat.id, msg.from, entropy);
        }
    });
    
    //Открытие по ссылке
    bot.onText(/^\/start /, function (msg) {
        var txt = msg.text;
        var entropy = msg.text.substr(7);
        console.log(entropy);
        var addr = getAddresss (getPrivateKeyForChat(msg.chat.id, msg.from.id, entropy));
        bot.sendMessage(msg.chat.id, 'Ваш кошелёк:\n' + addr + '\nРазлочен').then(function(regmsg){
            console.log ('Chat %s. Send message %s', regmsg.chat.id, regmsg.text.replace(/\r?\n|\r/g, ''));
        });
    });
    
    //Проверка баланса
    bot.onText(/^\/balance$/, function (msg) {
        console.log('Chat %s. Received command ' + msg.text, msg.chat.id);
        var entropy = prKeys.get(msg.chat.id.toString() + msg.from.id.toString());
        if (entropy) {
            var addr = getAddresss (getPrivateKeyForChat(msg.chat.id, msg.from.id, entropy));
            var b = getBalance(addr);
            bot.sendMessage(msg.chat.id, 'Номер кошелька: ' + addr + '\n' 
                                        + 'Баланс кошелька: ' + web3.fromWei(b) + ' ETH').then(function(regmsg){
                console.log ('Chat %s. Send message %s', regmsg.chat.id, regmsg.text.replace(/\r?\n|\r/g, ''));
            });
        }
        else {
            bot.sendMessage(msg.chat.id, 'Нет разлоченного кошелька. Перейдите в чат по приватной ссылке').then(function(regmsg){
                console.log ('Chat %s. Send message %s', regmsg.chat.id, regmsg.text.replace(/\r?\n|\r/g, ''));
            });
        }
    });
    
    //Отправка денег
    bot.onText(/^\/send$/, function (msg) {
        console.log('Chat %s. Received command /send', msg.chat.id);
        var addr = getAddresss (getPrivateKeyForChat(msg.chat.id, msg.from.id));
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

function getPrivateKeyForChat (chatid, userid, entropy){
    prKeys.put(chatid.toString() + userid.toString(), entropy, botconf.locktimeout, function (key, value){
        bot.sendMessage(chatid, 'Ваш кошелек залочен, так как вы были неактивны, перейдите по приватной ссылке, чтобы вновь разлочить его').then(function(regmsg){
            console.log ('Chat %s. Send message %s', regmsg.chat.id, regmsg.text.replace(/\r?\n|\r/g, ''));
        });
    });
    return utilETH.sha3(chatid.toString() + userid.toString() + entropy.toString());
}

function getAddresss (prvKey) {
    return utilETH.bufferToHex(utilETH.privateToAddress(prvKey));
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

//Показать информацию о кошельке
function showWalletInfo (chatid, user, entropy) {
    var addr = getAddresss (getPrivateKeyForChat(chatid, user.id, entropy));
    
    bot.sendMessage(chatid, addr).then(function(regmsg){
        console.log ('Chat %s. Send message %s', chatid, regmsg.text.replace(/\r?\n|\r/g, ''));  
        var userFullName = user.first_name 
                        + ((user.last_name) ? ' ' + user.last_name : '')
                        + ((user.username) ? ' @' + user.username : '');
        createQR(chatid, userFullName, addr);
    });
}

function createQR(chatid, userFullName, address) {
    var qrapi = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=';
    
    bot.sendPhoto(chatid, qrapi+address, {caption: address}).then(function(regmsg){
        console.log ('Chat %s. Send QR Code and Address', regmsg.chat.id);  
        var s = 'Это адрес вашего кошелька. Он уникален для Вас:\n';
            s+= userFullName +' и с помощью бота им можно пользоваться только рамках этого чата\n';
            s+= 'Вы можете пополнить его через биржу командой /buy или любым другим способом\n';
            s+= 'Вы можете отправить транзакцию, используя команду /send\n';
            s+= 'Для проверки баланса используйте команду /balance\n';
            s+= '(Чтобы использовать кошелек в другом приложении или сделать его резервную копию выполните /export)\n';
            s+= 'Будте аккуратны, тот, кто имеет доступ к чату от Вашего имени сможет управлять кошельком\n';
            s+= 'После любой операции кошелек будет разлочен в течении 5 минут\n';
            s+= 'Если Вы не получили ссылку по SMS или почте для разблокировки. НЕ пользуйтесь этим кошелком, Вы не сможете его разблокировать!!!\n';
            
        bot.sendMessage(chatid, s).then(function(regmsg){
            console.log ('Chat %s. Send message %s', regmsg.chat.id, regmsg.text.replace(/\r?\n|\r/g, ''));
            //Покаже ещё и баланс
            var b = getBalance(address);
            bot.sendMessage(chatid, 'Баланс кошелька: ' + web3.fromWei(b) + ' ETH').then(function(regmsg){
                console.log ('Chat %s. Send message %s', regmsg.chat.id, regmsg.text.replace(/\r?\n|\r/g, ''));
            });
        });
    });
}
//Создаем новый кошелек для чата и пользователя
function createNewWallet (chatid, user) {
    //Генерируем энтропию для нового кошелька
    var randomstring = require('randomstring');
    var entropy = randomstring.generate(32);
    console.log(entropy);
    var link = 'https://t.me/' + botenv + '?start=' + entropy;
    var linktxt = 'Ваша приватная ссылка для кошелька: ' + link;
    
    var opts = {
      reply_markup: JSON.stringify(
        {
          force_reply: true
        }
      )};
    
    var s = 'Сейчас я создам для Вас кошелёк. Принцип его использования не совсем очевиден, постарайтесь внимательно прочитать это текст\n';
        s+= 'Перед созданием мне потребуется Ваша почта или номер телефона. Не волнуйтесь, я их нигде не сохраню и не буду использовать\n';
        s+= 'Я всего лишь отправлю на эти контакты авторизационную ссылку, по которой вы сможете управлять кошельком через меня\n';
        s+= 'Храните эту ссылку в тайне, так как зная её и Ваш идентификатор в Telegram любой может сгенерировать ключ к Вашему кошельку\n';
        
        
    bot.sendMessage(chatid, s, opts).then(function(regmsg) {
        console.log ('Chat %s. Send message %s', regmsg.chat.id, regmsg.text.replace(/\r?\n|\r/g, ''));
        bot.sendMessage(chatid, 'Укажите номер телефона или адрес электронной почты', opts).then(function(regmsg) {
            console.log ('Chat %s. Waiting replay for contacts request', regmsg.chat.id);
            bot.onReplyToMessage(chatid, regmsg.message_id, function (contactmsg) {
                console.log ('Chat %s. Received replay %s', contactmsg.chat.id, contactmsg.text);
                if (contactmsg.text){
                    var presubj = (contactmsg.chat.title) ? contactmsg.chat.title : (user.first_name + ((user.last_name) ? ' ' + user.last_name : ''));
                    
                    var reEmail = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                    if (reEmail.test(contactmsg.text)) {
                        
                        sendEmail(contactmsg.chat.id, contactmsg.from, contactmsg.text, 
                            '[' +  presubj + '] - Приватная ссылка для Вашего Ethereum кошелька', linktxt, function (err){
                            if (!err) showWalletInfo (chatid, user, entropy);
                        });
                    }
                    else{
                        var phone = require('phone');
                        var p = phone(contactmsg.text);
                        if (p.length && p[1] == 'RUS') {
                            sendSMS(contactmsg.chat.id, contactmsg.from, p[0], '[' +  presubj + '] ' + link, function(err, chatid, user){
                                if (!err) showWalletInfo (chatid, user, entropy);
                            });
                        }
                        else {
                            bot.sendMessage(chatid, 'Это не похоже не на почту, не на телефон', {reply_to_message_id: contactmsg.message_id}).then(function(regmsg) {
                                console.log ('Chat %s. Bad answer for Contact Request', regmsg.chat.id);
                            });
                        }
                    }
                }
            });
        });
    });
}

function sendSMS (chatid, user, tel, txt, callback){
    console.log ('Chat %s. Sending SMS to %s', chatid, tel);
    
    if (conf.sms.ThrowTwilio) {
        //Отправка через Twilio
        var accountSid = conf.sms.Twilio.accountSid; 
        var authToken = conf.sms.Twilio.authToken; 
         
        var client = require('twilio')(accountSid, authToken); 
         
        client.messages.create({ 
            to: tel, 
            from:  conf.sms.Twilio.from, 
            body: txt, 
        }, function(err, message) { 
            if (err) {
                console.error ('Chat %s. Error SMS send on SMS GateWay: %s', chatid, err);
                if (typeof (callback) === 'function') callback(err);
            }
            else {
                console.log ('Chat %s. SMS Sent Succesfuly', chatid);
                if (typeof (callback) === 'function') callback(null, chatid, user);
            }
        });
    }
    else {
        //Отправка по http через bytehand
        var http = require('http');
        var qs = require('querystring');
        
        var params = {};
        params['id'] = conf.sms.HttpGet.id;
        params['key'] = conf.sms.HttpGet.key;
        params['from'] = conf.sms.HttpGet.from;
        params['to'] = tel;
        params['text'] = txt;
        var url = conf.sms.HttpGet.url + '?' + qs.stringify(params);
        
        http.get(url, function (res) {
            var body = "";
            res.on('data', function(data) {
                body += data;
            });
            
            res.on('end', function() {
                try {
                    var data = JSON.parse(body);
                    
                    if (data.status == 0) {
                        console.log ('Chat %s. SMS Sent Succesfuly', chatid);
                        if (typeof (callback) === 'function') callback(null, chatid, user);
                    }
                    else {
                        console.error ('Chat %s. Error SMS send on SMS GateWay: %s', chatid, data.description);
                        if (typeof (callback) === 'function') callback(new Error(data.description));
                    }
                }
                catch (e){
                    console.error ('Chat %s. Error parse SMS Send Call: %s', chatid, e);
                    if (typeof (callback) === 'function') callback(e);
                }
            });
        }).on('error', function (e) {
            console.error ('Chat %s. Error send SMS: %s', chatid, e);
            if (typeof (callback) === 'function') callback(e);
        });
    }
}

function sendEmail(chatid, user, email, subj, txt, callback){
    console.log ('Chat %s. Sending Email to %s', chatid, email);
    
    const nodemailer = require('nodemailer');
    var transporter;
    (conf.mail.ThrowPostfix) ? transporter = nodemailer.createTransport(conf.mail.Postfix) 
                            : transporter = nodemailer.createTransport(conf.mail.Direct);
    
    transporter.verify(function(error, success) {
        if (error) {
            console.error ('Chat %s. Error create Email Transport: %s', chatid, error);
            if (typeof (callback) === 'function') callback(error);
        } 
        else {
            console.log ('Chat %s. Server is ready to take our messages', chatid);
            
            var mailOptions = {
                from: '"Ethereum Wallet" <ethwallet@j2u.ru>',
                to: email,
                subject: subj,
                text: txt
            };
            
            transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    console.error ('Chat %s. Error send Email: %s', chatid, error);
                    if (typeof (callback) === 'function') callback(error);
                } 
                else {
                    console.log('Chat %s. Message %s sent: %s', chatid, info.messageId, info.response);
                    if (typeof (callback) === 'function') callback(null, chatid, user);
                }
            });
        }
    });
}