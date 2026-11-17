# language: es
Característica: Mensajería directa uno a uno
  Como usuario
  Quiero conversar en privado con otra persona
  Para intercambiar mensajes sin duplicar salas

  Antecedentes:
    Dado que Ana es un usuario estándar
    Y que Beto es un usuario estándar
    Y que Carla es un usuario estándar

  Escenario: Iniciar un mensaje directo desde la barra lateral
    Cuando Ana inicia un mensaje directo con Beto desde la barra lateral
    Entonces la conversación se abre en una ruta que empieza por "/direct/"
    Cuando Ana envía "Hola Beto" en la conversación
    Entonces la conversación muestra "Hola Beto"

  Escenario: Crear dos veces el mismo mensaje directo no duplica la sala
    Cuando Ana crea por la API un mensaje directo con Beto 2 veces
    Entonces todas las respuestas devuelven la misma sala
    Y Ana tiene 1 sala directa con Beto

  Escenario: Rechazar un mensaje directo con un usuario inexistente
    Cuando Ana intenta crear un mensaje directo con un usuario inexistente
    Entonces la API responde con el código 400
    Y el tipo de error es "error-invalid-user"

  Escenario: Rechazar un mensaje directo que supera el máximo de miembros
    Dado que el límite de miembros de un mensaje directo es 2
    Cuando Ana intenta crear un mensaje directo con Beto y Carla
    Entonces la API responde con el código 400
    Y el tipo de error es "error-direct-message-max-user-exceeded"
