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

    public decodeToken(token) {
        return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString() ); 
    }

    public async validateAccessToken(token) : Promise<boolean> {
        try { 
            let cert = await this.getPublicKey(); 
            let publicKEY = Buffer.from(`-----BEGIN CERTIFICATE-----\n${cert}\n-----END CERTIFICATE-----`,'utf8');
            let result = await verifyToken(token, publicKEY); 
          
            return true; 
        }
        catch (error) {
            console.log(error);
            console.error(`Invalid token, reason: ${error.message}`); 
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
            console.assert(resData, "Can not get Certs Data"); 
            //console.assert(cert);
            //console.log("Cert obtained succesfully");
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
        let accessTokenJson; 
        if (resp.ok)
        {
            const respData = await resp.json();
            //console.log('respData: \n', respData); 
            token = respData.access_token;
            accessTokenJson = this.decodeToken(token); 
            console.assert(token, "Failed to get 'access_token' from auth response");
            //console.log("Login successful");
        }
        else
        {
            console.error('Failed to access, reason: ', await resp.json());
        }
        return {accessToken: token, accessTokenJson: accessTokenJson};
    }

   
    
    public async refreshToken(auth,  refreshToken, secret) {
        let tokens;
    
        const parsedToken = this.decodeToken(refreshToken);
        //console.log(`Beginning token refresh for token ${parsedToken.azp}`);
    
        const clientId = parsedToken.azp;
    
        // const secret = await this.getClientSecret(auth, client);
    
        const data = {
            client_id: clientId,
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
            body: querystring.encode(data),
            agent: new https.Agent({rejectUnauthorized: false})
        });
    
        if (resp.ok)
        {
            //console.log("Refresh successful");
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