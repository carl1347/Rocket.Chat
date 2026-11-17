# language: es
Característica: Políticas de retención y depuración
  Como administrador
  Quiero depurar el historial de una sala
  Para eliminar mensajes antiguos sin perder los fijados

  Antecedentes:
    Dado que Ana es administradora de Rocket.Chat
    Y que existe una sala con el mensaje "Mensaje normal" y el mensaje fijado "Mensaje fijado" publicados por Ana

  Escenario: Depurar desde el menú de la sala conservando los fijados
    Cuando Ana poda la sala desde el menú contextual conservando los mensajes fijados
    Entonces la sala ya no contiene el mensaje "Mensaje normal"
    Y la sala conserva el mensaje "Mensaje fijado"

  Escenario: Limpiar el historial por la API con excludePinned
    Cuando Ana limpia el historial por la API con excludePinned en true
    Entonces la API responde con el código 200
    Y la sala ya no contiene el mensaje "Mensaje normal"
    Y la sala conserva el mensaje "Mensaje fijado"

  Escenario: Rechazar una limpieza sin el rango de fechas completo
    Cuando Ana limpia el historial por la API sin la fecha oldest
    Entonces la API responde con el código 400

  Escenario: Un rango de fechas invertido no elimina nada
    Cuando Ana limpia el historial por la API con las fechas invertidas
    Entonces la API responde con el código 200
    Y la API informa que se eliminaron 0 mensajes
    Y la sala conserva el mensaje "Mensaje normal"
