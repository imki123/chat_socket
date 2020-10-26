var app = require('express')()
var http = require('http').createServer(app)
var io = require('socket.io')(http)

//open file
app.get('/', (req, res) => {
	res.sendFile(__dirname + '/index.html')
})

const msgs = []

//make io
io.on('connection', (socket) => {
	let address = socket.handshake.address //get IP
	address = address === '::1' ? 'admin' : 'guest' + address.split(':')[3].substring(7)

	//접속한 사람에게 저장된 메시지를 방출(emit), 인사문구
	io.to(socket.id).emit('get msgs', msgs)
	io.to(socket.id).emit('new connect', `${address}님 환영합니다 :D`)

	//나를 제외한 전체에게 접속한 사람 address를 방출
	socket.broadcast.emit('new connect', `${address}님이 접속하셨습니다.`)

	//메시지 입력 받으면 메시지를 msgs에 저장하고 입력 받은 메시지를 방출(emit)
	socket.on('chat message', (msg) => {
		msgs.push({ address, msg }) //msgs에 메시지들 저장
		io.emit('chat message', { address, msg })
	})
})

//open Server
const port = process.env.PORT || 4000
http.listen(port, () => {
	console.log(`Listening on port: ${port}\nConnect to http://localhost:${port}`)
})
