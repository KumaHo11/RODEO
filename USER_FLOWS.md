# RODEO - Flujos de Usuario (User Flows)

Este documento describe los principales flujos de usuario (User Flows) de la plataforma RODEO, detallando cómo los productores interactúan con los distintos módulos de la aplicación web.

---

## 1. Onboarding y Configuración Inicial (`/dashboard/mi-campo`, `/dashboard/guest-setup`)
**Objetivo:** Configurar la estructura base del campo para permitir las simulaciones y planificaciones.
1. **Creación de Potreros:** El usuario delimita o carga sus potreros (Paddocks), indicando la superficie en hectáreas y la biomasa/materia seca inicial.
2. **Creación de Rodeos (Herds):** El usuario ingresa sus grupos de animales, indicando categoría, peso promedio y cantidad de cabezas. El sistema calcula automáticamente el Equivalente Vaca (EV).
3. **Configuración de Variables Base:** Se configuran preferencias generales y objetivos de remanente de pasto.

---

## 2. Planificación de Pastoreo (Grazing Planner) (`/dashboard/grazing`)
**Objetivo:** Diseñar la rotación de los animales en los potreros de forma manual, controlando el consumo de forraje y los descansos.

### 2.1. Creación de un Plan de Pastoreo
1. El usuario navega al módulo de Planificación (Gantt).
2. Hace clic en el botón verde **"Planificar"**.
3. El sistema entra en modo dibujo (`drawingMode`). El usuario arrastra el cursor sobre un potrero en el Gantt para seleccionar las fechas de ingreso y egreso.
4. Se abre el Modal de Planificación:
   - Selecciona el Rodeo (Herd) que ingresará.
   - Puede agregar animales temporales si lo desea.
   - Ajusta los días planificados o la fecha de salida. El sistema le muestra en tiempo real cómo impacta esto en la biomasa del potrero.
5. Al guardar, el bloque de planificación aparece en el Gantt.

### 2.2. Fijar Plan como Original (Línea Base)
1. Para establecer un plan como definitivo antes de empezar la temporada, el usuario abre el modal resumen de un plan.
2. Hace clic en **"🔒 Fijar como planificación original"**.
3. El plan queda bloqueado en el nivel superior del Gantt (Track 1). Sus fechas originales ya no se pueden alterar, sirviendo como mapa de ruta intocable.

### 2.3. Ejecución y Modificación de Planes (Track 2)
1. Si llueve o cambian las condiciones, el usuario puede editar un plan ya fijado.
2. Al editar las fechas, el sistema registra esto como **Fechas Ajustadas**.
3. En el Gantt, la barra original permanece intacta arriba, mientras que una sombra gris (Track 2) refleja el desvío planificado.

### 2.4. Cierre de Pastoreo (Track 3)
1. Cuando los animales salen del potrero, el usuario hace clic en el bloque y selecciona **"Ver / corregir cierre"** o "Finalizar pastoreo".
2. Se abre un modal de cierre donde el usuario confirma:
   - Fecha de ingreso real y fecha de salida real.
   - Stock final de animales (cabezas reales al salir).
   - Biomasa remanente (kg MS/ha) y notas adicionales.
3. Al guardar, el estado pasa a **COMPLETADO**. En el Gantt, esto se consolida en una línea sólida verde (Track 3) que refleja la realidad frente a lo planificado originalmente.

---

## 3. Monitoreo Geoespacial (`/dashboard/map`)
**Objetivo:** Visualizar el estado del campo en tiempo real a través del mapa interactivo.
1. El usuario ingresa a la vista de Mapa.
2. Visualiza sus potreros codificados por colores en base a:
   - **Descanso:** Días desde el último pastoreo (alerta si entra antes de tiempo).
   - **Vigor Forrajero (NDVI):** Imágenes satelitales procesadas que indican la salud de la pastura.
3. Al hacer clic en un polígono, se despliega una tarjeta lateral con la biomasa actual, el rodeo que está pastoreando (si lo hay) y accesos directos para registrar una tarea.

---

## 4. Gestión Operativa y Bitácora (`/dashboard/bitacora`, `/dashboard/tareas`, `/dashboard/agenda`)
**Objetivo:** Registrar eventos diarios de campo, asignar tareas al personal y coordinar el trabajo operativo.
1. **Creación de Tareas:** El administrador crea una tarea (ej: arreglar alambre), asigna a un responsable y fecha límite.
2. **Bitácora (Diario):** Los usuarios registran lluvias, nacimientos o muertes.
3. **Integración WhatsApp:** (Flujo asíncrono) Un peón en el campo envía un mensaje de audio o texto al bot de RODEO en WhatsApp ("Llovieron 15mm en el potrero 3"). El sistema transcribe, clasifica y guarda automáticamente la nota en la Bitácora.

---

## 5. Módulo de Clima y Ajuste (`/dashboard/clima`)
**Objetivo:** Monitorear el clima y ajustar las estimaciones forrajeras en base al clima local.
1. El usuario revisa los paneles de precipitación y temperatura.
2. El sistema cruza estos datos con las curvas de crecimiento de las pasturas para ofrecer "Ajustes Climáticos" (Climate Adjustment), alertando si la tasa de crecimiento es menor a la esperada por falta de lluvias.

---

## 6. Módulo de Carbono y Sostenibilidad (`/dashboard/carbono`)
**Objetivo:** Seguir el balance de emisiones y captura de carbono.
1. El sistema lee el histórico de pastoreos (tiempos de descanso, remanentes).
2. Proyecta métricas de secuestro de carbono en el suelo, permitiendo al productor visualizar su impacto regenerativo o prepararse para certificaciones de carbono.

---

## 7. Suscripciones y Límites de Planes (`/dashboard/planes`)
**Objetivo:** Controlar el acceso a características premium (IA, NDVI, Carbono).
1. Si un usuario intenta acceder a Insights IA o mapas NDVI sin tener el plan adecuado, el sistema (`plan-limits.ts`) intercepta la acción.
2. Se muestra un modal (Paywall) invitando al usuario a actualizar su suscripción.
3. Si el usuario actualiza, el Super Admin o el flujo de pagos habilita el acceso instantáneo a los módulos premium.
