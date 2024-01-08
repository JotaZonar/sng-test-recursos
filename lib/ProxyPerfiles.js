import ZClient from "./ZClient.js";
import { Logger } from "./ZServer.js";
import cookie from 'cookie';

const zClient = new ZClient(process.env.PERFILES_URL + "/api/v1/");

/* Clase de uso internos por los módulos. No expone EndPoints */
class ProxyPefiles {
    static get instance() {
        if (ProxyPefiles._singleton) return ProxyPefiles._singleton;
        ProxyPefiles._singleton = new ProxyPefiles();
        return ProxyPefiles._singleton;
    }

    async log(log) {
        return await zClient.post("logs", log);
    }
    async getSesionUsuario(token) {
        return await zClient.get("sesiones-usuario/" + token);
    }
    async getNombreClienteAPI(apiKey) {
        return await zClient.get("nombre-cliente-api-by-key/" + apiKey);
    }
    async getAuthInfo(req) {
        try {
            if (!req) return {originType: "sistema", origin: "sistema"};
            let _bearerToken = req.get("Authorization");
            if (!_bearerToken) {
                let cookies = cookie.parse(req.headers.cookie || '');
                _bearerToken = cookies.bearerToken;
            }
            if (!_bearerToken && req.cookies) _bearerToken = req.cookies.bearerToken;
            if (_bearerToken && _bearerToken.startsWith("Bearer ")) _bearerToken = _bearerToken.substring(7);
            let _apiKey = req.get("X-API-Key");
            if (_bearerToken) {
                let sesion = await this.getSesionUsuario(_bearerToken);
                return {originType: "email", origin: sesion.usuario.email}
            } else if (_apiKey) {
                let nombre = await this.getNombreClienteAPI(_apiKey);
                return {originType: "clienteAPI", origin: nombre};
            } else {
                return {originType: "sistema", origin: "sistema"}
            }
        } catch(error) {
            console.error("Error obteniendo AuthInfo", error);
        }
    }
}

class PerfilesLogger extends Logger {
    async log(severity, type, serviceCode, title, details, entityCode, entityPK, originType, origin) {
        try {
            await ProxyPefiles.instance.log({
                tipoOrigen: originType, origen: origin, tipo: type,
                titulo: title, severidad: severity, 
                codigoEntidad: entityCode, pkInstanciaEntidad: entityPK,
                detalles: details,
                codigoServicio: serviceCode
            })
        } catch (error) {
            console.error(error);
        }
    }
    async getAuthInfo(req) {
        return await ProxyPefiles.instance.getAuthInfo(req);
    }
}

export default ProxyPefiles.instance;
export {PerfilesLogger}