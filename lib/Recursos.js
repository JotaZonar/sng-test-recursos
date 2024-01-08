import { ZModule } from "./ZServer.js";
import MSSQL from "./MSSQL.js";
// import ZClient from "./ZClient.js";
import proxyPerfiles from "./ProxyPerfiles.js";

//const zClientPerfiles = new ZClient(process.env.PERFILES_URL + "/api/v1/");
const db = MSSQL.getInstance("recursos");


class Recursos extends ZModule {
    static get instance() {
        if (Recursos._singleton) return Recursos._singleton;
        Recursos._singleton = new Recursos();
        return Recursos._singleton;
    }

    getOASTags() {return ["Adminsitración de Recursos Mineros"]}

    init() {
        this.oasDeclareSchema("tipo-recurso", {
            properties:{
                id:{type:"integer", description:"Identificador único del Tipo de Recurso"},
                nombre: {type: "string", description: "Nombre del Tipo de Recurso"},
                activo: {type: "boolean", description: "Tipo de Recurso Activo"}
            }
        });
        this.oasDeclareSchema("recurso", {
            properties:{
                id:{type:"integer", description:"Identificador único del Recurso"},
                nombre: {type: "string", description: "Nombre del Recurso"},
                activo: {type: "boolean", description: "Recurso Activo"},
                tipo: {"$ref":"#/components/schemas/tipo-recurso", description: "Tipo del Recurso"}
            }
        });

        // EndPoints Tipos de Recursos
        this.registerEndPoint("GET", "tipos-recursos", this.getTiposRecursos, {
            responses:{"200":{description: "Lista de Tipos de Recursos", content:{"application/json":{schema:{type:"array", items:{"$ref":"#/components/schemas/tipo-recurso"}}}}}}
        });
        this.registerEndPoint("GET", "tipos-recursos/:id", this.getTipoRecurso, {
            responses:{
                "200":{description: "Tipo de Recurso Encontrado", content:{"application/json":{schema:{"$ref":"#/components/schemas/tipo-recurso"}}}},
                "404":{description: "No se encontró el registro"}
            }
        });
        this.registerEndPoint("POST", "tipos-recursos", this.addTipoRecurso, {
            requestBody:{required: true, content: {"application/json":{schema:{"$ref":"#/components/schemas/tipo-recurso"}}}},
            responses:{"200":{description: "Tipo de Recurso Agregado", content:{"application/json":{schema:{"$ref":"#/components/schemas/tipo-recurso"}}}}}
        });
        this.registerEndPoint("PUT", "tipos-recursos", this.saveTipoRecurso, {
            requestBody:{required: true, content: {"application/json":{schema:{"$ref":"#/components/schemas/tipo-recurso"}}}},
            responses:{"200":{description: "Tipo de Recurso Modificado", content:{"application/json":{schema:{"$ref":"#/components/schemas/tipo-recurso"}}}}}
        });
        this.registerEndPoint("DELETE", "tipos-recursos/:id", this.deleteTipoRecurso);

        // EndPoints Recursos
        this.registerEndPoint("GET", "tipos-recursos/:idTipo/recursos", this.getRecursos, {
            responses:{"200":{description: "Lista de Recursos dentro del Tipo", content:{"application/json":{schema:{type:"array", items:{"$ref":"#/components/schemas/recurso"}}}}}}
        });
        this.registerEndPoint("GET", "tipos-recursos/:idTipo/recursos/:id", this.getRecurso, {
            responses:{
                "200":{description: "Recurso Encontrado", content:{"application/json":{schema:{"$ref":"#/components/schemas/recurso"}}}},
                "404":{description: "No se encontró el registro"}
            }
        });
        this.registerEndPoint("POST", "tipos-recursos/:idTipo/recursos", this.addRecurso, {
            requestBody:{required: true, content: {"application/json":{schema:{"$ref":"#/components/schemas/recurso"}}}},
            responses:{"200":{description: "Recurso Agregado", content:{"application/json":{schema:{"$ref":"#/components/schemas/recurso"}}}}}
        });
        this.registerEndPoint("PUT", "tipos-recursos/:idTipo/recursos", this.saveRecurso, {
            requestBody:{required: true, content: {"application/json":{schema:{"$ref":"#/components/schemas/recurso"}}}},
            responses:{"200":{description: "Recurso Modificado", content:{"application/json":{schema:{"$ref":"#/components/schemas/recurso"}}}}}
        });
        this.registerEndPoint("DELETE", "tipos-recursos/:idTipo/recursos/:id", this.deleteRecurso);
    }

    /* Tipos de Recursos */
    async getTiposRecursos() {
        let rows = await db.executeSQL(`
            select id, nombre, activo from Tipo_Recurso order by nombre
        `);
        return rows.map(r => ({
            id: r.id, nombre: r.nombre, activo: r.activo == "S"
        }))
    }

    async getTipoRecurso(id) {
        let rows = await db.executeSQL(`
            select id, nombre, activo from Tipo_Recurso where id = @id
        `, {id});
        if (!rows.length) throw {status: 404, message:"No se encontró el Tipo de Recurso"}
        return rows.map(r => ({
            id, nombre: r.nombre, activo: r.activo == "S"
        }))[0]
    }

