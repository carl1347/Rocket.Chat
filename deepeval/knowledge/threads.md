# Hilos de conversación

- Un mensaje es respuesta de un hilo cuando se envía con `tmid` igual al identificador del mensaje padre, por ejemplo con POST /api/v1/chat.sendMessage.
- El mensaje padre guarda `tcount`, el número de respuestas del hilo, y `tlm`, la fecha de la última respuesta.
- Responder a una respuesta no crea un hilo anidado: la nueva respuesta queda en el hilo del mensaje raíz.
- El `tmid` debe ser texto. Si se envía un número, el servidor responde con el código HTTP 400.
- Enviar `tshow` sin `tmid` es un error y responde 400 con invalid-params.
- Si el `tmid` es texto pero no corresponde a ningún mensaje, el servidor hoy no lo rechaza: guarda el mensaje y responde 200.
- Los hilos exigen que el ajuste Threads_enabled esté activo. Si está desactivado, enviar un mensaje con `tmid` responde error-not-allowed.
- Al responder, se notifica al autor del mensaje padre, a quienes ya respondieron antes y a los usuarios mencionados, salvo al autor de la respuesta. Un mensaje editado no vuelve a notificar.
- GET /api/v1/chat.getThreadMessages devuelve las respuestas de un hilo con los campos count, offset y total.
- Quien responde o es mencionado en un hilo empieza a seguirlo. Se puede dejar de seguir con chat.unfollowMessage.
