# language: es
Característica: Webhooks e integraciones externas
  Como sistema externo
  Quiero publicar mensajes mediante un webhook entrante
  Para notificar eventos dentro de Rocket.Chat

  Antecedentes:
    Dado que Ana es administradora de Rocket.Chat
    Y que existe una sala con el mensaje "Sala de integraciones" publicado por Ana
    Y que existe un webhook entrante que publica como rocket.cat en la sala

  Escenario: Publicar con el token correcto
    Cuando Jenkins envía el mensaje "Mensaje automatizado" al webhook
    Entonces la API responde con el código 200
    Y la API informa éxito

  Escenario: El mensaje del webhook aparece publicado por rocket.cat
    Cuando Jenkins envía el mensaje "Mensaje automatizado en la sala" al webhook
    Entonces Ana ve en la sala el mensaje "Mensaje automatizado en la sala" publicado por "rocket.cat"

  Escenario: Un token corrupto no publica nada
    Cuando Jenkins envía el mensaje "No debe publicarse" al webhook con el token alterado
    Entonces la API responde con el código 500
    Y Ana comprueba que la sala no contiene "No debe publicarse"

  Escenario: Una URL sin token no existe
    Cuando Jenkins llama al webhook sin token
    Entonces la API responde con el código 404

  Escenario: Eliminar una integración no registrada informa integration-not-found
    Cuando Jenkins solicita eliminar la integración de la URL "https://example.com/no-registrada"
    Entonces la API responde con el código 404
    Y el mensaje de error contiene "integration-not-found"
