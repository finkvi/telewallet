require("console-stamp")(console, {
    pattern:"dd.mm.yyyy HH:MM:ss.l",
    metadata:'[' + process.pid + ']',
});

var https = require('https');
var uuid = require('uuid');
var qs = require('querystring');
var request = require('request');
var parser = require('xml2json');

const YANDEX_ASR_URL = 'https://asr.yandex.net/asr_xml?';
const developer_key = '0842e6b6-7b59-47fc-a4cb-5a8bd6d4b98c';
const filetype = 'audio/ogg;codecs=opus';
const lang = 'ru-RU';
const topic = 'notes';

var YaASR = function (url, callback) {
    https.get(url, function (res) {
        
        var body = '';
        
        res.on('data', function (d) {
            body += d;
        });
        
        res.on('end', function() {
            var params = {};
            
            params['key'] = developer_key;
            params['uuid'] = uuid.v4().replace(/-/g,'');
            params['topic'] = topic;
            params['lang'] = lang;
        
            var full_url = YANDEX_ASR_URL + qs.stringify(params);
            
            var r = request.post({url: full_url}, function(err, res, xml){
                if(err){
            		console.error(err);
            		if (typeof(callback) == 'function') callback(false);
            	}
            	else{
            		var opt = {
                        object: true,
                        reversible: false,
                        coerce: false,
                        sanitize: true,
                        trim: true,
                        arrayNotation: false,
                        alternateTextNode: false
                    };
            		try {
                		var j = parser.toJson(xml, opt);
                		if (j.recognitionResults) {
                		    if (j.recognitionResults.success == '1'){
                		        if (typeof(callback) == 'function') callback(j.recognitionResults.variant[0].$t);
                		    }
                		    else {
                		        console.log('No results');
                		        if (typeof(callback) == 'function') callback(false);
                		    }
                		}
                		else {
                		    console.log('No results');
                		    if (typeof(callback) == 'function') callback(false);
                		}
            		}
                	catch (e) {
                	    console.error('Error XML parser...', e);
                	    console.error('XML for ya: ', xml);
                	    if (typeof(callback) == 'function') callback(false);
                	}
            	}
            });
            
            var form = r.form();
            form.append('Content-Type', filetype);
            form.append('audio', body);
        });
    }).on('error', function (e) {
      console.error(e);
      if (typeof(callback) == 'function') callback(false);
    });
};

module.exports = YaASR;