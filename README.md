# PlyCoach MVP (nombre provisional)

Aplicación web de análisis **posterior** a partidas terminadas de Chess.com y Lichess. Importa historiales públicos, muestra resultados reales y utiliza Stockfish Lite en el navegador para detectar cambios de evaluación y generar ejercicios desde posiciones reales.

## Requisitos

- Node.js 20.19+ o 22.12+
- npm y conexión a internet para instalar dependencias y descargar partidas públicas
- Navegador moderno con WebAssembly y Web Workers

## Ejecutar

```bash
npm install
npm run dev
```

Abrí `http://localhost:5173`. Se descarga Stockfish automáticamente desde npm durante la instalación y se copia a `public/engine/`. No usa keys ni APIs pagas.

## Publicar en Netlify (primero probar)

1. Subí el repositorio privado/público a GitHub (respetando las licencias aplicables).
2. Conectá el repo a Netlify; el archivo `netlify.toml` configura build `npm run build` y publish `dist`.
3. Probar con usuarios reales de ambos proveedores en navegador de escritorio y celular. Verificar CORS, disponibilidad de las APIs, capacidad del dispositivo y carga del WASM.
4. **No activar cobros sin revisión de licencias, condiciones de APIs, política de privacidad, pago, soporte y tests de producción.**

## Comportamiento actual

- Entrás el usuario **público**; no hay login OAuth ni acceso a cuentas privadas, contraseñas, partidas en vivo ni datos premium.
- Chess.com: endpoint `api.chess.com/pub/player/{user}/games/archives` y archivos mensuales. Solo lee partidas estándar terminadas.
- Lichess: endpoint `lichess.org/api/games/user/{user}` con NDJSON y `finished=true`. Solo partidas estándar.
- El análisis Stockfish se ejecuta con versión **19 Lite single-threaded** en un Web Worker; no hay IA generativa ni información enviada a un proveedor de LLM.
- Evalúa posiciones secuencialmente con tiempo reducido y calcula pérdida aproximada de centipeones frente al mejor movimiento estimado. Clasifica en imprecisión/error/error grave mediante umbrales propios; no intenta reproducir etiquetas ni precisión de Chess.com.
- Para controlar recursos, el motor revisa como máximo los primeros 100 medios movimientos de cada partida; las primeras 3 jugadas completas no se clasifican. Hay botón para cancelar.
- El ejercicio acepta la primera jugada indicada por el motor. Otras líneas igualmente buenas podrían aparecer como distintas: no debe utilizarse como verificador exhaustivo.
- Los datos viven en la memoria de la página, no en nuestra base de datos. Se pueden exportar en JSON. No hay cuentas persistentes, pagos, SaaS multiusuario, recuperación offline ni una plataforma comercial lista.

## Limitaciones pendientes

- Prueba real de instalación/build y llamadas de red (el código fue generado en un entorno sin npm remoto, sin acceso a los servicios en vivo). **No afirmar que está probado/desplegado.**
- Manejo de rate limits más sofisticado, caché local e importaciones muy grandes.
- Validación de múltiples dispositivos, variantes y casos límite de PGN.
- Mejorar clasificador (profundidad adaptativa y multipv para comprobar alternativas), reproducibilidad de análisis y nomenclatura estratégica.
- Componentes de producto comercial: cuentas, privacidad/legal, pagos, seguridad, observabilidad, branding registrado, facturación y soporte.

## Avisos de uso y licencias

Este proyecto es independiente y no está afiliado a Chess.com ni Lichess. Usá solamente partidas completadas y públicas, nunca para ayuda en partidas en curso. Respetá las políticas Fair Play, los límites y términos de las APIs. No utilices marcas, diseños, glifos o funciones de marca de terceros para insinuar afiliación.

Stockfish.js es **GPL-3.0**; revisá las obligaciones de redistribución, acceso al código y avisos legales, así como licencias de cualquier otra dependencia, antes de desplegar o distribuir. Consultá las políticas de Chess.com antes de una monetización vinculada a sus datos. La viabilidad técnica no equivale a autorización comercial.

## Fuentes

- https://support.chess.com/en/articles/9650547-what-is-the-pubapi-and-how-do-i-use-it
- https://lichess-org.github.io/api/
- https://www.npmjs.com/package/stockfish
- https://github.com/nmrugg/stockfish.js
