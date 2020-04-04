import { Room, Client, Delayed } from "colyseus";
import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";

const DURATION = 60;

class Player extends Schema {
  @type("string") ime: string;
  @type("string") partner: string;
  @type("number") pogodjeni: number=0;
  @type("number") stanje: number=0; // 0 - ispunjavanje papirica, 1 - ready za start runde
}
class State extends Schema {
	@type("number") stanje: number; // 0 - ispunjavanje papirica, 1 - start runde, 2 - running, 3 - finished
	@type("number") turn: number;
	@type("number") duration: number;
	@type({ map: Player }) players = new MapSchema<Player>();
	@type("number") ukupno: number;
	@type("number") preostali: number;
	@type( ["string"])poredak = new ArraySchema<string>();
	@type("number") aktivni: number;
	@type("string") zadnji: string;
	@type("string") cpt: string;
}


export class ZdjelaRoom extends Room<State> {
  
  gPapiri: Array<string>;
  klijenti: {[key:string]:any}={};
  onCreate (options: any) {
	  this.patchRate=250;
	  this.setState(new State());
	  this.state.duration=DURATION;
	  this.state.stanje=0;
	  this.gPapiri = new Array<string>();
	  this.resetRound();
  }

  onJoin (client: Client, options: any) {
	this.state.players[client.sessionId]=new Player();
	this.state.players[client.sessionId].ime=String(options);
	this.klijenti[client.sessionId]=client;
	console.log(client.sessionId + "("+this.state.players[client.sessionId].ime + ") joined");
  }

  onMessage (client: Client, message: any) {
console.log(client.sessionId, "sent", message);
	switch (this.state.stanje) {
	case 0: //ready i slanje papirica
	if (message["cmd"]==0) { console.log(client.sessionId,"salje papirice");
		this.state.players[client.sessionId].stanje=1;
		for (let pap of message["paps"]) {
			if (pap !='') this.gPapiri.push(pap);
		}
		this.state.ukupno=this.gPapiri.length;
		var go=1;
		var num=0;
		for (let id in this.state.players) {num++; const player: Player = this.state.players[id]; if (player.stanje != 1) go=0};
		if (go && num%2==0) this.setajState(1);
	}
	break; 
	case 1: //ready za start
	console.log(client.sessionId,"kaze start");
	if (client.sessionId==this.state.poredak[this.state.aktivni] && message['cmd']==1) {
		this.setajState(2);
	}
	break;
	case 2: //running
	console.log(client.sessionId,"pogadja");
	if (client.sessionId==this.state.poredak[this.state.aktivni] && message['cmd']==1) {
		this.pogodiPapiric();
		this.otvoriPapiric();
	}
	break;
	case 3: //kraj
	if (message["cmd"]==1) {
		console.log(client.sessionId,"kaze jos");
		var go=1;
		this.state.players[client.sessionId].stanje=2
		for (let id in this.state.players) {const player: Player = this.state.players[id]; if (player.stanje != 2) go=0}
		if (go) this.setajState(0);
	}
	break;
	default:
	}
  }

  onLeave (client: Client, consented: boolean) {
	delete this.state.players[client.sessionId];
	delete this.klijenti[client.sessionId];
	console.log(client.sessionId, "left", consented);
  }

  onDispose() {
  }

  setajState(noviState: number) {
	  console.log("state", this.state.stanje, "to", noviState, "attempted");
	  switch (this.state.stanje) {
		  case 0: // pisanje
		  	if (noviState==1){
				this.state.ukupno=this.gPapiri.length;
				this.state.preostali=this.state.ukupno;
				this.genParovi();
				this.state.stanje=1;
				this.lock();
			}
		  break;
		  case 1: //ready
		  	if (noviState==2){
				this.shufflePaps();
				this.state.stanje=2;
				this.clock.setTimeout(() => {this.setajState(1);}, DURATION*1025);
				this.otvoriPapiric();
				this.state.turn++;
			}
		  break;
		  case 2: //running
		  	if (noviState==1){
				//this.state.aktivni++;
				this.advanceAktivni(false);
				this.state.stanje=1;
			}
			if (noviState==3){
				this.clock.clear();
				this.state.stanje=3;

			}
		  break;
		  case 3: //kraj
		  	if (noviState==0){
				this.state.stanje=0;
				this.unlock();
				this.resetRound();
			}
		  break;
  	}
	console.log("new state is",this.state.stanje);
  }

  shufflePaps() {
	  console.log("shuffling paps");
	  //console.log("Pre-shuffled", this.gPapiri);
	  for (var i=this.gPapiri.length-1; i>0;i--) {
		  var j=Math.floor(Math.random()*(i+1));
		  var temp=this.gPapiri[i];
		  this.gPapiri[i]=this.gPapiri[j];
		  this.gPapiri[j]=temp;
	  }
	  this.state.preostali=this.gPapiri.length;
	  //console.log("Shuffled", this.gPapiri);
  }

  genParovi() {
	  console.log("generating pairs");
	  this.state.poredak.length=0;
	  //this.state.aktivni=0;
	  this.advanceAktivni(true);
	  var tplay = new Array();
	  for (let name in this.state.players)
	  {
		  tplay.push(name);
	  }
	  console.log(tplay);
	  //shuffle
	  for (var i=tplay.length-1; i>0; i--) {
		  var j=Math.floor(Math.random()*(i+1));
		  var temp=tplay[i];
		  tplay[i]=tplay[j];
		  tplay[j]=temp;
	  }
	  //poredak
	  tplay.forEach( value => {this.state.poredak.push(value)});
	  //pair
	  var half=tplay.length/2;
	  var left=tplay.splice(0,half);
	  for (var i=0;i<left.length;i++) {
		  this.state.players[left[i]].partner=tplay[i];
		  this.state.players[tplay[i]].partner=left[i];
	  }
	  this.setCpt();
  }

  otvoriPapiric() {
	  var ak=this.state.poredak[this.state.aktivni];
	  var client=this.klijenti[ak];
	  var papiric=this.gPapiri.slice(-1)[0];
	  this.send(client,papiric);
  }
  pogodiPapiric() {
	  this.state.players[this.state.poredak[this.state.aktivni]].pogodjeni++;
	  this.state.zadnji=this.gPapiri.pop();
	  this.state.preostali=this.gPapiri.length;
	  if (this.state.preostali==0) this.setajState(3);
  }

  resetRound() {
	  console.log("round reset");
	  for (let id in this.state.players) {const player: Player = this.state.players[id]; player.stanje=0; player.pogodjeni=0; player.partner=null};
	  this.state.zadnji="";
	  //this.state.aktivni=0;
	  advanceAktivni(true);
	  this.state.turn=0;
	  this.clock.start();
  }

  setCpt() {
	  var ak=this.state.poredak[this.state.aktivni];
	  this.state.cpt=ak;
	  console.log("cpt is",this.state.cpt);
  }

  advanceAktivni(reset) {
      this.state.aktivni++;
	  if (this.state.aktivni >= this.state.poredak.length) this.state.aktivni=0;
	  if (reset) this.state.aktivni=0;
	  this.setCpt();
  }
}
