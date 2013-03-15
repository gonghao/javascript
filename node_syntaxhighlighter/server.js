var net = require('net'),
    highlight = require('./highlight').highlight;

var server = net.createServer();

server.listen(9595, 'localhost', function() {
    address = server.address();
    console.log("opened server on %j", address);
});

function encodeData(data) {
    var header = Buffer(2),
        body = Buffer(data),
        buf = Buffer(header.length + body.length);

    header.writeUInt16LE(header.length + body.length, 0);
    header.copy(buf);
    body.copy(buf, header.length);

    return buf;
}

function decodeData(data) {
    return {
        length: data.readUInt16LE(0) - 2,
        data: data.slice(2)
    };
}

function handleData(data) {
    return highlight(data);
}

server.on('connection', function(client) {
    var dataInfo, chunks, pos = 0, html = '';

    client.on('data', function(data) {
        // first call
        if (dataInfo === undefined) {
            dataInfo = decodeData(data);
            chunks = new Buffer(dataInfo.length);
            dataInfo.data.copy(chunks, pos);
            pos += dataInfo.data.length;
        } else {
            if (pos < dataInfo.length) {
                data.copy(chunks, pos);
                pos += data.length;
            } else {
                client.end('wrong data');
                console.log('wrong data');
            }
        }

        if (pos === dataInfo.length) {
            html = handleData(chunks.toString());
            html = encodeData(html);
            client.end(html);
        }
    });

});
