# language: es
Característica: Control de acceso basado en roles
  Como administrador del workspace
  Quiero que solo los roles autorizados moderen las salas
  Para que un usuario estándar no pueda borrar ni depurar mensajes ajenos

  Antecedentes:
    Dado que Ana es administradora de Rocket.Chat
    Y que Beto es un usuario estándar
    Y que existe una sala con el mensaje "Mensaje del propietario" publicado por Ana

  Escenario: Un administrador accede a las opciones de moderación
    Cuando Ana abre la sala en la interfaz
    Entonces Ana puede borrar el último mensaje
    Y Ana puede ver la opción de podar mensajes

  Escenario: Un usuario estándar no ve borrar ni podar
    Cuando Beto abre la sala en la interfaz
    Entonces Beto no puede borrar el último mensaje
    Y Beto no ve la opción de podar mensajes

  Escenario: Un usuario estándar no puede limpiar el historial por la API
    Cuando Beto intenta limpiar el historial de la sala por la API
    Entonces la API responde con el código 403
    Y el tipo de error es "error-forbidden"
