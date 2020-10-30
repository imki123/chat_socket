const express = require('express')
const app = require('express')()
const server = require('http').createServer(app)
const cookieParser = require('cookie-parser') //라이브러리
const bodyParser = require('body-parser')
const io = require('socket.io')(server, {
	cookie: true,
})
const cors = require('cors')

const buttons = ['yellow', true, true, true, true, true, true, true, true, true, true]
const allClients = []
const clients = []
let blackLists = ['바보야']
let msgs = []
let recents = []
let weeks = []
let months = []

const origins = ['http://localhost:4000', 'http://127.0.0.1:5500', 'http://192.168.0.4:5500', 'https://imki123.github.io', 'https://socket-imki123.herokuapp.com/']
let corsOptions
const corsOptionsDelegate = function (req, callback) {
	if (origins.indexOf(req.header('Origin')) !== -1) {
		corsOptions = {
			origin: true,
			methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
			allowHeaders: ['Origin', 'Access-Control-Request-Method', 'X-Requested-With', 'X-HTTP-Method-Override', 'Content-Type', 'Accept', 'Set-Cookie'],
			credentials: true,
		} // reflect (enable) the requested origin in the CORS response
	} else {
		corsOptions = { origin: false } // disable CORS for this request
	}
	callback(null, corsOptions) // callback expects two parameters: error and options
}
app.use(cookieParser())
app.use(bodyParser.json())
app.use(cors(corsOptionsDelegate))
//open client index
app.get('/', (req, res) => {
	res.sendFile(__dirname + '/index.html')
})

app.post('/getCookie', (req, res) => {
	res.send(req.cookies)
})

app.post('/setCookie', (req, res) => {
	res.cookie('client', req.body.client, { secure: true, sameSite: 'None' })
	res.end('setCookie')
})

//make io
//io에 접속하면 현재 상태 전파
io.on('connection', (socket) => {
	//접속 시 address 만들고 접속자 수 증가
	let address = socket.handshake.address //get IP
	let splited = address.split('.')
	address = address === '::1' ? 'admin' : `guest(${splited[2]}.${splited[3]})`

	//버튼, 기록들 전파
	io.emit('buttons', { buttons, recents, weeks, months })

	//접속자 목록 전파
	allClients.push({ socket, address })
	clients.push(address)
	io.emit('allClients', { clients })

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
			let winner
			//블랙리스트가 아니면 배경색 바꾸기
			if (blackLists.indexOf(address) === -1 && changeColor) {
				if (buttons[0] === 'yellow') buttons[0] = 'gray'
				else buttons[0] = 'yellow'
				//recents(최근 성공한 사람) 추가하고 emit하기
				let clientIdx = findSocketIdx(socket)
				client = allClients[clientIdx].address
				winner = true
				let recent = { client: client, date: new Date() }
				recents.push(recent)
				if (recents.length > 5) recents.shift() //최근은 5개까지만
				//weeks에 추가하는데 이미 있으면 count ++
				let weekIdx, monthIdx
				for (let i = 0; i < weeks.length; i++) {
					//weeks 카운트 증가
					if (weeks[i] && weeks[i].client === client) {
						weeks[i].count++
						weekIdx = i
					}
				}
				for (let i = 0; i < months.length; i++) {
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
				/* //최근 성공한 사람이 아니면 최근에 추가.
				 if (recents.length === 0 || recents[recents.length - 1].client !== client) {
				} else if (recents.length > 0 && recents[recents.length - 1].client === client) {
					winner = false
				} */
			}

			//버튼, 랭킹 정보 전파
			io.to(socket.id).emit('buttons', { buttons, recents, weeks, months, winner })
			socket.broadcast.emit('buttons', { buttons, recents, weeks, months })
		}
	})

	//닉네임 변경시 allClients 변경하고 전파
	socket.on('rename', (client) => {
		console.log('닉네임 변경:', client)
		let clientIdx = findSocketIdx(socket)
		if(clientIdx === undefined){
			allClients.push({socket, address})
			clients.push(client)
		}else{
			allClients[clientIdx].address = client
			clients[clientIdx] = client
		}
		address = client
		if (blackLists.indexOf(client) > -1) {
			//블랙리스트면 닉네임 변경은 되지만 전파하지 않고 클라이언츠에서도 삭제
			allClients.splice(clientIdx, 1)
			clients.splice(clientIdx, 1)
			io.emit('allClients', { clients })
			io.to(socket.id).emit('rename', { client: address, isMe: true })
		} else {
			io.emit('allClients', { clients })
			io.to(socket.id).emit('rename', { client: address, isMe: true })
			socket.broadcast.emit('rename', { client: address, isMe: false })
		}

		
	})

	//접속해제 시 접속자 수 감소
	socket.on('disconnect', function () {
		let num = allClients.length
		//접속해제한 사람 찾아서 제거
		let clientIdx = findSocketIdx(socket)
		let clientAddress
		if (clientIdx !== undefined) {
			clientAddress = allClients.splice(clientIdx, 1)[0].address
			clients.splice(clientIdx, 1)
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
		if (blackLists.indexOf(address) > -1) {
			//닉네임이 블랙리스트에 있으면 채팅 불가
			return
		}
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

		//대화삭제 닉네임 트리거
		if (msg.split(' ')[0] === '대화삭제') {
			let client = msg.split(' ')[1]
			addBlackLists(client, socket)
		} else if (msg.split(' ')[0] === '랭킹삭제') {
			//랭킹삭제 month랭킹번호 트리거
			let rank = Number(msg.split(' ')[1]) - 1
			let client = months[rank].client
			addBlackLists(client, socket)
		} else {
			msgs.push({ address, msg, time }) //msgs에 메시지들 저장
			io.emit('chat message', { address, msg, time })
		}
	})
})

//블랙리스트 추가하기. 접속자 삭제, 대화 삭제, 랭킹 삭제
function addBlackLists(client) {
	//블랙리스트에 추가
	blackLists.push(client) 
	console.log('블랙리스트 등록:',client)

	//접속자에서 삭제
	let clientIdx = findClientIdx(client)
	if(clientIdx !== undefined){
		allClients.splice(clientIdx,1)
		clients.splice(clientIdx,1)
		io.emit('allClients', { clients })
	}

	//채팅창 지우고
	msgs = msgs.filter((i) => i.address !== client)
	io.emit('clearMsgs') 
	setTimeout(function () {
		io.emit('get msgs', msgs) //새로 변경된 메시지 방출
	},100)

	//최근성공, 랭킹에서도 삭제
	recents = recents.filter((i) => i.client !== client)
	weeks = weeks.filter((i) => i.client !== client)
	months = months.filter((i) => i.client !== client)
	io.emit('buttons', { buttons, recents, weeks, months })
}

//client를 받아서 idx찾아내기
function findClientIdx(client) {
	console.log(client)
	let clientIdx
	allClients.filter((i, idx) => {
		if (i.address === client) {
			clientIdx = idx
			return true
		} else return false
	})
	return clientIdx
}

//socket을 받아서 idx찾아내기
function findSocketIdx(socket) {
	let clientIdx
	allClients.filter((i, idx) => {
		if (i.socket === socket) {
			clientIdx = idx
			return true
		} else return false
	})
	return clientIdx
}

//open Server
const port = process.env.PORT || 4000
server.listen(port, () => {
	console.log(`Listening on port: ${port}\nConnect to http://localhost:${port}`)
})

//heroku sleep 방지
if (process.env.NODE_ENV === 'production') {
	const http = require('http')
	setInterval(function () {
		http.get('http://socket-imki123.herokuapp.com')
	}, 1000 * 60 * 10) //10분
}
