# Que es event-manager-interfaces
Este paquete te permite crear una arquitectura independiente de la tecnologia utilizada para manejar los eventos. 

Por ejemplo, en un sistema basado en microservicios se pueden definir varias tecnologias como *Event-Bus* que a su vez trae un cliente para interactuar con este. 

La idea es independizar el cliente, de manera que se pueda utilizar una estructura "éstandar" entre todos los microservicios, que a su vez permita manejar varias tecnologias de manejo de eventos (un event manager con Redis y otro con Rabbit MQ por ejemplo). 

# Iniciar
Para obtener el paquete debe correr el siguiente comando: 
`npm i event-manager-interfaces`

# Configurar

```javascript

import { EventManager }  from 'event-manager-interfaces';
import mqEventManager from 'rabbitmq-event-manager';
import ndjEventManager from 'nodejs-event-manager';

const eventManager = new EventManager(); 

eventManager.addClient(new mqEventManager({
    url: 'amqp://localhost',
    application: 'test-micro-app'
}));

eventManager.addClient(new ndjEventManager({
    application: 'test-micro-app-2'
})); 

eventManager.on('EVENT', async payload => {
    console.log('Mensaje recibido: ', payload); 
});

eventManager.emit('EVENT', {value: 200}) ; 


```
# Emitir y Esperar

Algunos clientes tienen la opcion de permitir esperar una respuesta luego de emitir un evento. 
Para esto el *Listener* debe tener un handler que retorne algo, y con la funcion emitAndWait del cliente (una promesa) se puede acceder al valor retornado por el Listener. 

```javascript

const eventManager = new EventManager(); 

eventManager.addClient(new mqEventManager({url: 'amqp://localhost', application: 'micro-test-app'}));

eventManager.on('EVENT', async payload => {
    if (payload.x && payload.y) {
        return {result = payload.x + payload.y}; 
    }
})


eventManager.emitAndWait('EVENT', {x: 20, y: 20})
.then((resp) => {
    if (resp.result)
        console.log(resp.result); //40 
}); 

```
# Implementacion recomendada

Para implementar estas interfaces, recomiendo aislar la instanciacion del EventManager y consumirlo solo en los modulos que lo requieran, haciendo uso de las interfaces que este expone. 

**EventManager.ts**
```javascript

import { EventManager } from 'event-manager-interfaces'
import mqEventManager from 'rabbitmq-event-manager'

rabbitmqEventManager = new mqEventManager({
    application: 'micro-test-app', 
    url: 'amqp://localhost'
});

const eventManager = new EventManager(); 


eventManager.addClient(rabbitmqEventManager); 

export default new EventManager(); 
```


consumer.ts

```javascript
import eventManager from './EventManager.ts'

export function addListeners() {
    eventManager.on('EVENT_1', () => {console.log("RECIBIDO")}); 
    eventManager.on('EVENT_2', () => {console.log("RECIBIDO")}); 
    eventManager.on('EVENT_3', () => {console.log("RECIBIDO")}); 
    eventManager.on('EVENT_4', () => {console.log("RECIBIDO")}); 
    eventManager.on('EVENT_5', () => {console.log("RECIBIDO")}); 
}
```

producer.ts

```javascript

import eventManager from './EventManager.ts'; 

eventManager.emit('EVENT_1', 'value'); 
eventManager.emit('EVENT_2', false); 
eventManager.emit('EVENT_3', 15.00); 
eventManager.emit('EVENT_4', {data: {}}); 
eventManager.emit('EVENT_5', 123); 

```

Consumer vendria a definir todos los listener para los eventos que se piensan manejar en tu microservicio. 

Producer es el responsable de emitir los eventos y puede llamarse desde cualquier parte, por ejemplo
imagina que un listener espera al evento 'CREAR_USUARIO' luego de crear el usuario este emite un evento 'USUARIO_CREADO'

```javascript

import eventManager from './EventManager.ts'

export class Listeners {
    public addListeners(manager : IListener) {
        manager.on('CREAR_USUARIO', async payload => {
            let user_data = payload.user; 
            await db.save(user_data); 
            manager.emit('USUARIO_CREADO', user_data.id); 
        })
    }
}

```