//var client = new Colyseus.Client('ws://localhost:2567');
var client = new Colyseus.Client('wss://' + window.location.hostname + ":" + window.location.port);
var Room;
var lastState;
var timer;
var curT;
var igraju;
function joinRoom() {
	updateStatus("joining...","yellow");
	var ime=$( "#ime" ).val();
	if (ime == "") return;
	client.joinOrCreate("zdjela_room", ime).then(room => {
		console.log(room.sessionId, "joined", room.name);
		room.onStateChange((state) => onStateChange(room, state));
		room.onMessage((message) => onMessage(room, message));
		room.onError(() => onError(room));
		room.onLeave(() => onLeave(room));
		Room=room;
//		jitsi= new JitsiMeetExternalAPI('meet.jit.si', {roomName: 'zdjela_'+room.id, width: '100%', height: '100%', parentNode: document.querySelector('#jitsi')})
//		jitsi.executeCommand('displayName', ime);
		room.onStateChange.once((state) => { //prvi state
			updatePlayers();
			stateMachine(state.stanje);
		
		});

		}).catch(e => {
		console.log("JOIN ERROR", e);
		updateStatus("error","red");
	});
}

function onMessage(room, message) {
	$("#btnReady").show();
	$("#txtq").html(message);
}
function onStateChange (room, state) {
	updatePlayers(state.stanje);
	stateMachine(state.stanje);
	zadnji(state);
}
function onError (room) {
	console.log(client.id, "couldn't join", room.name);
	updateStatus("error","red");
}
function onLeave (room) {
	console.log(client.id, "left", room.name);
		$("#login").show();
		$("#players").hide();
		$("#pisanje").hide();
		$("#scoring").hide();
		$("#timing").hide();
		$("#question").hide();
		$("#jitsi").hide();
		updateStatus("disconnected","red");
}

function updatePlayers(stanje) {
	switch (stanje){
		case 0:
		playersReady();
		break;
		case 1:
		case 2:
		playersParovi();
		break;
	}
}

function zadnji(state) {
	$("#last").html(state.zadnji);
	$("#rem").html(state.preostali);
	$("#tot").html(state.ukupno);
}

function playersParovi() {
	console.log("parovi updated");
	$("#player_list").empty();
	$("#player_list").append("<ul>");
	poredak=Room.state.poredak;
	players=Room.state.players;
	poredak.forEach((x,index) => {
		var bold=(index==Room.state.aktivni);
		$("#player_list").append("<li " + (bold ? "class='curr'":"") + ">" + players[x].ime + " ⇨ " + players[players[x].partner].ime + "</li>");
		if (bold) {igraju=players[x].ime + " ⇨ " + players[players[x].partner].ime;}
	});
	$("#player_list").append("</ul>");
}

function playersReady() {
	console.log("players updated");
	$("#player_list").empty();
	$("#player_list").append("<ul>");
	players=Room.state.players
	for ( var x in players) {$("#player_list").append("<li>" + (players[x].stanje ==1 ? "✅ ": "❎ ") + players[x].ime + "</li>");}
	$("#player_list").append("</ul>");
	if (players[Room.sessionId].stanje==1){
		disableForma(true);
		updateStatus("Waiting for other players...");
	}
}

function disableForma(disable) {
	console.log("forma disabled",disable);
	var forma=document.getElementById("papirici");
	for (var i=0;i<forma.length;i++)
		forma.elements[i].disabled=disable;
	forma.elements[forma.length-1].value=(disable?"Waiting":"Ready");
}

function clearForma() {
	console.log("forma cleared");
	var forma=document.getElementById("papirici");
	for (var i=0;i<forma.length;i++)
		forma.elements[i].value="";
}
	
function papersPlease() {
	console.log("papirici predani");
	var paps=new Array();
	var forma=document.getElementById("papirici");
	for (var i=0; i<forma.length;i++) {
		cpap=forma.elements[i];
		if (cpap.type=="text")
			paps.push(cpap.value);
	}
	Room.send({cmd: 0, paps: paps});

}
function stateMachine(state) {
	if (state==lastState) return;
	console.log("State changing from",lastState,"to",state);
	switch (state) {
		case 0:
		$("#txtq").html("");
		$("#login").hide();
		$("#players").show();
		$("#pisanje").show();
		$("#question").hide();
		$("#jitsi").show();
		$("#scoring").hide();
		$("#timing").hide();
		clearForma();
		disableForma(false);
		$("#finals").html("");
		resetCountdown();
		updateStatus("Ispunjavanje papirića");
		break;
		case 1:
		$("#login").hide();
		$("#btnReady").show();
        $("#players").show();
        $("#pisanje").hide();
        $("#question").show();
        $("#jitsi").show();
		$("#scoring").show();
		$("#timing").show();
		$(".running").show();
		$(".finished").hide();
		$("#btnReady").html("Ready");
		updateStatus("Ready za start");
		if (Room.state.cpt != Room.sessionId) {$("#btnReady").hide(); updateStatus("Waiting for turn");}
		clearInterval(timer);
		$("#txtq").html(igraju);
		break;
		case 2:
		updateStatus("In progress");
		$("#btnReady").html("Točno");
		if (Room.state.cpt != Room.sessionId) {$("#btnReady").hide();}
		resetCountdown();
		timer=setInterval(countdown,1000);
		break;
		case 3:
		$("#ending")[0].play();
		clearInterval(timer);
		showScores();
		$(".running").hide();
		$(".finished").show();
		$("#btnReady").show();
		updateStatus("Kraj");
		$("#btnReady").html("Again");
		break;
	}
	lastState=state;
}

function updateStatus(message, colour="lightgreen") {
	$("#status").html(message);
	$("#status").css("background-color",colour);
}

function resetCountdown() {
	curT=Room.state.duration;
	$("#timing").html(curT);
}
function countdown() {
	if (curT==0) {
		console.log("outatime");
		$("#timeout")[0].play();
	} else {
		curT--;
	}
	$("#timing").html(curT);
}

function sayReady() {
	console.log("saying ready");
	Room.send({cmd:1});
}

function showScores() {
	console.log("showing scores");
	var players=Room.state.players
	var poredak=Room.state.poredak;
	$("#finals").html("<b>Rezultati</b><br>");
	poredak.forEach((x,index) => {
		if (index<poredak.length/2)	$("#finals").append(players[x].ime + " i " + players[players[x].partner].ime + ": " + (players[x].pogodjeni+players[players[x].partner].pogodjeni) + "<br>");
	});
	$("#finals").show();
}
