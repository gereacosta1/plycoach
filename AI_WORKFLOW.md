# Cómo usar las tres IAs sin APIs pagas

## ChatGPT Plus — implementación principal

Usar este repositorio como fuente de verdad. Pedir cambios concretos de uno en uno, validar con `npm test` y `npm run build`. No reemplazar el motor de ajedrez por respuestas de un LLM.

## Claude Free — auditoría de arquitectura

**Prompt listo para copiar:**

> Estoy construyendo una web Vite + React + TypeScript llamada PlyCoach. Importa partidas **públicas y terminadas** de Chess.com y Lichess, las procesa con chess.js y calcula evaluaciones mediante Stockfish Lite en un Web Worker del navegador. No tiene backend, pagos, OAuth ni APIs de IA pagas. Revisá este repositorio como senior engineer y revisor de seguridad. Detectá errores críticos, contradicciones con las APIs, problemas de Worker/WASM, pérdidas de memoria, sesgos o bugs en las evaluaciones y cualquier cosa que impida un despliegue comercial. Priorizá hallazgos por gravedad, archivo, línea y reproducción. NO inventes resultados de testing y NO propongas integrar una API paga salvo justificación clara. Primero leé README y los módulos src/lib/importers.ts y src/lib/stockfish.ts.

Adjuntar el ZIP o los archivos clave. Usar una conversación aparte con Claude, no asumir que las IAs se comparten archivos automáticamente.

## Muse — branding, assets y marketing

**Prompt listo para copiar:**

> Diseñá la identidad visual original de «PlyCoach» (nombre provisional), una plataforma independiente de entrenamiento de ajedrez. Estética premium tecnológica pero accesible: fondo carbón azulado, acentos verde menta, paneles sobrios, tablero funcional, tipografía clara. El producto importa las partidas públicas terminadas de Chess.com/Lichess y genera entrenamientos basados en pérdidas de evaluación encontradas por Stockfish. Necesito propuesta de logo SVG o PNG (no copiar caballos/piezas ni la identidad propia de Chess.com o Lichess), 3 piezas sociales 1080×1920 y propuesta de landing con CTA «Analizá tus últimas partidas gratis». Prohibido usar logos ajenos, estadísticas inventadas o mensajes que impliquen afiliación oficial. Entregar textos en español e inglés.

Si Muse entrega imágenes, se pueden copiar a `public/brand/` e integrar en React.

## Decisiones de producto

1. Primera versión: importación por username sin OAuth y análisis local.
2. Testear funcionalidad antes de facturar a nadie.
3. Validar términos comerciales, licencias y políticas de privacidad antes de cobrar.
4. Dejar la IA generativa para explicaciones opcionales en una fase posterior; la API de Claude Free no está incluida y ChatGPT Plus tampoco trae crédito general de API.
