# Control de acceso basado en roles (RBAC)

- Los permisos se asignan a roles. Los roles integrados incluyen admin, moderator, owner y user.
- GET /api/v1/permissions.listAll devuelve la matriz de permisos con los roles de cada uno.
- Solo quien tiene el permiso access-permissions, normalmente un administrador, puede cambiar permisos o asignar roles. Un usuario estándar recibe 401 o 403.
- Para limpiar el historial de una sala con rooms.cleanHistory hace falta el permiso clean-channel-history en esa sala. Sin él, el servidor responde 403 con errorType error-forbidden.
- Además del permiso, el usuario debe poder acceder a la sala. Si no puede, la respuesta es 403 con el mensaje que indica que no tiene acceso a la sala.
- Una petición sin credenciales o con un token falso recibe 401.
- Un usuario con una suscripción baneada activa en una sala pública, incluidas las salas públicas de un equipo, no puede acceder a ella.
- Para acceder a una sala pública, un usuario autenticado necesita el permiso view-c-room. Un visitante anónimo solo entra si el ajuste Accounts_AllowAnonymousRead está activo.
- En la interfaz, un usuario estándar no ve la opción Delete sobre mensajes ajenos ni la opción Prune messages del menú de la sala.
