import path from "path";
import http from "http";
import express from "express";
import serveIndex from "serve-index";
import cors from "cors";
import { Server } from "colyseus";
import { monitor } from "@colyseus/monitor";
// import socialRoutes from "@colyseus/social/express"

import { ZdjelaRoom } from "./ZdjelaRoom";

const port = Number(process.env.PORT || 2567);
const app = express()

app.use(cors());
app.use(express.json())

const server = http.createServer(app);
const gameServer = new Server({
  server,
});

app.use('/', express.static(path.join(__dirname, "html")));
// app.use('/', serveIndex(path.join(__dirname, "html"), {'icons': true}))

// register your room handlers
gameServer.define('zdjela_room', ZdjelaRoom);

/**
 * Register @colyseus/social routes
 *
 * - uncomment if you want to use default authentication (https://docs.colyseus.io/authentication/)
 * - also uncomment the import statement
 */
// app.use("/", socialRoutes);

// register colyseus monitor AFTER registering your room handlers
app.use("/colyseus", monitor());

gameServer.listen(port);
console.log(`Listening on ws://localhost:${ port }`)
