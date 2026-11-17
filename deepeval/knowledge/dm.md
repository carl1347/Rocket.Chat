# Mensajería directa uno a uno

- POST /api/v1/im.create crea una conversación directa con otro usuario y devuelve la sala con su `rid` y t igual a d.
- La creación es idempotente: pedir de nuevo la misma pareja de usuarios devuelve la sala existente, con el mismo `rid`, sin duplicarla. Da igual quién de los dos la inicie.
- Un usuario puede crear una conversación directa consigo mismo.
- Si el nombre de usuario no existe, el servidor responde 400 con errorType error-invalid-user.
- El número de miembros de una conversación directa, contando a quien la crea, está limitado por el ajuste DirectMesssage_maxUsers. Si se supera, el error es error-direct-message-max-user-exceeded.
- Si en una conversación directa de dos personas uno de los usuarios está desactivado, la sala nueva se crea de solo lectura, con ro verdadero y reactWhenReadOnly falso.
- Crear una conversación que excluye al propio solicitante, con excludeSelf, requiere el permiso create-d-other-users.
- Un tercer usuario que no participa en la conversación no puede leer sus mensajes ni escribir en ella.
- Desde la interfaz, se inicia con el botón Create new y la opción Direct message; la aplicación abre la ruta /direct/ seguida del identificador de la sala.
