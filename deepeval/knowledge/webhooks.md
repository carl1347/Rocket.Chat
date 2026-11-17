# Webhooks e integraciones

- Un webhook entrante se llama con POST /hooks/ seguido del identificador de la integración y su token. También funciona la ruta heredada que añade el identificador de usuario.
- El cuerpo es JSON con el campo text, por ejemplo {"text": "Mensaje automatizado"}. Una respuesta correcta es HTTP 200 con success verdadero.
- El mensaje se publica con el usuario configurado en la integración, normalmente rocket.cat. Ese usuario necesita el permiso message-impersonate.
- Una integración desactivada responde 503 con el texto Service Unavailable.
- El payload no puede cambiar el canal de destino si la integración no activa overrideDestinationChannelEnabled: responde 403.
- Los formularios al estilo Slack que envían el JSON dentro del campo payload se desenvuelven antes de procesarse.
- Con un token inexistente o corrupto, el servidor hoy responde 500 Internal Server Error y no publica nada. No responde 404.
- POST /hooks/remove con un target_url que no está registrado responde 404 con el error integration-not-found.
- Con separateResponse activo, la respuesta incluye un arreglo responses con el resultado de cada envío.
- El limitador de peticiones también protege los webhooks y responde 429 al superar el límite.
- El token de una integración es un secreto: no debe compartirse ni mostrarse.
