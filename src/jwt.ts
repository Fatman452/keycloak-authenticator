import { VerifyOptions, verify, decode } from 'jsonwebtoken'
import * as fs from 'fs'

export async function verifyToken(token: string, publicKEY): Promise<any> {
    fs.writeFileSync('./public.key', publicKEY);
    publicKEY = fs.readFileSync('./public.key', 'utf8');

    /** si el token no es valido retorna null */
    let decodeToken: any = await decode(token, { complete: true });

    if (decodeToken === null) {
        throw new invalidTokenError('Invalid Token');
    }

    let options: VerifyOptions = {
        algorithms: ["RS256"],
        issuer: decodeToken.iss,
        audience: decodeToken.aud,
        subject: decodeToken.sub
    }

    return verify(token, publicKEY, options);
}

export class invalidTokenError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'JsonWebTokenError';
        this.message = message;
    }
}