    async addTipoRecurso(tipo, _request) {
        let rows = await db.executeSQL(`
            insert into Tipo_Recurso (nombre, activo)
            OUTPUT inserted.id as id
            values
            (@nombre, @activo)
        `, {
            nombre: tipo.nombre, activo: tipo.activo?"S":"N"
        });
        let newRecord = await this.getTipoRecurso(rows[0].id);
        let {originType, origin} = await proxyPerfiles.getAuthInfo(_request);
        await this.logEntity(originType, origin, 1, "Agrega Tipo Recurso", "tipo_recurso", newRecord.id, {new:newRecord});
        /*
        await zClientPerfiles.post("logs", {
            severidad:1, tipo: "entidad", codigoServicio: "recursos", titulo: "Agrega Tipo de Recurso", 
            detalles:{new: newRecord}, codigoEntidad:"tipo_recurso", pkInstanciaEntidad: newRecord.id,
            tipoOrigen: "sistema", origen:"sistema"
        })
        */
        return newRecord;
    }

    async saveTipoRecurso(tipo, _request) {
        let oldRecord = await this.getTipoRecurso(tipo.id);
        await db.executeUpdate(`
            update Tipo_Recurso
               set nombre = @nombre, activo = @activo
             where id = @id
        `, {id: tipo.id, nombre: tipo.nombre, activo: tipo.activo?"S":"N"});
        let newRecord = await this.getTipoRecurso(tipo.id);
        let {originType, origin} = await proxyPerfiles.getAuthInfo(_request);
        await this.logEntity(originType, origin, 1, "Modifica Tipo Recurso", "tipo_recurso", newRecord.id, {old: oldRecord, new:newRecord});
        return newRecord;
    }

    async deleteTipoRecurso(id, _request) {
        let oldRecord = await this.getTipoRecurso(id);
        let rows = await db.executeSQL(`
            select count(*) as n from Recurso where id_tipo = @id
        `, {id});
        let n = rows[0].n;
        if (n > 0) throw "No puede eliminar el Tipo de Recurso porque existen " + n + " recursos que lo referencian. Debe eliminarlos o cambiarlos a otro Tipo";
        await db.executeUpdate(`
            delete from Tipo_Recurso where id = @id
        `, {id});
        let {originType, origin} = await proxyPerfiles.getAuthInfo(_request);
        await this.logEntity(originType, origin, 1, "Elimina Tipo Recurso", "tipo_recurso", newRecord.id, {old: oldRecord});
        /*
        await zClientPerfiles.post("logs", {
            severidad:1, tipo: "entidad", codigoServicio: "recursos", titulo: "Elimina Tipo de Recurso", 
            detalles:{old: oldRecord}, codigoEntidad:"tipo_recurso", pkInstanciaEntidad: id,
            tipoOrigen: "sistema", origen:"sistema"
        })
        */
    }

    /* Recursos */
    async getRecursos(idTipo) {
        let tipo = await this.getTipoRecurso(idTipo);
        let rows = await db.executeSQL(`
            select id, nombre, activo from Recurso where id_tipo = @idTipo order by nombre
        `, {idTipo});
        return rows.map(r => ({
            id: r.id, nombre: r.nombre, activo: r.activo == "S", tipo
        }))
    }

    async getRecurso(idTipo, id) {
        let tipo = await this.getTipoRecurso(idTipo);
        let rows = await db.executeSQL(`
            select id, nombre, activo from Recurso where id = @id
        `, {id});
        if (!rows.length) throw {status: 404, message:"No se encontró el Recurso"}
        return rows.map(r => ({
            id, nombre: r.nombre, activo: r.activo == "S", tipo
        }))[0]
    }

    async addRecurso(idTipo, recurso, _request) {        
        let rows = await db.executeSQL(`
            insert into Recurso (nombre, activo, id_tipo)
            OUTPUT inserted.id as id
            values
            (@nombre, @activo, @idTipo)
        `, {
            nombre: recurso.nombre, activo: recurso.activo?"S":"N", idTipo: recurso.tipo.id
        });
        let newRecord = await this.getRecurso(recurso.tipo.id, rows[0].id);
        let {originType, origin} = await proxyPerfiles.getAuthInfo(_request);
        await this.logEntity(originType, origin, 1, "Agrega Recurso", "recurso", newRecord.id, {new:newRecord});
        return newRecord;
    }

    async saveRecurso(idTipo, recurso, _request) {
        let oldRecord = await this.getRecurso(recurso.tipo.id, recurso.id);
        await db.executeUpdate(`
            update Recurso
               set nombre = @nombre, activo = @activo, id_tipo = @idTipo
             where id = @id
        `, {id: recurso.id, nombre: recurso.nombre, activo: recurso.activo?"S":"N", idTipo: recurso.tipo.id});
        let newRecord = await this.getRecurso(recurso.tipo.id, recurso.id);
        let {originType, origin} = await proxyPerfiles.getAuthInfo(_request);
        await this.logEntity(originType, origin, 1, "Modifica Recurso", "recurso", newRecord.id, {old: oldRecord, new:newRecord});
        return newRecord;
    }

    async deleteRecurso(idTipo, id, _request) {
        let oldRecord = await this.getRecurso(idTipo, id);
        await db.executeUpdate(`
            delete from Recurso where id = @id
        `, {id});
        let {originType, origin} = await proxyPerfiles.getAuthInfo(_request);
        await this.logEntity(originType, origin, 1, "Elimina Recurso", "recurso", id, {old: oldRecord});

    }
}

export default Recursos.instance;