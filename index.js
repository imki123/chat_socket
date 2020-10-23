var app = require('express')()
var http = require('http').createServer(app)

app.get('/', (req, res) => {
	res.sendFile(__dirname + '/index.html')
})

const port = process.env.PORT || 4000

app.listen(port, () => {
	console.log(`Listening on port: ${port}\nConnect to http://localhost:${port}`)
})
