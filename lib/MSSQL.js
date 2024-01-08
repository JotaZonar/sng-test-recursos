import sql from "mssql";
import { DateTime } from "luxon";

const TZ = process.env.TZ || "America/Santiago";

function getSQLServerType(js) {
    if (js == null || js === null || js == undefined || js === undefined) return sql.NVarChar(10); //return sql.Null;
    if (js instanceof String) return sql.NVarChar;
    if (js instanceof Number) {
        return (js % 1 === 0)?sql.Int:sql.Float;
    }
    if (js instanceof Date || js.isLuxonDateTime) return sql.DateTime;
    if (js instanceof Boolean) return sql.Bit;
    if (js instanceof Buffer) return s1l.VarBinary;

    switch(typeof js) {
        case "string":  return sql.NVarChar;
        case "number":  
            if (js % 1 === 0) return sql.Numeric;
            else return sql.Float;
        case "boolean": return sql.Bit;            
    }    
    return sql.NVarChar;
}

class MSSQL {
    static getInstance(name, user, password, database, host, port) {
        if (!MSSQL._instances) MSSQL._instances = {};
        if (!MSSQL._instances[name]) {
            let config = {
                user, password, database, server: host, port: port || 1433,
                pool: {max: 10, min:0, idleTimeoutMillis: 30000},
                options: {encrypt: true, trustServerCertificate: true, database}
            }
            if (!config.server) {
                console.trace("No hay server en MSSQL Config");
                throw "No hay server en MSSQL Config"
            }
            MSSQL._instances[name] = new MSSQL(config);
        }
        return MSSQL._instances[name];
    }

    static lx2Date(lx) {
        return new Date(lx.year, lx.month - 1, lx.day, lx.hour, lx.minute, lx.second);
    }
    static date2Lx(d) {
        return DateTime.fromObject({year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hour: d.getHour(), minute: d.getMinute(), second: d.getSecond}, {zone:TZ});
    }

    constructor(config) {
        // this._connection = null;
        this._config = config;
    }    

    async init() {
        return new Promise((resolve, reject) => {
            let connPool = new sql.ConnectionPool(this._config);
            connPool.connect()
                .then(pool => {
                    this.pool = pool;
                    resolve();
                })
                .catch(error => reject(error));
        })
    }

    async query(sqlStatement, params) {
        const request = new sql.Request(this.pool);
        Object.keys(params?params:{}).forEach(name => {
            let sqlType = getSQLServerType(params[name]);
            let value = params[name];
            if (sqlType == sql.DateTime && value && value.isLuxonDateTime) {
                value = MSSQL.lx2Date(value);
            }
            request.input(name, sqlType, value);
        });
        try {
            return await request.query(sqlStatement);
        } catch (error) {
            //console.trace(error);
            //throw error;
            throw new Error(error.toString());
        }
    }

    async executeSQL(sqlStatement, params) {
        let recordset = await this.query(sqlStatement, params);
        if (recordset.recordset) return recordset.recordset;
        else return recordset;
    }
    async executeUpdate(sqlStatement, params) {
        let result = await this.query(sqlStatement, params);
        return result.rowsAffected[0];
    }

    executeResultSet(sqlStatement, params) {                
        return new ZSQLServerResultSet(this.pool, sqlStatement, params);                
    }        
}

class ZSQLServerResultSet {
    constructor(pool, sqlStatement, params) {
        this._pool = pool;
        this._nextRow = null;
        this._closed = false;
        this._pendingCB = null;    
        this._pendingError = null;    
        this._request = new sql.Request(this._pool);
        this._request.stream = true;
        Object.keys(params?params:{}).forEach(name => this._request.input(name, getSQLServerType(params[name]), params[name]));

        this._request.on("done", result => {
            this._closed = true;
            if (this._pendingCB) {
                let cb = this._pendingCB;
                setImmediate(() => cb(false))
            };
            this._pendingCB = null;
			this._pendingError = null;
        });
        this._request.on("row", row => {
            this._request.pause();
            this._nextRow = row;
            if (this._pendingCB) {
                let cb = this._pendingCB;
                this._pendingCB = null;
                setImmediate(() => cb(true));
                //cb(true);
            }
        });
		this._request.on("error", error => {
            if (this._pendingError) {
                let pe = this._pendingError;
                this._pendingError = null;
                pe(error);
            }
        });
        this._request.query(sqlStatement);
    }
    hasNext() {
        return new Promise((resolve, reject) => {
            if (this._nextRow) resolve(true);
            else {
                if (this._closed) {
                    resolve(false);
                } else {
                    this._pendingCB = resolve;
                    this._pendingError = reject;
                }
            }
        });
    }
    next() {
        if (this._closed) throw "Called next on closed ResultSet";
        if (!this._nextRow) throw "Called next when no next row available";
        let r = this._nextRow;
        this._nextRow = null;
        //setImmediate(() => this._request.resume());
        this._request.resume();
        return r;
    }
}

// Configurar instancias usadas. Se inicializan en index.js
MSSQL.getInstance("recursos", 
    process.env.SQL_USER,  process.env.SQL_PASSWORD,  
    process.env.SQL_DATABASE,  process.env.SQL_HOST, 
    process.env.SQL_PORT?parseInt(process.env.SQL_PORT):1433
);
export default MSSQL;