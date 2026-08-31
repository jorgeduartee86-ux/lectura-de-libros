# Modelo de amenazas

| Amenaza                  | Impacto                            | Mitigación actual                                                                        | Riesgo residual                                                       |
| ------------------------ | ---------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| XSS                      | Robo de sesión/clave en memoria    | React escapa texto, sin HTML crudo, CSP recomendada, dependencias auditadas              | Una dependencia comprometida ejecutada con la bóveda abierta          |
| CSRF                     | Operación no consentida            | JWT Bearer, CORS por allowlist, POST y SameSite de Supabase                              | Extensión maliciosa del navegador                                     |
| Robo de sesión           | Acceso a metadatos                 | Sesión en IndexedDB, RLS, revocación de dispositivos, bloqueo de bóveda                  | Sesión y PIN disponibles en un dispositivo comprometido               |
| Exposición de clave      | Lectura total del contenido        | Clave maestra envuelta; solo vive en memoria; secreto de emparejamiento en fragmento URL | Captura de memoria, extensión o malware local                         |
| Reutilización de IV      | Ruptura de AES-GCM                 | `crypto.getRandomValues(12)` en cada cifrado y prueba de IV distinto                     | Fallo extremo del RNG del sistema                                     |
| AAD alterado             | Sustitución entre relaciones/tipos | AAD fija relación, id, remitente, versión, timestamp y tipo                              | Ninguno conocido con Web Crypto correcto                              |
| Invitación robada        | Entrada de tercero                 | Token 256-bit, hash en DB, expiración, un uso, secreto separado, máximo dos              | Quien robe enlace completo antes de usarlo puede intentar registrarse |
| Enumeración              | Descubrir cuentas/invitaciones     | Errores públicos reducidos, token aleatorio y rate limiting                              | Tiempos o correo de Supabase pueden aportar señales mínimas           |
| Abuso de push            | Molestia o filtración              | Payload allowlist genérico, 20/hora, JWT y membresía, suscripciones propias              | El patrón temporal puede ser observable por el proveedor push         |
| RLS incorrecta           | Lectura de otra relación           | Función de membresía, políticas por tabla, pgTAP, Service Role solo en Edge              | Error en una futura migración sin prueba                              |
| IndexedDB                | Copia del vault/outbox             | Solo clave envuelta y ciphertext; PIN con PBKDF2 310k                                    | PIN débil permite ataque offline                                      |
| Dispositivo desbloqueado | Lectura/captura                    | Bloqueo por tiempo, visibilitychange, pagehide y salida rápida                           | SO, captura de pantalla y cámara externa no son controlables          |
| Logs                     | Filtración de contenido            | Edge Functions no registran body ni ciphertext; auditoría solo de evento                 | Logs de infraestructura conservan IP y tiempos                        |
| Storage                  | Imagen de otra relación            | Bucket privado, ruta relación/usuario, RLS, MIME y 5 MiB                                 | Metadatos de tamaño y fecha son visibles al proveedor                 |
| Tercer miembro           | Ruptura del alcance                | UNIQUE por usuario, trigger antes de insert, RPC con lock, Edge validation               | Administración manual con Service Role puede romper invariantes       |
| Supply chain             | Código malicioso                   | lockfile, audit, CI, revisión de cambios                                                 | Paquete legítimo comprometido aún es posible                          |

La aplicación no promete protección frente a un sistema operativo comprometido,
una persona con acceso físico y PIN, ni capturas realizadas por el propio usuario.
