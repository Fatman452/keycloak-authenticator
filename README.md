#keycloak-authenticator
This package expose method for get access tokens from a keycloak server, also provide tools to valide those tokens against the server. 

#install 
`npm i keycloak-authenticator`

#example

```javascript
import { KeycloakAuthentication } from 'keycloak'

const kcauth = new KeycloakAuthentication({
    KEYCLOAK_BASE_URI: process.env.KEYCLOAK_BASE_URI, //ex: https://localhost:8080/auth
    KEYCLOAK_REALM: process.env.KEYCLOAK_REALM, //realm name (not id is a string)
    KEYCLOAK_USERNAME: process.env.KEYCLOAK_USER_NAME //realm user name
    KEYCLOAK_PASSWORD: process.env.KEYCLOAK_USER_PASSWORD, //realm user password
});

kcauth.getAccessToken('client_id', 'client_secret <search in client credentials in your keycloak server> ')
.then(async (token) => {
    //this is an example, in general you will wish use this token to authenticate against a service or exchange information
    let isValid = await kcauth.validateAccessToken(token) //at the other side you could valide any token you catch.
    console.log(isValid) //true
}); 

```
