import { KeycloakConfig } from "./config";
const querystring = require('querystring');
const https = require('https');
//const moment = require('moment');
const fetch = require('node-fetch');
const crc = require('crc').crc32;
import { verifyToken } from './jwt';

export class KeycloakAuthentication {
    private BASE_URI: string
    private REALM: string
    private PASSWORD: string
    private USERNAME: string
   

    constructor(config : KeycloakConfig) {
        this.BASE_URI = config.KEYCLOAK_BASE_URI; 
        this.REALM = config.KEYCLOAK_REALM; 
        this.PASSWORD = config.KEYCLOAK_PASSWORD; 
        this.USERNAME = config.KEYCLOAK_USERNAME; 
    }

    private decodeToken(token) {
        return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString() ); 
        //Buffer.from(token.split('.')[1], 'base64'))
    }

    public async validateAccessToken(token) : Promise<boolean> {
        try { 
            let cert = await this.getPublicKey(); 
            let publicKEY = Buffer.from(`-----BEGIN CERTIFICATE-----\n${cert}\n-----END CERTIFICATE-----`,'utf8');
            let result = await verifyToken(token, publicKEY); 
            return true; 
        }
        catch (error) {
            console.error(`Invalid token: reason: ${error.message}`); 
            return false; 
        }
    }
    public async getPublicKey() { 
        const resp = await fetch(`${this.BASE_URI}/realms/${this.REALM}/protocol/openid-connect/certs`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            agent: new https.Agent({rejectUnauthorized: false})
        });

        let cert; 
        if (resp.ok) {
            let resData = await resp.json();
            cert = resData.keys[0].x5c[0]; 
            console.assert(resData, "can not get Certs Data"); 
            //console.assert(cert);
            console.log("Cert obtained succesfully");
            return cert; 
        }
        else {
            console.log("Failed to get public cert\n", await resp.json()); 
        }
    }

    public async getAccessToken(clientId: string, clientSecret: string) {
        let username = this.USERNAME;
        let password = this.PASSWORD;
        
        const authData = {
            client_id: clientId, //'admin-cli'
            client_secret: clientSecret,//'3101f87c-a64b-48a7-b6ca-480459da47b3',
            username: username,
            password: password,
            grant_type: 'password',
        };

        const resp = await fetch(`${this.BASE_URI}/realms/${this.REALM}/protocol/openid-connect/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            body: querystring.encode(authData),
            agent: new https.Agent({rejectUnauthorized: false})
        });
    
        let token;
        if (resp.ok)
        {
            const respData = await resp.json();
            console.log('respData: \n', respData); 
            token = respData.access_token;
            console.assert(token, "Failed to get 'access_token' from auth response");
            console.log("Login successful");
        }
        else
        {
            console.error('Failed to access, reason: ', await resp.json());
        }
        return token;
    }

    public async login() {
        let username = this.USERNAME;
        let password = this.PASSWORD;
        console.log(`Logging in to '${this.REALM}'...`);
    
        const loginData = {
            client_id: 'admin-cli',
            username: username,
            password: password,
            grant_type: 'password',
            //client_secret: '3101f87c-a64b-48a7-b6ca-480459da47b3',
            //scope: 'openid'
        };
        const resp = await fetch(`${this.BASE_URI}/realms/${this.REALM}/protocol/openid-connect/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            body: querystring.encode(loginData),
            agent: new https.Agent({rejectUnauthorized: false})
        });
    
        let token;
        if (resp.ok)
        {
            const respData = await resp.json();
    
            token = respData.access_token;
            console.assert(token, "Failed to get 'access_token' from login response");
            console.log("Login successful");
        }
        else
        {
            console.error("Failed to login");
            console.error(await resp.json());
        }
        //console.log(token)
        return token;
    }
    
    public async getClients(auth) {
        let clients = null;
        const resp = await fetch(`${this.BASE_URI}/admin/realms/${this.REALM}/clients`, {
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + auth
            },
            agent: new https.Agent({rejectUnauthorized: false})

        });
    
        if (resp.ok)
        {
            clients = await resp.json();
        }
        else
        {
            console.error(resp.status, resp.statusText);
            console.error(await resp.text());
        }
    
        return clients
    };
    
    public async getClient(auth, clientId) {
        console.log(`Finding client '${clientId}`);
        const clients = await this.getClients(auth);
    
        console.log(`Have ${clients.length} clients`);
        const client = clients.find(function(item) {
            return item.clientId === clientId;
        });
    
        return client;
    }
    
    public async createClient(auth, clientid) {
        let client = null;
        let resp = await fetch(`${this.BASE_URI}/admin/realms/${this.REALM}/clients`, {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + auth,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                clientId: clientid
            })
        });
    
        if (resp.ok)
        {
            resp = await fetch(resp.headers.get('location'), {
                method: 'GET',
                headers: {
                    Authorization: 'Bearer ' + auth
                }
            });
    
            if (resp.ok)
            {
                client = await resp.json();
            }
            else
            {
                console.error("Failed to get created client");
                console.error(await resp.text());
            }
        }
        else
        {
            console.error("Failed to create client");
            console.error(await resp.text());
        }
    
        return client;
    }
    
    public async getClientSecret(auth, client) {
        let secret;
        console.log(`Reteriving client secret for '${client.clientId}'`);
        const credentialResp = await fetch(`${this.BASE_URI}/admin/realms/${this.REALM}/clients/${client.id}/client-secret`, {
            headers: {
                Authorization: 'Bearer ' + auth
            },
            agent: new https.Agent({rejectUnauthorized: false})

        });
    
        if (credentialResp.ok)
        {
            const respData = await credentialResp.text();
            const credentialJson = JSON.parse(respData);
            // console.log("Reterived client secret", respData);
    
            if (credentialJson.value)
            {
                secret = credentialJson.value;
                console.log(`Client secret '${secret}'`);
            }
            else
            {
                console.error("Failed to get client secret");
                console.error(await credentialResp.text());
            }
        }
        else
        {
            console.error("Failed to get client secret");
            console.error(await credentialResp.text());
        }
    
        return secret;
    }
    
    public async tokenExchange(auth, clientId, code) {
        console.log(`Beginning token exchange for '${clientId}'`);
    
        const client = await this.getClient(auth, clientId);
    
        let tokens;
        if (client)
        {
            console.log("Found client, reteriving secret");
    
            const secret = await this.getClientSecret(auth, client);
    
            if (secret)
            {
                const exchangeData = {
                    client_id: client.clientId,
                    client_secret: secret,
                    grant_type: 'authorization_code',
                    code: code,
                    // FIXME
                    redirect_uri: 'http://localhost/index.html?client=' + clientId,
                    scope: 'openid,openid-connect,offline_access'
                };
    
                console.log("Exchange data", exchangeData);
                const resp = await fetch(`${this.BASE_URI}/realms/${this.REALM}/protocol/openid-connect/token`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
                    },
                    body: querystring.encode(exchangeData)
                });
    
                if (resp.ok)
                {
                    tokens = await resp.json();
    
                    const accessToken = this.decodeToken(tokens.access_token);
                    //const accessTokenDuration = moment.duration(moment.unix(accessToken.exp).diff(moment()));
                    //console.log(`Access token '${crc(tokens.access_token).toString(16)}' will expire in ${accessTokenDuration.asSeconds()}s`);
    
                    const refreshToken = this.decodeToken(tokens.refresh_token);
                    //const refreshTokenDuration = moment.duration(moment.unix(refreshToken.exp).diff(moment()));
                    //console.log(`Refresh token '${crc(tokens.refresh_token).toString(16)}' will expire in ${refreshTokenDuration.asSeconds()}s`);
                }
                else
                {
                    console.error("Failed to perform token exchange");
                    console.error(resp.status, resp.statusText, await resp.text());
                }
            }
        }
    
        return tokens;
    }
    
    public async refreshToken(auth, refreshToken) {
        let tokens;
    
        const parsedToken = this.decodeToken(refreshToken);
        console.log(`Beginning token refresh for token ${parsedToken.azp}`);
    
        const client = await this.getClient(auth, parsedToken.azp);
    
        const secret = await this.getClientSecret(auth, client);
    
        const data = {
            client_id: client.clientId,
            client_secret: secret,
            grant_type: ('refresh_token'),
            refresh_token: refreshToken
        };
        const resp = await fetch(`${this.BASE_URI}/realms/${this.REALM}/protocol/openid-connect/token`, {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + auth,
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            body: querystring.encode(data)
        });
    
        if (resp.ok)
        {
            console.log("Refresh successful");
            tokens = await resp.json();
    
    
            const accessToken = this.decodeToken(tokens.access_token);
            //const accessTokenDuration = moment.duration(moment.unix(accessToken.exp).diff(moment()));
            //console.log(`Access token '${crc(tokens.access_token).toString(16)}' will expire in ${accessTokenDuration.asSeconds()}s`);
    
            const refreshToken = this.decodeToken(tokens.refresh_token);
            //const refreshTokenDuration = moment.duration(moment.unix(refreshToken.exp).diff(moment()));
            //console.log(`Refresh token '${crc(tokens.refresh_token).toString(16)}' will expire in ${refreshTokenDuration.asSeconds()}s`);
        }
        else
        {
            console.error("Failed to refresh token");
            console.error(await resp.text());
        }
    
        return tokens;
    }
}