import express from "express"
import http from "http";
import { ZServer } from "./lib/ZServer.js";
import recursos from "./lib/Recursos.js";
import MSSQL from "./lib/MSSQL.js";
import { PerfilesLogger } from "./lib/ProxyPerfiles.js";

async function createHTTPServer() {
    await MSSQL.getInstance("recursos").init();
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers, X-API-Key, Authorization");
        res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        next();
    });

    let zServer = new ZServer(app, "/api/v1");        
    zServer.registerModule(recursos);

    zServer.oasSetInfo({
        title:"SNG - Recursos", description:"APIs de Acceso a Administraciones de Recursos Minería", version:"1.0"
    });                
    if (process.env.API_DOC_PATH) await zServer.startSwaggerServer(process.env.API_DOC_PATH);
    if (process.env.OAS_DOC_PATH) app.get(process.env.OAS_DOC_PATH, (req, res) => res.json(zServer.getOpenAPIDoc()));
    zServer.loggingSetServiceCode("recursos");
    zServer.setLogger(new PerfilesLogger(zServer));

    const httpServer = http.createServer(app);
    httpServer.listen(8082, "::", () => {
        console.log("[Microservicio de Recursos Iniciado en puerto 8082");
    });
}





createHTTPServer();