# Políticas de retención y depuración

- POST /api/v1/rooms.cleanHistory elimina mensajes de una sala. Exige roomId, latest y oldest. Opcionales: inclusive, excludePinned, filesOnly, users, limit, ignoreDiscussion e ignoreThreads.
- Con excludePinned en verdadero, los mensajes fijados nunca se eliminan, sin importar su antigüedad. Con excludePinned en falso, también se eliminan.
- El parámetro limit fija el máximo de mensajes a eliminar. La depuración trabaja por lotes de 1000 mensajes.
- Con filesOnly solo se quitan los archivos adjuntos y se conservan los mensajes.
- El parámetro users limita la eliminación a los mensajes de esos usuarios.
- Si falta roomId, latest u oldest, el servidor responde 400.
- Si latest es anterior a oldest, el servidor no lo rechaza: la selección queda vacía, responde 200 y count es 0, sin borrar nada.
- La respuesta correcta incluye success verdadero y count con el número de mensajes eliminados. Al eliminar, también se borran los acuses de lectura y se avisa a los clientes.
- Hace falta el permiso clean-channel-history. Un usuario sin él recibe 403.
- En la interfaz, la opción Prune messages está en el menú de opciones de la sala. Tiene un rango de fechas, la casilla Do not prune pinned messages y un botón de confirmación Yes, prune them!.
