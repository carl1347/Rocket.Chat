# language: es
Característica: Hilos de conversación
  Como miembro de una sala
  Quiero responder a un mensaje dentro de un hilo
  Para mantener ordenadas las conversaciones paralelas

  Antecedentes:
    Dado que Ana es administradora de Rocket.Chat
    Y que existe una sala con el mensaje "Mensaje padre del hilo" publicado por Ana

  Escenario: Responder en un hilo desde la interfaz
    Cuando Ana responde "Respuesta desde la UI" en el hilo del último mensaje
    Entonces el panel de hilos muestra "Respuesta desde la UI"
    Y el mensaje "Mensaje padre del hilo" registra 1 respuesta

  Escenario: Responder en un hilo mediante la API
    Cuando Ana envía por la API "Respuesta por API" como respuesta de "Mensaje padre del hilo"
    Entonces la API responde con el código 200
    Y el hilo de "Mensaje padre del hilo" contiene "Respuesta por API"

  Escenario: Rechazar un tmid que no es texto
    Cuando Ana envía por la API un mensaje con un tmid numérico
    Entonces la API responde con el código 400

  Escenario: Un tmid sin mensaje asociado se acepta hoy sin validar
    Cuando Ana envía por la API un mensaje con un tmid que no corresponde a ningún mensaje
    Entonces la API responde con el código 200
