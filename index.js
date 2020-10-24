var app = require('express')()
var http = require('http').createServer(app)
var io = require('socket.io')(http)

//open file
app.set('trust proxy', '8.8.8.8')
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html')
})

//make io
io.on('connection', (socket) => {
  let address = socket.handshake.address;
  address = address === '::1' ? 'admin' : 'guest'+address.split(':')[3].substring(7)
	socket.on('chat message', (msg) => {
		io.emit('chat message', {address, msg})
	})
})

//get IP
const getIp = (req) => req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket.remoteAddress

//open Server
const port = process.env.PORT || 4000
http.listen(port, () => {
	console.log(`Listening on port: ${port}\nConnect to http://localhost:${port}`)
})
