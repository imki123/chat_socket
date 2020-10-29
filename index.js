const express = require('express')
const app = require('express')()
const favicon = require('express-favicon')
const http = require('http').createServer(app)
const io = require('socket.io')(http)

//open client index
app.get('/', (req, res) => {
	res.sendFile(__dirname + '/index.html')
})

//make io
const origins = ['http://localhost:4000', 'http://127.0.0.1:5500', 'https://socket-imki123.herokuapp.com/']
let msgs = []
const allClients = []
const clients = []
const buttons = ['yellow', true, true, true, true, true, true, true, true, true, true]
const recents = []
const weeks = []
const months = []

io.on('connection', (socket) => {
	//접속 시 접속자 수 증가
	let address = socket.handshake.address //get IP
	let splited = address.split('.')
	address = address === '::1' ? 'admin' : `guest(${splited[2]}.${splited[3]})`

	//버튼 전파
	io.emit('buttons', { buttons, recents, weeks, months })

	//버튼 클릭되면 토글해서 전파
	socket.on('clickButton', (id) => {
		if (!isNaN(Number(id))) {
			buttons[Number(id)] = !buttons[Number(id)]
			let color = buttons[0]
			let changeColor = true
			for (let i = 1; i < buttons.length; i++) {
				if (color === 'yellow') {
					//노랑일땐 OFF를 만들어야하므로
					//true가 하나라도 있으면 changeColor = false
					if (buttons[i]) changeColor = false
				} else {
					if (!buttons[i]) changeColor = false
				}
			}
			//버튼이 모두 같으면 색 변경
			let client, winner
			//색 바꾸기 성공
			if (changeColor) {
				if (buttons[0] === 'yellow') buttons[0] = 'gray'
				else buttons[0] = 'yellow'
				//recents(최근 성공한 사람) 추가하고 emit하기
				client = allClients.filter((i, idx) => i.socket === socket)[0].address
				//최근 성공한 사람이 아니면 최근에 추가.
				if (recents.length === 0 || recents[recents.length - 1].client !== client) {
					winner = true
					let recent = { client: client, date: new Date() }
					recents.push(recent)
					if (recents.length > 5) recents.shift() //최근은 5개까지만
					//weeks에 추가하는데 이미 있으면 count ++
					let weekIdx, monthIdx
					for (let i = 0; i < 5; i++) {
						//weeks 카운트 증가
						if (weeks[i] && weeks[i].client === client) {
							weeks[i].count++
							weekIdx = i
						}
						//months 카운트 증가
						if (months[i] && months[i].client === client) {
							months[i].count++
							monthIdx = i
						}
					}
					//weeks에 없으면 추가하고 count 1
					if (weekIdx === undefined) {
						weeks.push({ ...recent, count: 1 })
					}
					if (monthIdx === undefined) {
						months.push({ ...recent, count: 1 })
					}
					weeks.sort((a, b) => b.count - a.count)
					months.sort((a, b) => b.count - a.count)
				} else if (recents.length > 0 && recents[recents.length - 1].client === client) {
					winner = false
				}
			}
			io.to(socket.id).emit('buttons', { buttons, recents, weeks, months, winner })
			//나를 제외한 전체에게 접속한 사람 address를 방출
			socket.broadcast.emit('buttons', { buttons, recents, weeks, months })
		}
	})

	//접속자 목록 전파
	allClients.push({ socket, address })
	clients.push(address)
	io.emit('allClients', { clients })

	//접속해제 시 접속자 수 감소
	socket.on('disconnect', function () {
		let num = allClients.length
		let client
		allClients.filter((i, idx) => {
			if (i.socket === socket) {
				client = idx
				return true
			} else return false
		})
		let clientAddress
		if (client !== undefined) {
			clientAddress = allClients.splice(client, 1)[0].address
			clients.splice(client, 1)
		}
		socket.broadcast.emit('allClients', { address: clientAddress, clients })
	})

	//접속한 사람에게 저장된 메시지를 방출(emit), 인사문구
	io.to(socket.id).emit('get msgs', msgs)
	io.to(socket.id).emit('new connect', { client: address, isMe: true })

	//나를 제외한 전체에게 접속한 사람 address를 방출
	socket.broadcast.emit('new connect', { client: address, isMe: false })

	//메시지 입력 받으면 메시지를 msgs에 저장하고 입력 받은 메시지를 방출(emit)
	socket.on('chat message', (msg) => {
		let date = new Date()
		//서버에 올리면 한국시간으로 적용.
		if (process.env.NODE_ENV === 'production') {
			date.setHours(date.getHours() + 9) //한국시간 : UTC + 9시간
		}

		let time = date.getFullYear()
		time += date.getMonth() + 1 < 10 ? '/0' + (date.getMonth() + 1) : '/' + (date.getMonth() + 1)
		time += date.getDate() < 10 ? '/0' + date.getDate() : '/' + date.getDate()
		time += date.getHours() < 10 ? ' 0' + date.getHours() : ' ' + date.getHours()
		time += date.getMinutes() < 10 ? ':0' + date.getMinutes() : ':' + date.getMinutes()
		msgs.push({ address, msg, time }) //msgs에 메시지들 저장
		//대화삭제 트리거
		if (msg === '대화삭제') {
			msgs = []
			io.emit('clearMsgs')
		} else {
			io.emit('chat message', { address, msg, time })
		}
	})
})

//open Server
const port = process.env.PORT || 4000
http.listen(port, () => {
	console.log(`Listening on port: ${port}\nConnect to http://localhost:${port}`)
})

//heroku sleep 방지
if (process.env.NODE_ENV === 'production') {
	const myhttp = require('http')
	setInterval(function () {
		myhttp.get('http://socket-imki123.herokuapp.com')
	}, 1000 * 60 * 10) //10분
}
