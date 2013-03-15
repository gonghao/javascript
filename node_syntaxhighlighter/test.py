#!/usr/bin/env python
import socket

HOST = 'localhost'
PORT = 9595
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.connect((HOST, PORT))

buf = bytearray(b' ' * 2)

f = open('index.html', 'r')
raw_data = f.read()
length = len(raw_data) + 2
buf[0] = length & 255
buf[1] = length >> 8

s.send('%s%s' % (buf, raw_data))

s.recv_into(buf, 2)
length = buf[0] + (buf[1] << 8) - 2

data = ''
while len(data) < length:
    chunk = s.recv(length - len(data))
    if chunk == '':
        raise RuntimeError("socket connection broken")
    data = data + chunk

s.close()
f.close()

f = open('highlight.html', 'w')
f.write(data)
f.close()
